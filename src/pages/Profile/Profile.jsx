// The account settings screen: identity on top, then four equal cards for the actions that change something
// lasting. Not a list page, so no table, rail or paging, and its height is not padded out.

import { useState } from "react";
import { FiDatabase, FiDownload, FiEdit2, FiKey, FiLock, FiRefreshCw, FiRepeat, FiUserCheck } from "react-icons/fi";
import "./Profile.css";
import PageHeader from "@/components/PageHeader/PageHeader";
import { useSession, setSession } from "@/hooks/useSession";
import { showDialog } from "@/utils/dialog";
import PasswordModal from "./ProfileModals/PasswordModal";
import TransferModal from "./ProfileModals/TransferModal";

function validateEmail(value) {
  if (!value) return null;
  if (value.length < 5 || value.length > 254) return "Geçerli bir e-posta adresi girin.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return "Geçerli bir e-posta adresi girin.";
  return null;
}

function initialsOf(name) {
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2);
  return letters.toLocaleUpperCase("tr");
}

// These cards carry a description, unlike the dashboard tiles: they produce a lasting result, so the user
// reads what will happen first. Only the transfer card takes a semantic colour, since it cannot be undone.
function ActionCard({ icon, title, text, actionIcon, actionLabel, onAction, isBusy, danger }) {
  return (
    <div className={danger ? "pf-card pf-card--danger" : "pf-card"}>
      <div className="pf-card-head">
        <span className="pf-card-mark" aria-hidden="true">
          {icon}
        </span>
        <span className="pf-card-title">{title}</span>
      </div>
      <p className="pf-card-text">{text}</p>
      <button type="button" className="pf-card-btn" onClick={onAction} disabled={isBusy} aria-busy={isBusy}>
        {actionIcon}
        {actionLabel}
      </button>
    </div>
  );
}

function Profile() {
  const session = useSession();

  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);

  const handleBackup = async () => {
    setBackupRunning(true);

    try {
      const res = await window.electronAPI.runBackup();
      if (!res.cancelled) {
        if (res.success) {
          showDialog.toast("Yedek Alındı", res.message);
        } else {
          showDialog.error("Hata", res.message);
        }
      }
    } catch (err) {
      console.error("[Profile] runBackup:", err);
      showDialog.error("Hata", "Yedek alınamadı.");
    }

    setBackupRunning(false);
  };

  const handleUpdateEmail = async () => {
    const email = await showDialog.prompt({
      title: "E-posta Adresi",
      text: "Boş bırakırsanız kayıtlı adres kaldırılır.",
      inputLabel: "E-posta (isteğe bağlı)",
      inputPlaceholder: "ornek@site.com",
      inputValue: session.email || "",
      confirmButtonText: "Kaydet",
      validate: validateEmail,
    });
    if (email === null) return;

    try {
      const res = await window.electronAPI.updateEmail({ userId: session.id, email });
      if (res.success) {
        setSession({ ...session, email: res.email });
        showDialog.toast(res.message);
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[Profile] updateEmail:", err);
      showDialog.error("Hata", "E-posta adresi güncellenemedi.");
    }
  };

  const handleRegenerateRecovery = async () => {
    const password = await showDialog.passwordPrompt({
      title: "Yeni Kurtarma Kodu Üret",
      text: "Yeni kod üretildiğinde eski kod geçersiz olur.",
      confirmButtonText: "Oluştur",
    });
    if (!password) return;

    try {
      const res = await window.electronAPI.regenerateRecoveryCode({ password });
      if (res.success) {
        await showDialog.regeneratedCode(res.recoveryCode);
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[Profile] regenerateRecoveryCode:", err);
      showDialog.error("Hata", "Yeni kurtarma kodu üretilemedi.");
    }
  };

  return (
    <div className="profile-container">
      <PageHeader title="Profilim" />

      <section className="page-band" aria-label="Hesap bilgileri">
        <div className="pf-identity">
          <div className="pf-cell pf-person">
            <span className="pf-avatar" aria-hidden="true">
              {initialsOf(session.managerName)}
            </span>
            <span className="pf-person-text">
              <span className="pf-role">Site Yöneticisi</span>
              <span className="pf-name" title={session.managerName}>
                {session.managerName}
              </span>
            </span>
          </div>
          <div className="pf-cell">
            <span className="pf-cell-label">Kullanıcı Adı</span>
            <span className="pf-cell-value" title={session.username}>
              {session.username}
            </span>
          </div>
          <div className="pf-cell">
            <span className="pf-cell-label">E-posta</span>
            <span className="pf-cell-row">
              {session.email ? (
                <span className="pf-cell-value" title={session.email}>
                  {session.email}
                </span>
              ) : (
                <span className="pf-cell-value pf-cell-value--blank">Eklenmedi</span>
              )}
              <button type="button" className="pf-inline-btn" onClick={handleUpdateEmail}>
                {session.email ? "Düzenle" : "Ekle"}
              </button>
            </span>
          </div>
        </div>
      </section>

      <section className="page-band" aria-label="Güvenlik ve veri">
        <div className="pf-cards">
          <ActionCard
            icon={<FiLock />}
            title="Şifre"
            text="Giriş şifrenizi yenileyin. Yeni şifre mevcut şifreden farklı olmalıdır."
            actionIcon={<FiEdit2 />}
            actionLabel="Şifreyi Değiştir"
            onAction={() => setIsPasswordOpen(true)}
          />
          <ActionCard
            icon={<FiKey />}
            title="Kurtarma Kodu"
            text="Şifre unutulduğunda giriş ekranından bu kodla yeni şifre belirlenir. Yeni kod üretilince eskisi geçersiz olur."
            actionIcon={<FiRefreshCw />}
            actionLabel="Yeni Kod Üret"
            onAction={handleRegenerateRecovery}
          />
          <ActionCard
            icon={<FiDatabase />}
            title="Veri Yedeği"
            text="Kayıtlar yalnızca bu bilgisayarda saklanır. Yedek dosyasını harici bir diske ya da bulut klasörüne kaydedin."
            actionIcon={<FiDownload />}
            actionLabel={backupRunning ? "Yedekleniyor..." : "Yedek Al"}
            onAction={handleBackup}
            isBusy={backupRunning}
          />
          <ActionCard
            icon={<FiUserCheck />}
            title="Hesabı Devret"
            text="Hesap ve tüm kayıtlar yeni yöneticiye geçer. Başka bir bilgisayarda yüklenebilmesi için devir dosyası oluşturulur. Bu işlem geri alınamaz."
            actionIcon={<FiRepeat />}
            actionLabel="Hesabı Devret"
            onAction={() => setIsTransferOpen(true)}
            danger
          />
        </div>
      </section>

      {isPasswordOpen && (
        <PasswordModal userId={session.id} username={session.username} onClose={() => setIsPasswordOpen(false)} />
      )}
      {isTransferOpen && (
        <TransferModal userId={session.id} username={session.username} onClose={() => setIsTransferOpen(false)} />
      )}
    </div>
  );
}

export default Profile;
