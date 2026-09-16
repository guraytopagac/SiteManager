import { useEffect, useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import "./SelectBuilding.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useIpcData } from "@/hooks/useIpcData";
import { useSession, setCurrentBuilding, clearCurrentBuilding, useCurrentBuilding } from "@/hooks/useSession";
import { showDialog } from "@/utils/dialog";
import { MAX_BUILDING_NAME_LENGTH } from "@/utils/constants";
import { FiHome, FiPlus, FiAlertCircle, FiChevronRight, FiEdit2, FiTrash2 } from "react-icons/fi";

const ERROR_ID = "sb-name-error";

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
  const session = useSession();
  const selectedBuilding = useCurrentBuilding();
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editError, setEditError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [autoEnterAllowed, setAutoEnterAllowed] = useState(() => !location.state?.manual);

  const ownerId = session.id;
  const [res, reload] = useIpcData("listBuildings", { ownerId });
  const allBuildings = res.success ? res.data : [];
  const buildings = allBuildings.filter((b) => b.is_active === 1);
  const deleted = allBuildings.filter((b) => b.is_active === 0);
  const autoEnterTarget = autoEnterAllowed && buildings.length === 1 ? buildings[0] : null;

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
    setEditing({ building, name: building.name });
    setEditError("");
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditError("");
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    const renamedBuilding = editing.building;
    const trimmedName = editing.name.trim();

    const nameError = validateBuildingName(trimmedName);
    if (nameError) {
      setEditError(nameError);
      return;
    }
    if (trimmedName === renamedBuilding.name) {
      cancelEdit();
      return;
    }

    setIsBusy(true);

    try {
      const res = await window.electronAPI.renameBuilding({
        buildingId: renamedBuilding.id,
        ownerId,
        name: trimmedName,
      });

      if (res.success) {
        if (selectedBuilding?.id === renamedBuilding.id) {
          setCurrentBuilding({ id: renamedBuilding.id, name: trimmedName });
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

  const handleRemove = async (building) => {
    const confirmed = await showDialog.confirmDanger(
      "Binayı Kalıcı Olarak Sil",
      `"${building.name}" listeden tamamen kaldırılacak ve bir daha geri getirilemeyecek.`,
      "Vazgeç",
      "Evet, Sil",
    );
    if (!confirmed) return;

    try {
      const res = await window.electronAPI.removeBuilding({ buildingId: building.id, ownerId });

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
      console.error("[SelectBuilding] removeBuilding:", err);
      showDialog.error("Hata", "Bina kalıcı olarak silinemedi. Lütfen tekrar deneyin.");
    }
  };

  const handleToggleStatus = async (building) => {
    const willActivate = building.is_active === 0;
    const confirmed = willActivate
      ? await showDialog.confirm(
          "Binayı Geri Getir",
          `"${building.name}" yeniden bina listesine eklenecek.`,
          "Vazgeç",
          "Geri Getir",
        )
      : await showDialog.confirmDanger(
          "Binayı Sil",
          `"${building.name}" bina listesinden kaldırılacak. Silinen binalar bölümünden geri getirebilirsiniz.`,
          "Vazgeç",
          "Evet, Sil",
        );
    if (!confirmed) return;

    try {
      const res = await window.electronAPI.updateBuildingStatus({
        buildingId: building.id,
        ownerId,
        isActive: willActivate,
      });

      if (res.success) {
        if (!willActivate && selectedBuilding?.id === building.id) {
          clearCurrentBuilding();
        }
        loadBuildings();
        showDialog.toast(res.message);
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[SelectBuilding] updateBuildingStatus:", err);
      showDialog.error(
        "Hata",
        willActivate ? "Bina geri getirilemedi. Lütfen tekrar deneyin." : "Bina silinemedi. Lütfen tekrar deneyin.",
      );
    }
  };

  const showDeleted = res.success && deleted.length > 0;

  const openWizard = () => navigate("/new-building", { state: { fromList: true } });

  const renderNameForm = () => (
    <form className="sb-name-form" onSubmit={submitEdit}>
      <div className="sb-name-row">
        <input
          className="sb-input"
          value={editing.name}
          maxLength={MAX_BUILDING_NAME_LENGTH}
          aria-label="Bina adı"
          aria-invalid={editError ? true : undefined}
          aria-describedby={editError ? ERROR_ID : undefined}
          autoFocus
          onChange={(e) => {
            setEditing({ ...editing, name: e.target.value });
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
            <h2 className="sb-band-title">
              Binalarınız
              <span className="sb-band-count">{buildings.length} bina</span>
            </h2>
            <div className="sb-list">
              {buildings.map((building) =>
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
                        onClick={() => handleToggleStatus(building)}
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
            </div>
          </section>
        )}

        {showDeleted && (
          <section className="sb-band">
            <div className="sb-deleted-head">
              <h2 className="sb-band-title sb-band-title--flush">
                Silinen Binalar
                <span className="sb-band-count">{deleted.length} bina</span>
              </h2>
              <button type="button" className="sb-btn-secondary" onClick={() => setDeletedOpen((open) => !open)}>
                {deletedOpen ? "Gizle" : "Göster"}
              </button>
            </div>
            {deletedOpen && (
              <div className="sb-deleted-list">
                {deleted.map((building) => (
                  <div key={building.id} className="sb-deleted-row">
                    <span className="sb-deleted-name">{building.name}</span>
                    <span className="sb-deleted-actions">
                      <button
                        type="button"
                        className="sb-btn-secondary"
                        onClick={() => handleToggleStatus(building)}
                        aria-label={`${building.name} binasını geri getir`}
                      >
                        Geri Getir
                      </button>
                      <button
                        type="button"
                        className="sb-btn-secondary sb-btn-secondary--danger"
                        onClick={() => handleRemove(building)}
                        aria-label={`${building.name} binasını kalıcı olarak sil`}
                      >
                        Kalıcı Sil
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default SelectBuilding;
