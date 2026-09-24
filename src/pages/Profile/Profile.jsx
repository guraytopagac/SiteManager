// The account settings screen: identity on top, four equal cards for the actions that change something
// lasting, then the terms of office. Not a list page, so no table or rail, only the short terms list pages.

import { useState } from "react";
import { FiDatabase, FiDownload, FiEdit2, FiKey, FiLock, FiRefreshCw, FiRepeat, FiUserCheck } from "react-icons/fi";
import "./Profile.css";
import { showDialog } from "@/components/Dialog/dialogStore";
import PageHeader from "@/components/PageHeader/PageHeader";
import Pager from "@/components/Pager/Pager";
import { useIpcData } from "@/hooks/useIpcData";
import { usePagination } from "@/hooks/usePagination";
import { useSession, setSession } from "@/hooks/useSession";
import { formatDate } from "@/utils/date";
import EmailModal from "./ProfileModals/EmailModal";
import PasswordModal from "./ProfileModals/PasswordModal";
import RecoveryCodeModal from "./ProfileModals/RecoveryCodeModal";
import TransferModal from "./ProfileModals/TransferModal";

// Three single-line rows keep the page as tall as the list pages.
const TERMS_PAGE_SIZE = 3;

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

// Who held the account and when. A handover rewrites the account in place, so this list is the only place
// that still names the earlier managers. Short pages are topped up with hidden rows to keep one height.
function ManagerTerms() {
  const [res] = useIpcData("getManagerTerms", {});
  const terms = res.success ? res.data : [];
  const { pageItems, currentPage, pageCount, setPage } = usePagination(terms, TERMS_PAGE_SIZE);
  const spacers = [];

  for (let index = 0; index < TERMS_PAGE_SIZE - pageItems.length; index += 1) {
    spacers.push(<li key={`spacer-${index}`} className="pf-term pf-term--spacer" aria-hidden="true" />);
  }

  return (
    <section className="page-band" aria-label="Yönetim dönemleri">
      <div className="pf-terms-head">
        <h2 className="pf-terms-title">Yönetim Dönemleri</h2>
        <Pager currentPage={currentPage} pageCount={pageCount} onChange={setPage} />
      </div>
      <div className="pf-terms-slot">
        <ul className="pf-terms" aria-hidden={res.success ? undefined : true}>
          {pageItems.map((term) => (
            <li key={term.id} className="pf-term">
              <span className="pf-term-mark" aria-hidden="true">
                {initialsOf(term.manager_name)}
              </span>
              <span className="pf-term-name" title={term.manager_name}>
                {term.manager_name}
              </span>
              <span className="pf-term-user">{term.username}</span>
              <span className="pf-term-dates">
                {formatDate(term.started_at)}
                {" – "}
                {term.ended_at ? formatDate(term.ended_at) : <span className="pf-term-current">Devam ediyor</span>}
              </span>
            </li>
          ))}
          {spacers}
        </ul>
        {res.success ? null : <p className="pf-terms-error">{res.message}</p>}
      </div>
    </section>
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

      <ManagerTerms />

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
