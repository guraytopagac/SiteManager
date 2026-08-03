import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./SelectBuilding.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { setCurrentBuilding } from "@/hooks/useCurrentBuilding";
import { showAlert } from "@/utils/alert";
import { FiHome, FiPlus, FiAlertCircle } from "react-icons/fi";

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 60;

function validateName(value) {
  if (!value) return "Bina adı zorunludur.";
  if (value.length < MIN_NAME_LENGTH || value.length > MAX_NAME_LENGTH) {
    return "Bina adı 2 ile 60 karakter arasında olmalıdır.";
  }
  return null;
}

function SelectBuilding() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const [stayOnPage, setStayOnPage] = useState(Boolean(location.state?.manual));
  const skipAutoEnter = stayOnPage;
  const [buildings, setBuildings] = useState([]);
  const [deleted, setDeleted] = useState([]);
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const nameInputRef = useRef(null);
  const renameInputRef = useRef(null);

  useEffect(() => {
    if (isCreating) nameInputRef.current?.focus({ preventScroll: true });
  }, [isCreating]);

  useEffect(() => {
    if (renamingId !== null) renameInputRef.current?.focus({ preventScroll: true });
  }, [renamingId]);

  useEffect(() => {
    if (!currentUser?.id) return;
    let isMounted = true;

    (async () => {
      setLoading(true);
      setError(false);
      const res = await window.electronAPI.listBuildings(currentUser.id);
      if (!isMounted) return;
      if (res.success) {
        const activeBuildings = res.data.filter((b) => b.is_active === 1);
        const deletedBuildings = res.data.filter((b) => b.is_active === 0);

        if (!skipAutoEnter && activeBuildings.length === 1) {
          setCurrentBuilding({
            id: activeBuildings[0].id,
            name: activeBuildings[0].name,
          });
          navigate("/dashboard", { replace: true });
          return;
        }

        setBuildings(activeBuildings);
        setDeleted(deletedBuildings);
      } else {
        setError(true);
      }
      setLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, reloadToken, skipAutoEnter, navigate]);

  const enterBuilding = useCallback(
    (building) => {
      setCurrentBuilding({ id: building.id, name: building.name });
      navigate("/dashboard", { replace: true });
    },
    [navigate],
  );

  const openCreate = useCallback(() => {
    setNewName("");
    setCreateError("");
    setIsCreating(true);
  }, []);

  const closeCreate = useCallback(() => {
    setIsCreating(false);
    setNewName("");
    setCreateError("");
  }, []);

  const submitCreate = useCallback(
    async (event) => {
      event.preventDefault();
      const name = newName.trim();
      const invalid = validateName(name);
      if (invalid) {
        setCreateError(invalid);
        return;
      }

      setIsSaving(true);
      const res = await window.electronAPI.createBuilding({
        ownerId: currentUser.id,
        name,
      });
      setIsSaving(false);
      if (!res.success) {
        setCreateError(res.message || "Bina oluşturulurken bir hata oluştu.");
        return;
      }
      setStayOnPage(true);
      closeCreate();
      setReloadToken((token) => token + 1);
      showAlert.toast(`"${name}" binası oluşturuldu.`, "Girmek için karta tıklayın.");
    },
    [newName, currentUser, closeCreate],
  );

  const startRename = (building) => {
    setRenamingId(building.id);
    setRenameName(building.name);
    setRenameError("");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameName("");
    setRenameError("");
  };

  const submitRename = async (event, building) => {
    event.preventDefault();
    const name = renameName.trim();
    const invalid = validateName(name);
    if (invalid) {
      setRenameError(invalid);
      return;
    }
    if (name === building.name) {
      cancelRename();
      return;
    }

    setIsRenaming(true);
    const res = await window.electronAPI.renameBuilding({
      buildingId: building.id,
      ownerId: currentUser.id,
      name,
    });
    setIsRenaming(false);
    if (res.success) {
      showAlert.toast("Güncellendi", res.message);
      cancelRename();
      setReloadToken((t) => t + 1);
    } else {
      setRenameError(res.message || "Bina adı güncellenemedi.");
    }
  };

  const handleRemove = async (building) => {
    const confirmed = await showAlert.confirmDanger(
      "Binayı Kalıcı Olarak Sil",
      `"${building.name}" listeden tamamen kaldırılacak ve bir daha geri getirilemeyecek.`,
      "Evet, Sil",
    );
    if (!confirmed) return;

    const res = await window.electronAPI.removeBuilding({
      buildingId: building.id,
      ownerId: currentUser.id,
    });
    if (res.success) {
      showAlert.toast("Bina kalıcı olarak silindi.");
      setReloadToken((t) => t + 1);
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  const handleToggleStatus = async (building) => {
    const willActivate = building.is_active === 0;
    const confirmed = willActivate
      ? await showAlert.confirm(
          "Binayı Geri Getir",
          `"${building.name}" yeniden bina listesine eklenecek.`,
          "Geri Getir",
        )
      : await showAlert.confirmDanger(
          "Binayı Sil",
          `"${building.name}" bina listesinden kaldırılacak. Kayıtları silinmez, silinen binalar bölümünden geri getirebilirsiniz.`,
          "Evet, Sil",
        );
    if (!confirmed) return;

    const res = await window.electronAPI.updateBuildingStatus({
      buildingId: building.id,
      ownerId: currentUser.id,
      isActive: willActivate,
    });
    if (res.success) {
      showAlert.toast(willActivate ? "Bina geri getirildi." : "Bina silindi.");
      setReloadToken((t) => t + 1);
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  const isEmpty = !loading && !error && buildings.length === 0 && deleted.length === 0;
  const showList = !loading && !error && !isEmpty;

  const openBuildingKey = (building) => (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      enterBuilding(building);
    }
  };

  const createKey = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCreate();
    }
  };

  const renderCreateForm = ({ showCancel = true } = {}) => (
    <form className="sb-create" onSubmit={submitCreate}>
      <div className="sb-create-row">
        <input
          className="sb-create-input"
          ref={nameInputRef}
          value={newName}
          maxLength={MAX_NAME_LENGTH}
          placeholder="Örn. Mavikent Sitesi A Blok"
          aria-label="Bina adı"
          onChange={(e) => {
            setNewName(e.target.value);
            setCreateError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeCreate();
          }}
        />
        <button type="submit" className="sb-btn" disabled={isSaving}>
          Oluştur
        </button>
        {showCancel && (
          <button type="button" className="sb-btn-secondary" onClick={closeCreate} disabled={isSaving}>
            Vazgeç
          </button>
        )}
      </div>
      {createError && <p className="sb-create-error">{createError}</p>}
    </form>
  );

  return (
    <div className="sb-page">
      <main className="sb-shell">
        <section className="sb-band sb-band--context">
          <div className="sb-context">
            <div>
              <span className="sb-eyebrow">Mavikent Site Yönetimi</span>
              <h1 className="sb-title">{isEmpty ? "Hoş Geldiniz" : "Bina Seçin"}</h1>
              <p className="sb-subtitle">
                {isEmpty
                  ? "Başlamak için ilk binanızı oluşturun."
                  : "Yönetmek istediğiniz binayı seçin. Tüm kayıtlar seçtiğiniz binaya işlenir."}
              </p>
            </div>
            <div className="sb-identity">
              <AccountMenu showBuildingActions={false} />
            </div>
          </div>
        </section>

        {loading && (
          <section className="sb-band sb-band--last sb-band--fill">
            <h2 className="sb-band-title">Binalarınız</h2>
            <div className="sb-list">
              <div className="sb-skeleton" />
              <div className="sb-skeleton" />
            </div>
          </section>
        )}

        {error && (
          <section className="sb-band sb-band--last">
            <div className="sb-status sb-status--error">
              <span className="sb-status-icon">
                <FiAlertCircle size={16} />
              </span>
              <span>Bina listesi alınamadı.</span>
              <span className="sb-status-spacer" />
              <button className="sb-btn-secondary" onClick={() => setReloadToken((t) => t + 1)}>
                Yeniden Dene
              </button>
            </div>
          </section>
        )}

        {isEmpty && (
          <section className="sb-band sb-band--last sb-band--fill">
            <div className="sb-empty">
              <span className="sb-empty-mark">
                <FiHome size={30} />
              </span>
              <h2 className="sb-empty-title">Henüz bir binanız yok</h2>
              <p className="sb-empty-note">
                Aidat takibi, gelir gider kaydı ve sakin yönetimi için önce bir bina oluşturun. Daha sonra istediğiniz
                kadar bina ekleyebilirsiniz.
              </p>
              <div className="sb-empty-action">
                {isCreating ? (
                  renderCreateForm({ showCancel: false })
                ) : (
                  <button className="sb-btn" onClick={openCreate}>
                    <FiPlus size={20} />
                    İlk Binanızı Oluşturun
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {showList && (
          <section className={deleted.length > 0 ? "sb-band sb-band--fill" : "sb-band sb-band--last sb-band--fill"}>
            <h2 className="sb-band-title">Binalarınız</h2>
            <div className="sb-list">
              {buildings.map((building) =>
                renamingId === building.id ? (
                  <div key={building.id} className="sb-item sb-item--edit">
                    <span className="sb-item-mark">
                      <FiHome size={22} />
                    </span>
                    <form className="sb-rename" onSubmit={(e) => submitRename(e, building)}>
                      <div className="sb-rename-row">
                        <input
                          className="sb-create-input"
                          ref={renameInputRef}
                          value={renameName}
                          maxLength={MAX_NAME_LENGTH}
                          aria-label="Bina adı"
                          onChange={(e) => {
                            setRenameName(e.target.value);
                            setRenameError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") cancelRename();
                          }}
                        />
                        <button type="submit" className="sb-btn" disabled={isRenaming}>
                          {isRenaming ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                        <button type="button" className="sb-btn-secondary" onClick={cancelRename} disabled={isRenaming}>
                          Vazgeç
                        </button>
                      </div>
                      {renameError && <p className="sb-create-error">{renameError}</p>}
                    </form>
                  </div>
                ) : (
                  <div
                    key={building.id}
                    className="sb-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => enterBuilding(building)}
                    onKeyDown={openBuildingKey(building)}
                  >
                    <span className="sb-item-mark">
                      <FiHome size={22} />
                    </span>
                    <span className="sb-item-body">
                      <span className="sb-item-name">{building.name}</span>
                    </span>
                    <span className="sb-item-tools">
                      <button
                        className="sb-btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(building);
                        }}
                        aria-label={`${building.name} binasının adını değiştir`}
                      >
                        Düzenle
                      </button>
                      <button
                        className="sb-btn-secondary sb-btn-secondary--danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(building);
                        }}
                        aria-label={`${building.name} binasını sil`}
                      >
                        Sil
                      </button>
                    </span>
                  </div>
                ),
              )}

              {isCreating ? (
                <div className="sb-item sb-item--create">{renderCreateForm()}</div>
              ) : (
                <div
                  className="sb-item sb-item--add"
                  role="button"
                  tabIndex={0}
                  onClick={openCreate}
                  onKeyDown={createKey}
                >
                  <span className="sb-item-mark">
                    <FiPlus size={22} />
                  </span>
                  <span className="sb-item-label">Yeni Bina Oluştur</span>
                </div>
              )}
            </div>
          </section>
        )}

        {!loading && !error && deleted.length > 0 && (
          <section className="sb-band sb-band--last">
            <div className="sb-deleted-head">
              <h2 className="sb-band-title sb-band-title--flush">
                Silinen Binalar
                <span className="sb-band-count">{deleted.length} bina</span>
              </h2>
              <button className="sb-btn-secondary" onClick={() => setDeletedOpen((open) => !open)}>
                {deletedOpen ? "Gizle" : "Göster"}
              </button>
            </div>
            {deletedOpen && (
              <div className="sb-deleted-list">
                {deleted.map((building) => (
                  <div key={building.id} className="sb-deleted-row">
                    <span className="sb-deleted-name">{building.name}</span>
                    <span className="sb-deleted-actions">
                      <button className="sb-btn-secondary" onClick={() => handleToggleStatus(building)}>
                        Geri Getir
                      </button>
                      <button
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
