import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";
import { useCurrentUser, setCurrentUser, clearCurrentUser } from "@/hooks/useCurrentUser";
import { useCurrentBuilding } from "@/hooks/useCurrentBuilding";
import { showAlert } from "@/utils/alert";
import { formatDateTime } from "@/utils/date";

function validatePasswordForm(oldPassword, newPassword, confirmPassword) {
  if (!oldPassword) return "Mevcut şifrenizi girmelisiniz.";
  if (newPassword.length < 8) return "Yeni şifre en az 8 karakter olmalıdır.";
  if (newPassword !== confirmPassword) return "Yeni şifre ve tekrarı birbirinden farklı.";
  return null;
}

function validateBuildingName(value) {
  if (!value) return "Bina adı zorunludur.";
  if (value.length < 2 || value.length > 60) return "Bina adı 2 ile 60 karakter arasında olmalıdır.";
  return null;
}

function validateEmail(value) {
  if (!value) return null;
  if (value.length < 5 || value.length > 254) return "E-posta adresi 5 ile 254 karakter arasında olmalıdır.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return "Geçerli bir e-posta adresi girin.";
  return null;
}

function Profile() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const building = useCurrentBuilding();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [buildings, setBuildings] = useState([]);
  const [buildingsLoading, setBuildingsLoading] = useState(true);

  const oldPasswordRef = useRef(null);

  const fetchBuildings = useCallback(async () => {
    if (!currentUser?.id) return;
    const res = await window.electronAPI.listBuildings(currentUser.id);
    if (res.success) setBuildings(res.data);
    setBuildingsLoading(false);
  }, [currentUser]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!currentUser?.id) return;
      const res = await window.electronAPI.listBuildings(currentUser.id);
      if (cancelled) return;
      if (res.success) setBuildings(res.data);
      setBuildingsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const error = validatePasswordForm(oldPassword, newPassword, confirmPassword);
    if (error) {
      showAlert.error("Geçersiz Giriş", error);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await window.electronAPI.changePassword({ userId: currentUser.id, oldPassword, newPassword });
      if (response.success) {
        await showAlert.success("Başarılı!", response.message);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        oldPasswordRef.current?.focus();
      } else {
        showAlert.error("Hata", response.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!currentUser) return;

    const email = await showAlert.prompt({
      title: "E-posta Adresi",
      text: "Hesabınıza isteğe bağlı bir e-posta adresi ekleyebilir veya mevcut adresi boş bırakarak kaldırabilirsiniz.",
      inputLabel: "E-posta (isteğe bağlı)",
      inputPlaceholder: "ornek@site.com",
      inputValue: currentUser.email || "",
      confirmButtonText: "Kaydet",
      validate: validateEmail,
    });
    if (email === null) return;

    const res = await window.electronAPI.updateEmail({ userId: currentUser.id, email });
    if (res.success) {
      setCurrentUser({ ...currentUser, email: res.email });
      showAlert.success("Güncellendi", res.message);
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  const handleRegenerateRecovery = async () => {
    const password = await showAlert.passwordPrompt({
      title: "Yeni Kurtarma Kodu Üret",
      text: "Kimliğinizi doğrulamak için şifrenizi girin. Yeni kod üretildiğinde eski kod geçersiz olur.",
      confirmButtonText: "Oluştur",
    });
    if (!password) return;

    const res = await window.electronAPI.regenerateRecoveryCode(password);
    if (res.success) {
      await showAlert.regeneratedCode(res.recoveryCode);
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  const handleTransfer = async () => {
    const newPerson = await showAlert.prompt({
      title: "Hesabı Devret",
      text: "Hesabı yeni bir yöneticiye devredin. Binalar ve geçmiş veriler korunur; devir sonrası şifreniz geçersiz olur ve oturumunuz kapanır.",
      inputLabel: "Yeni yöneticinin adı soyadı",
      inputPlaceholder: "Ad Soyad",
      confirmButtonText: "Devam",
      validate: (val) => (!val || val.length < 2 ? "Ad soyad en az 2 karakter olmalıdır." : null),
    });
    if (!newPerson) return;

    const password = await showAlert.passwordPrompt({
      title: "Devri Onayla",
      text: "Kimliğinizi doğrulamak için mevcut şifrenizi girin.",
      confirmButtonText: "Devret",
    });
    if (!password) return;

    const res = await window.electronAPI.transferAccount({ userId: currentUser.id, password, newPerson });
    if (!res.success) {
      showAlert.error("Hata", res.message);
      return;
    }

    await showAlert.temporaryPassword({ managerName: newPerson, code: res.temporaryPassword });
    clearCurrentUser();
    navigate("/", { replace: true });
  };

  const handleRenameBuilding = async (b) => {
    const name = await showAlert.prompt({
      title: "Binayı Yeniden Adlandır",
      inputLabel: "Bina Adı",
      inputPlaceholder: "Örn. A Blok",
      confirmButtonText: "Kaydet",
      validate: validateBuildingName,
    });
    if (!name) return;

    const res = await window.electronAPI.renameBuilding({ buildingId: b.id, ownerId: currentUser.id, name });
    if (res.success) {
      showAlert.success("Güncellendi", res.message);
      fetchBuildings();
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  const handleToggleBuilding = async (b) => {
    const willActivate = b.is_active === 0;
    const confirmed = willActivate
      ? await showAlert.confirm("Binayı Geri Getir", `"${b.name}" arşivden çıkarılacak.`, "Geri Getir")
      : await showAlert.confirmDanger(
          "Binayı Arşivle",
          `"${b.name}" arşivlenecek ve bina seçiminde görünmeyecek. Kayıtları korunur; istediğiniz zaman geri getirebilirsiniz.`,
          "Arşivle",
        );
    if (!confirmed) return;

    const res = await window.electronAPI.updateBuildingStatus({
      buildingId: b.id,
      ownerId: currentUser.id,
      isActive: willActivate,
    });
    if (res.success) {
      showAlert.success(res.message, "");
      fetchBuildings();
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  return (
    <div className="profile-container">
      <h2 className="page-title">Profilim</h2>

      <div className="profile-card">
        <h3 className="profile-section-title">Hesap Bilgileri</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Ad Soyad</span>
            <span className="info-value">{currentUser?.managerName || "—"}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Giriş Kullanıcı Adı</span>
            <span className="info-value">{currentUser?.username}</span>
          </div>
          <div className="info-item">
            <span className="info-label">E-posta</span>
            <span className="info-value info-value-editable">
              {currentUser?.email || "—"}
              <button className="btn-secondary btn-xs" onClick={handleUpdateEmail}>
                {currentUser?.email ? "Düzenle" : "Ekle"}
              </button>
            </span>
          </div>
          {building?.name && (
            <div className="info-item">
              <span className="info-label">Aktif Bina</span>
              <span className="info-value">{building.name}</span>
            </div>
          )}
          <div className="info-item">
            <span className="info-label">Son Giriş</span>
            <span className="info-value">{formatDateTime(currentUser?.last_login)}</span>
          </div>
        </div>
      </div>

      <div className="profile-card">
        <h3 className="profile-section-title">Binalarım</h3>
        {buildingsLoading ? (
          <p className="profile-muted">Yükleniyor...</p>
        ) : buildings.length === 0 ? (
          <p className="profile-muted">Henüz bir binanız yok. Bina seçim ekranından oluşturabilirsiniz.</p>
        ) : (
          <ul className="building-manage-list">
            {buildings.map((b) => (
              <li key={b.id} className={`building-manage-item ${b.is_active ? "" : "is-archived"}`}>
                <span className="building-manage-name">
                  {b.name}
                  {b.is_active ? null : <span className="building-manage-tag">Arşivde</span>}
                </span>
                <span className="building-manage-actions">
                  {b.is_active && (
                    <button className="btn-secondary btn-xs" onClick={() => handleRenameBuilding(b)}>
                      Yeniden Adlandır
                    </button>
                  )}
                  <button className="btn-secondary btn-xs" onClick={() => handleToggleBuilding(b)}>
                    {b.is_active ? "Arşivle" : "Geri Getir"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="profile-card">
        <h3 className="profile-section-title">Şifre Değiştir</h3>
        <form onSubmit={handleChangePassword} className="password-form">
          <div className="input-group">
            <label htmlFor="old-password">Mevcut Şifre</label>
            <input
              id="old-password"
              ref={oldPasswordRef}
              type="password"
              required
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Mevcut şifrenizi girin"
            />
          </div>
          <div className="password-row">
            <div className="input-group">
              <label htmlFor="new-password">Yeni Şifre</label>
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 8 karakter"
              />
            </div>
            <div className="input-group">
              <label htmlFor="confirm-password">Yeni Şifre Tekrar</label>
              <input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Yeni şifreyi tekrar girin"
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Kaydediliyor..." : "Şifreyi Değiştir"}
            </button>
          </div>
        </form>
      </div>

      <div className="profile-card">
        <h3 className="profile-section-title">Güvenlik ve Devir</h3>
        <p className="profile-muted">
          Kurtarma kodu, şifrenizi unutursanız yeni şifre belirlemenin tek yoludur. Devir, hesabı yeni bir yöneticiye
          geçici şifreyle aktarır.
        </p>
        <div className="profile-action-row">
          <button className="btn-secondary" onClick={handleRegenerateRecovery}>
            Yeni Kurtarma Kodu Üret
          </button>
          <button className="btn-secondary" onClick={handleTransfer}>
            Hesabı Devret
          </button>
        </div>
      </div>

      <div className="return-link">
        <button className="btn-secondary" onClick={() => navigate(-1)}>
          Geri Dön
        </button>
      </div>
    </div>
  );
}

export default Profile;
