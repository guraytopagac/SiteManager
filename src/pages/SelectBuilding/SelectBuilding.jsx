// The building picker, plus renaming, deleting and restoring. Creating one belongs to the wizard alone,
// this screen only leads there.

import { useEffect, useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import "./SelectBuilding.css";
import DeletedBuildingsModal from "./SelectBuildingModals/DeletedBuildingsModal";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import Pager from "@/components/Pager/Pager";
import { showDialog } from "@/components/Dialog/dialogStore";
import { useIpcData } from "@/hooks/useIpcData";
import { usePagination } from "@/hooks/usePagination";
import { setCurrentBuilding, clearCurrentBuilding, useCurrentBuilding } from "@/hooks/useSession";
import { MAX_BUILDING_NAME_LENGTH } from "@/utils/constants";
import { FiHome, FiPlus, FiAlertCircle, FiChevronRight, FiEdit2, FiTrash2, FiArchive } from "react-icons/fi";

const ERROR_ID = "sb-name-error";
// Three buildings plus the create card make four rows on every page.
const PAGE_SIZE = 3;

// Three distinct sentences rather than one with zeroes in it: a building with no apartments yet, one whose
// apartments are all empty, and a populated one are different facts to the reader.
function buildingMeta(building) {
  if (!building.apartment_count) return "Henüz daire eklenmemiş";
  if (!building.person_count) return `${building.apartment_count} daire · kimse yok`;
  return `${building.apartment_count} daire · ${building.person_count} kişi`;
}

function validateBuildingName(value) {
  if (!value) return "Bina adı zorunludur.";
  if (value.length < 2 || value.length > MAX_BUILDING_NAME_LENGTH) {
    return "Bina adı 2 ile 60 karakter arasında olmalıdır.";
  }
  return null;
}

function SelectBuilding() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedBuilding = useCurrentBuilding();
  const [isDeletedModalOpen, setIsDeletedModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editError, setEditError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  // A single active building normally means this screen is skipped. Coming here on purpose from the account
  // menu disables that, and so does every action that reloads the list, or a delete would throw the user out.
  const [autoEnterAllowed, setAutoEnterAllowed] = useState(() => !location.state?.manual);

  const [res, reload] = useIpcData("listBuildings", {});
  const allBuildings = res.success ? res.data : [];
  const activeBuildings = allBuildings.filter((b) => b.is_active === 1);
  const deletedBuildings = allBuildings.filter((b) => b.is_active === 0);
  const autoEnterTarget = autoEnterAllowed && activeBuildings.length === 1 ? activeBuildings[0] : null;
  const { pageItems, currentPage, pageCount, setPage } = usePagination(activeBuildings, PAGE_SIZE);
  // Every page is topped up with hidden rows after the create card, so rows keep their size and the create
  // card stays right under the buildings instead of stretching into the empty space.
  const spacerCount = PAGE_SIZE - pageItems.length;

  const loadBuildings = () => {
    setAutoEnterAllowed(false);
    reload();
  };

  useEffect(() => {
    if (!autoEnterTarget) return;
    setCurrentBuilding({ id: autoEnterTarget.id, name: autoEnterTarget.name });
    navigate("/dashboard", { replace: true });
  }, [autoEnterTarget, navigate]);

  const enterBuilding = (building) => {
    setCurrentBuilding({ id: building.id, name: building.name });
    navigate("/dashboard", { replace: true });
  };

  const startEdit = (building) => {
    setEditing({ building, nameInput: building.name });
    setEditError("");
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditError("");
  };

  // Every writer below keeps the stored selection in step with what it changed: a rename rewrites it, a delete
  // clears it. The guard only checks the store, so a stale entry keeps letting records into a gone building.
  const submitEdit = async (event) => {
    event.preventDefault();
    const targetBuilding = editing.building;
    const newName = editing.nameInput.trim();

    const nameError = validateBuildingName(newName);
    if (nameError) {
      setEditError(nameError);
      return;
    }
    if (newName === targetBuilding.name) {
      cancelEdit();
      return;
    }

    setIsBusy(true);

    try {
      const res = await window.electronAPI.renameBuilding({
        buildingId: targetBuilding.id,
        name: newName,
      });

      if (res.success) {
        if (selectedBuilding?.id === targetBuilding.id) {
          setCurrentBuilding({ id: targetBuilding.id, name: newName });
        }
        showDialog.toast(res.message);
        cancelEdit();
        loadBuildings();
      } else {
        setEditError(res.message);
      }
    } catch (err) {
      console.error("[SelectBuilding] renameBuilding:", err);
      setEditError("Bina adı güncellenemedi. Lütfen tekrar deneyin.");
    }

    setIsBusy(false);
  };

  const handleDelete = async (building) => {
    const confirmed = await showDialog.confirmDanger(
      "Binayı Sil",
      `"${building.name}" bina listesinden kaldırılacak. Silinen binalar bölümünden geri getirebilirsiniz.`,
      "Vazgeç",
      "Evet, Sil",
    );
    if (!confirmed) return;

    try {
      const res = await window.electronAPI.updateBuildingStatus({
        buildingId: building.id,
        isActive: false,
      });

      if (res.success) {
        if (selectedBuilding?.id === building.id) {
          clearCurrentBuilding();
        }
        loadBuildings();
        showDialog.toast(res.message);
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[SelectBuilding] updateBuildingStatus:", err);
      showDialog.error("Hata", "Bina silinemedi. Lütfen tekrar deneyin.");
    }
  };

  const openWizard = () => navigate("/new-building", { state: { fromList: true } });

  const renderNameForm = () => (
    <form className="sb-name-form" onSubmit={submitEdit}>
      <div className="sb-name-row">
        <input
          className="sb-input"
          value={editing.nameInput}
          maxLength={MAX_BUILDING_NAME_LENGTH}
          aria-label="Bina adı"
          aria-invalid={editError ? true : undefined}
          aria-describedby={editError ? ERROR_ID : undefined}
          autoFocus
          onChange={(e) => {
            setEditing({ ...editing, nameInput: e.target.value });
            setEditError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancelEdit();
          }}
        />
        <button type="submit" className="sb-btn auth-btn auth-shine" disabled={isBusy}>
          {isBusy ? (
            <>
              <span className="auth-spinner" aria-hidden="true" />
              Kaydediliyor...
            </>
          ) : (
            <>Kaydet</>
          )}
        </button>
        <button type="button" className="sb-btn-secondary" onClick={cancelEdit} disabled={isBusy}>
          Vazgeç
        </button>
      </div>
      {editError && (
        <p className="sb-field-error" id={ERROR_ID} role="alert">
          {editError}
        </p>
      )}
    </form>
  );

  // With nothing to pick, only the page backdrop and the redirect are returned, so no card is drawn for a
  // frame. The wizard shares that backdrop, which makes the swap invisible.
  if (res.success && allBuildings.length === 0) {
    return (
      <div className="auth-page">
        <Navigate to="/new-building" replace />
      </div>
    );
  }

  if (autoEnterTarget) return null;

  return (
    <div className="auth-page">
      <main className="auth-card sb-shell">
        <section className="sb-band sb-band--context">
          <div className="sb-context">
            <div>
              <span className="sb-eyebrow">Mavikent Site Yönetimi</span>
              <h1 className="sb-title">Bina Seçin</h1>
              <p className="sb-subtitle">Yönetmek istediğiniz binayı seçin. Tüm kayıtlar seçtiğiniz binaya işlenir.</p>
            </div>
            <AccountMenu />
          </div>
        </section>

        {!res.success && (
          <section className="sb-band">
            <div className="sb-status" role="alert">
              <span className="sb-status-icon">
                <FiAlertCircle size={16} />
              </span>
              <span>Bina listesi alınamadı.</span>
              <button type="button" className="sb-btn-secondary sb-status-retry" onClick={reload}>
                Yeniden Dene
              </button>
            </div>
          </section>
        )}

        {res.success && (
          <section className="sb-band sb-band--fill">
            <div className="sb-list-head">
              <h2 className="sb-band-title">
                Binalarınız
                <span className="sb-band-count">{activeBuildings.length} bina</span>
              </h2>
              {/* Always drawn, even at zero, so the header never changes height when the first building is deleted. */}
              <button
                type="button"
                className="sb-btn-secondary sb-deleted-open"
                onClick={() => setIsDeletedModalOpen(true)}
              >
                <FiArchive size={18} />
                Silinen Binalar ({deletedBuildings.length})
              </button>
            </div>
            <div className="sb-list">
              {pageItems.map((building) =>
                editing?.building?.id === building.id ? (
                  <div key={building.id} className="sb-item sb-item--edit">
                    <span className="sb-item-mark">
                      <FiHome size={22} />
                    </span>
                    {renderNameForm()}
                  </div>
                ) : (
                  <div key={building.id} className="sb-item">
                    <button type="button" className="sb-item-open" onClick={() => enterBuilding(building)}>
                      <span className="sb-item-mark">
                        <FiHome size={22} />
                      </span>
                      <span className="sb-item-body">
                        <span className="sb-item-name">{building.name}</span>
                        <span className="sb-item-meta">{buildingMeta(building)}</span>
                      </span>
                      <span className="sb-item-go" aria-hidden="true">
                        <FiChevronRight size={20} />
                      </span>
                    </button>
                    <span className="sb-item-tools">
                      <button
                        type="button"
                        className="sb-icon-btn"
                        onClick={() => startEdit(building)}
                        title="Yeniden adlandır"
                        aria-label={`${building.name} binasının adını değiştir`}
                      >
                        <FiEdit2 size={18} />
                      </button>
                      <button
                        type="button"
                        className="sb-icon-btn sb-icon-btn--danger"
                        onClick={() => handleDelete(building)}
                        title="Sil"
                        aria-label={`${building.name} binasını sil`}
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </span>
                  </div>
                ),
              )}

              <button type="button" className="sb-item sb-item--add" onClick={openWizard}>
                <span className="sb-item-mark">
                  <FiPlus size={22} />
                </span>
                <span className="sb-item-body">
                  <span className="sb-item-label">Yeni Bina Oluştur</span>
                  <span className="sb-item-meta">Aynı hesapta istediğiniz kadar bina tutabilirsiniz</span>
                </span>
              </button>

              {Array.from({ length: spacerCount }, (_, index) => (
                <div key={`spacer-${index}`} className="sb-item sb-item--spacer" aria-hidden="true" />
              ))}
            </div>
            <Pager currentPage={currentPage} pageCount={pageCount} onChange={setPage} />
          </section>
        )}
      </main>

      {isDeletedModalOpen && (
        <DeletedBuildingsModal
          buildings={deletedBuildings}
          onClose={() => setIsDeletedModalOpen(false)}
          onChanged={loadBuildings}
        />
      )}
    </div>
  );
}

export default SelectBuilding;
