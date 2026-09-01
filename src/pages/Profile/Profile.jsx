import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useSession, setSession, clearSession, useCurrentBuilding } from "@/hooks/session";
import { showAlert } from "@/utils/alert";
import { formatDate } from "@/utils/date";

function validatePasswordForm(oldPassword, newPassword, confirmPassword) {
  if (!oldPassword) return "Mevcut şifrenizi girmelisiniz.";
  if (newPassword.length < 8) return "Yeni şifre en az 8 karakter olmalıdır.";
  if (newPassword !== confirmPassword) return "Yeni şifre ve tekrarı birbirinden farklı.";
  return null;
}

function validateEmail(value) {
  if (!value) return null;
  if (value.length < 5 || value.length > 254) return "Geçerli bir e-posta adresi girin.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return "Geçerli bir e-posta adresi girin.";
  return null;
}

function Profile() {
  const navigate = useNavigate();
  const session = useSession();
  const building = useCurrentBuilding();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const oldPasswordRef = useRef(null);

  const [backupRunning, setBackupRunning] = useState(false);

  const handleBackup = async () => {
    setBackupRunning(true);
    const res = await window.electronAPI.runBackup();
    setBackupRunning(false);

    if (res.cancelled) return;
    if (res.success) {
      showAlert.toast("Yedek Alındı", res.message);
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!session) return;

    const error = validatePasswordForm(oldPassword, newPassword, confirmPassword);
    if (error) {
      showAlert.error("Geçersiz Giriş", error);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await window.electronAPI.changePassword({ userId: session.id, oldPassword, newPassword });
      if (response.success) {
        showAlert.toast("Başarılı!", response.message);
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
    if (!session) return;

    const email = await showAlert.prompt({
      title: "E-posta Adresi",
      text: "Hesabınıza isteğe bağlı bir e-posta adresi ekleyebilir veya mevcut adresi boş bırakarak kaldırabilirsiniz.",
      inputLabel: "E-posta (isteğe bağlı)",
      inputPlaceholder: "ornek@site.com",
      inputValue: session.email || "",
      confirmButtonText: "Kaydet",
      validate: validateEmail,
    });
    if (email === null) return;

    const res = await window.electronAPI.updateEmail({ userId: session.id, email });
    if (res.success) {
      setSession({ ...session, email: res.email });
      showAlert.toast("Güncellendi", res.message);
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

    const res = await window.electronAPI.regenerateRecoveryCode({ password });
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

    const res = await window.electronAPI.transferAccount({ userId: session.id, password, newPerson });
    if (!res.success) {
      showAlert.error("Hata", res.message);
      return;
    }

    await showAlert.temporaryPassword({ managerName: newPerson, code: res.temporaryPassword });
    await showAlert.transferredRecoveryCode(res.recoveryCode);
    clearSession();
    navigate("/", { replace: true });
  };

  return (
    <div className="profile-container">
      <div className="account-menu-row">
        <AccountMenu />
      </div>

      <h2 className="page-title">Profilim</h2>

      <div className="profile-card">
        <h3 className="profile-section-title">Hesap Bilgileri</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Ad Soyad</span>
            <span className="info-value">{session?.managerName || "—"}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Giriş Kullanıcı Adı</span>
            <span className="info-value">{session?.username}</span>
          </div>
          <div className="info-item">
            <span className="info-label">E-posta</span>
            <span className="info-value info-value-editable">
              {session?.email || "—"}
              <button className="btn-secondary btn-xs" onClick={handleUpdateEmail}>
                {session?.email ? "Düzenle" : "Ekle"}
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
            <span className="info-value">{formatDate(session?.lastLogin)}</span>
          </div>
        </div>
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
        <h3 className="profile-section-title">Veri Yedeği</h3>
        <p className="profile-muted">
          Tüm kayıtlarınız yalnızca bu bilgisayarda saklanır. Yedek dosyasını harici bir diske ya da bulut klasörünüze
          kaydedin; bilgisayar değişirse verinizi geri yüklemenin tek yolu budur.
        </p>
        <div className="profile-action-row">
          <button className="btn-primary" onClick={handleBackup} disabled={backupRunning}>
            {backupRunning ? "Yedekleniyor..." : "Yedek Al"}
          </button>
        </div>
      </div>

      <div className="profile-card">
        <h3 className="profile-section-title">Güvenlik</h3>
        <p className="profile-muted">
          Kurtarma kodu, şifrenizi unutursanız yeni şifre belirlemenin tek yoludur. Yeni kod ürettiğinizde eski kod
          geçersiz olur.
        </p>
        <div className="profile-action-row">
          <button className="btn-secondary" onClick={handleRegenerateRecovery}>
            Yeni Kurtarma Kodu Üret
          </button>
        </div>
      </div>

      <div className="profile-card profile-card-danger">
        <h3 className="profile-section-title">Yönetici Değişikliği</h3>
        <p className="profile-muted">
          Hesabı yeni bir yöneticiye devreder. Binalar ve geçmiş kayıtlar korunur;{" "}
          <strong>şifreniz geçersiz olur</strong>, oturumunuz kapanır ve yeni yöneticiye bir kez gösterilen geçici şifre
          üretilir. Bu işlem geri alınamaz.
        </p>
        <div className="profile-action-row">
          <button className="btn-danger" onClick={handleTransfer}>
            Hesabı Devret
          </button>
        </div>
      </div>

      <div className="return-link">
        <button className="btn-secondary" onClick={() => navigate(building ? "/dashboard" : "/select-building")}>
          Geri Dön
        </button>
      </div>
    </div>
  );
}

export default Profile;
