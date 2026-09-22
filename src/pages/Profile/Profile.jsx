// The account settings screen: identity on top, then four equal cards for the actions that change something
// lasting. Not a list page, so no table, rail or paging, and its height is not padded out.

import { useState } from "react";
import { FiDatabase, FiDownload, FiEdit2, FiKey, FiLock, FiRefreshCw, FiRepeat, FiUserCheck } from "react-icons/fi";
import "./Profile.css";
import { showDialog } from "@/components/Dialog/dialogStore";
import PageHeader from "@/components/PageHeader/PageHeader";
import { useSession, setSession } from "@/hooks/useSession";
import EmailModal from "./ProfileModals/EmailModal";
import PasswordModal from "./ProfileModals/PasswordModal";
import RecoveryCodeModal from "./ProfileModals/RecoveryCodeModal";
import TransferModal from "./ProfileModals/TransferModal";

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
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
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
              <button type="button" className="pf-inline-btn" onClick={() => setIsEmailOpen(true)}>
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
            onAction={() => setIsRecoveryOpen(true)}
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
      {isEmailOpen && (
        <EmailModal
          userId={session.id}
          username={session.username}
          email={session.email}
          onClose={() => setIsEmailOpen(false)}
          onSaved={(email) => {
            setSession({ ...session, email });
            setIsEmailOpen(false);
          }}
        />
      )}
      {isRecoveryOpen && <RecoveryCodeModal username={session.username} onClose={() => setIsRecoveryOpen(false)} />}
      {isTransferOpen && (
        <TransferModal userId={session.id} username={session.username} onClose={() => setIsTransferOpen(false)} />
      )}
    </div>
  );
}

export default Profile;
