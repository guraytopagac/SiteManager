import { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./SelectBuilding.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useSession, setCurrentBuilding, clearCurrentBuilding, useCurrentBuilding } from "@/hooks/useSession";
import { showAlert } from "@/utils/alert";
import { FiHome, FiPlus, FiAlertCircle, FiChevronRight, FiEdit2, FiTrash2 } from "react-icons/fi";

const MAX_NAME_LENGTH = 60;
const ERROR_ID = "sb-name-error";

function buildingMeta(building) {
  if (!building.apartment_count) return "Henüz daire eklenmemiş";
  if (!building.person_count) return `${building.apartment_count} daire · kimse yok`;
  return `${building.apartment_count} daire · ${building.person_count} kişi`;
}

function validateBuildingName(value) {
  if (!value) return "Bina adı zorunludur.";
  if (value.length < 2 || value.length > MAX_NAME_LENGTH) {
    return "Bina adı 2 ile 60 karakter arasında olmalıdır.";
  }
  return null;
}

function SelectBuilding() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const selectedBuilding = useCurrentBuilding();
  const [buildings, setBuildings] = useState([]);
  const [deleted, setDeleted] = useState([]);
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editError, setEditError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const ownerId = session.id;
  const autoEnterAllowed = !location.state?.manual;

  const loadBuildings = useCallback(
    async (allowAutoEnter) => {
      setLoading(true);
      setLoadFailed(false);

      try {
        const res = await window.electronAPI.listBuildings({ ownerId });

        if (!res.success) {
          setLoadFailed(true);
        } else {
          if (res.data.length === 0) {
            navigate("/new-building", { replace: true });
            return;
          }

          const active = res.data.filter((b) => b.is_active === 1);

          if (allowAutoEnter && active.length === 1) {
            setCurrentBuilding({ id: active[0].id, name: active[0].name });
            navigate("/dashboard", { replace: true });
            return;
          }

          setBuildings(active);
          setDeleted(res.data.filter((b) => b.is_active === 0));
        }
      } catch (err) {
        console.error("[SelectBuilding] listBuildings:", err);
        setLoadFailed(true);
      }

      setLoading(false);
    },
    [ownerId, navigate],
  );

  useEffect(() => {
    (async () => {
      await loadBuildings(autoEnterAllowed);
    })();
  }, [loadBuildings, autoEnterAllowed]);

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
        showAlert.toast(res.message);
        cancelEdit();
        loadBuildings(false);
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
    const confirmed = await showAlert.confirmDanger(
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
        loadBuildings(false);
        showAlert.toast(res.message);
      } else {
        showAlert.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[SelectBuilding] removeBuilding:", err);
      showAlert.error("Hata", "Bina kalıcı olarak silinemedi. Lütfen tekrar deneyin.");
    }
  };

  const handleToggleStatus = async (building) => {
    const willActivate = building.is_active === 0;
    const confirmed = willActivate
      ? await showAlert.confirm(
          "Binayı Geri Getir",
          `"${building.name}" yeniden bina listesine eklenecek.`,
          "Vazgeç",
          "Geri Getir",
        )
      : await showAlert.confirmDanger(
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
        loadBuildings(false);
        showAlert.toast(res.message);
      } else {
        showAlert.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[SelectBuilding] updateBuildingStatus:", err);
      showAlert.error(
        "Hata",
        willActivate ? "Bina geri getirilemedi. Lütfen tekrar deneyin." : "Bina silinemedi. Lütfen tekrar deneyin.",
      );
    }
  };

  const isLoaded = !loading && !loadFailed;
  const showDeleted = isLoaded && deleted.length > 0;

  const openWizard = () => navigate("/new-building", { state: { fromList: true } });

  const renderNameForm = () => (
    <form className="sb-name-form" onSubmit={submitEdit}>
      <div className="sb-name-row">
        <input
          className="sb-input"
          value={editing.name}
          maxLength={MAX_NAME_LENGTH}
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

        {loading && (
          <section className="sb-band sb-band--fill">
            <h2 className="sb-band-title">Binalarınız</h2>
            <div className="sb-list">
              <div className="sb-skeleton" />
              <div className="sb-skeleton" />
            </div>
          </section>
        )}

        {loadFailed && (
          <section className="sb-band">
            <div className="sb-status" role="alert">
              <span className="sb-status-icon">
                <FiAlertCircle size={16} />
              </span>
              <span>Bina listesi alınamadı.</span>
              <button
                type="button"
                className="sb-btn-secondary sb-status-retry"
                onClick={() => loadBuildings(autoEnterAllowed)}
              >
                Yeniden Dene
              </button>
            </div>
          </section>
        )}

        {isLoaded && (
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
