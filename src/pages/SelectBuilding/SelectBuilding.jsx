import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SelectBuilding.css";
import { useCurrentUser, clearCurrentUser } from "@/hooks/useCurrentUser";
import { setCurrentBuilding } from "@/hooks/useCurrentBuilding";
import { showAlert } from "@/utils/alert";
import { FiHome, FiPlus, FiPower, FiChevronRight } from "react-icons/fi";

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
  const currentUser = useCurrentUser();
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);
      const res = await window.electronAPI.listBuildings(currentUser.id);
      if (cancelled) return;
      if (res.success) {
        setBuildings(res.data.filter((b) => b.is_active === 1));
      } else {
        setError(true);
        showAlert.error("Binalar Yüklenemedi", res.message || "Bina listesi alınırken bir hata oluştu.");
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, reloadToken]);

  const enterBuilding = useCallback(
    (building) => {
      setCurrentBuilding({ id: building.id, name: building.name });
      navigate("/dashboard", { replace: true });
    },
    [navigate],
  );

  const handleCreate = useCallback(async () => {
    const name = await showAlert.prompt({
      title: "Yeni Bina",
      inputLabel: "Bina Adı",
      inputPlaceholder: "Örn. A Blok",
      confirmButtonText: "Oluştur",
      validate: validateName,
    });
    if (!name) return;

    const res = await window.electronAPI.createBuilding({ ownerId: currentUser.id, name });
    if (!res.success) {
      showAlert.error("Bina Oluşturulamadı", res.message || "Bina oluşturulurken bir hata oluştu.");
      return;
    }
    enterBuilding({ id: res.id, name });
  }, [currentUser, enterBuilding]);

  const handleLogout = async () => {
    const confirmed = await showAlert.confirm("Çıkış Yap", "Oturumu kapatmak istiyor musunuz?", "Evet, Çık");
    if (!confirmed) return;
    clearCurrentUser();
    navigate("/", { replace: true });
  };

  const isEmpty = !loading && !error && buildings.length === 0;

  return (
    <div className="select-building-page">
      <div className="select-building-container">
        <button
          onClick={handleLogout}
          className="select-building-logout"
          title="Çıkış Yap"
          aria-label="Çıkış Yap"
        >
          <FiPower size={18} />
        </button>

        <header className="select-building-header">
          <span className="select-building-icon">
            <FiHome size={28} />
          </span>
          {currentUser?.managerName && (
            <p className="select-building-welcome">
              Hoş geldiniz, <strong>{currentUser.managerName}</strong>
            </p>
          )}
          <h1 className="select-building-title">Bina Seçin</h1>
          <p className="select-building-subtitle">Devam etmek istediğiniz binayı seçin veya yeni bir bina oluşturun.</p>
        </header>

        {loading ? (
          <div className="select-building-status">Binalar yükleniyor...</div>
        ) : error ? (
          <div className="select-building-status">
            Binalar yüklenemedi.{" "}
            <button className="button" onClick={() => setReloadToken((t) => t + 1)}>
              Yeniden Dene
            </button>
          </div>
        ) : (
          <>
            {isEmpty && (
              <p className="select-building-empty-note">
                Henüz bir binanız yok. Başlamak için ilk binanızı oluşturun.
              </p>
            )}

            <div className="select-building-list">
              {buildings.map((building, index) => {
                const isLoneLast = index === buildings.length - 1 && buildings.length % 2 === 1;
                return (
                <button
                  key={building.id}
                  className={isLoneLast ? "building-card building-card-wide" : "building-card"}
                  onClick={() => enterBuilding(building)}
                >
                  <span className="building-card-icon">
                    <FiHome size={22} />
                  </span>
                  <span className="building-card-name">{building.name}</span>
                  <FiChevronRight className="building-card-arrow" size={20} />
                </button>
                );
              })}

              <button className="building-card building-card-new" onClick={handleCreate}>
                <span className="building-card-icon building-card-icon-new">
                  <FiPlus size={22} />
                </span>
                <span className="building-card-name">Yeni Bina Oluştur</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default SelectBuilding;
