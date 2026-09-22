// Handing the account to someone else. The target computer is not asked: this machine is locked to the new
// credentials either way, and the file is the new manager's way onto another computer or just a backup.

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiCopy, FiDownload, FiKey, FiLock, FiLogIn, FiLogOut, FiUser, FiX } from "react-icons/fi";
import "./ProfileModals.css";
import AuthField from "@/components/AuthField/AuthField";
import { useCopyFeedback } from "@/hooks/useCopyFeedback";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { clearSession, setSavedUsername } from "@/hooks/useSession";

const ERROR_ID = "transfer-modal-error";

// Sits just above the button, so it is read at the moment the decision is made. Each line was measured to
// fit on one line of text, so a longer sentence wraps.
const OUTCOMES = [
  { icon: FiDownload, text: "Tüm kayıtlar, seçeceğiniz yere devir dosyası olarak kaydedilir." },
  { icon: FiKey, text: "Yeni yönetici için geçici şifre ve kurtarma kodu bir kez gösterilir." },
  { icon: FiLogOut, text: "Şifreniz geçersiz olur. Bu işlem geri alınamaz.", danger: true },
];

// Each surface keeps its own copy flag, so pressing one button does not light the other up.
function CodeSurface({ label, code }) {
  const { isCopied, copy } = useCopyFeedback();

  return (
    <div className="pf-md-code">
      <span className="pf-md-code-label">{label}</span>
      <span className="pf-md-code-value">{code}</span>
      <button type="button" className="pf-md-copy" onClick={() => copy(code)}>
        <FiCopy size={17} />
        <span className="pf-md-copy-label">{isCopied ? "Kopyalandı" : "Kopyala"}</span>
      </button>
    </div>
  );
}

function validateTransferForm(newPerson, newUsername, password) {
  if (newPerson.trim().length < 2) return "Yeni yöneticinin adı soyadı en az 2 karakter olmalıdır.";
  if (!newUsername.trim()) return "Yeni yöneticinin kullanıcı adını girin.";
  if (!password) return "Mevcut şifrenizi girin.";
  return null;
}

function TransferModal({ userId, username, onClose }) {
  const navigate = useNavigate();
  const [newPerson, setNewPerson] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [handover, setHandover] = useState(null);
  const firstFieldRef = useRef(null);

  const focusFirstField = (e) => {
    if (e.target !== e.currentTarget || e.currentTarget.contains(document.activeElement)) return;
    if (firstFieldRef.current) firstFieldRef.current.focus();
  };

  // Once the handover has happened the old password is already invalid, so closing the result cannot leave the
  // session open: both ways out end on the login screen.
  const finishHandover = () => {
    setSavedUsername(handover.username);
    clearSession();
    navigate("/", { replace: true });
  };

  const handleClose = () => {
    if (isSubmitting) return;
    if (handover) {
      finishHandover();
      return;
    }
    onClose();
  };

  useEscapeKey(handleClose);

  const handleFieldChange = (setter) => (e) => {
    setter(e.target.value);
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateTransferForm(newPerson, newUsername, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    // The try wraps the call alone, as on the setup screen: the success branch shows two values never shown
    // again, and the handover has already happened, so a throw inside it would lose the codes.
    let res;
    try {
      res = await window.electronAPI.transferAccount({ userId, password, newPerson, newUsername });
    } catch (err) {
      console.error("[TransferModal] transferAccount:", err);
      setError("Hesap devredilemedi.");
      setIsSubmitting(false);
      return;
    }

    if (res.cancelled) {
      setIsSubmitting(false);
      return;
    }

    if (!res.success) {
      setError(res.message);
      setIsSubmitting(false);
      return;
    }

    setHandover(res);
    setIsSubmitting(false);
  };

  const errorId = error ? ERROR_ID : undefined;

  return (
    <div className="pf-md-overlay">
      <form className="pf-md-box" onSubmit={handleSubmit} onAnimationEnd={focusFirstField}>
        <div className="pf-md-head">
          <div className="pf-md-identity">
            <h2 className="pf-md-title">{handover ? "Devir Tamamlandı" : "Hesabı Devret"}</h2>
            <span className="pf-md-scope" title={username}>
              {username}
            </span>
          </div>
          <button
            type="button"
            className="pf-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        {handover ? (
          <div className="pf-md-body">
            <p className="pf-md-note">
              Hesap <b>{handover.managerName}</b> adına devredildi. Aşağıdaki bilgiler bir daha gösterilmeyecektir.
            </p>

            <CodeSurface label="Geçici şifre" code={handover.temporaryPassword} />
            <CodeSurface label="Yeni kurtarma kodu" code={handover.recoveryCode} />

            <dl className="pf-md-facts">
              <div className="pf-md-fact">
                <dt>Kullanıcı adı</dt>
                <dd>{handover.username}</dd>
              </div>
              <div className="pf-md-fact">
                <dt>Devir dosyası</dt>
                <dd className="pf-md-path">{handover.filePath}</dd>
              </div>
            </dl>

            <p className="pf-md-note">
              Bu bilgileri yeni yöneticiye iletin. Aynı bilgisayar kullanılacaksa doğrudan giriş yapılır, başka bir
              bilgisayar kullanılacaksa kurulum ekranındaki <b>Dosyadan yükleyin</b> bağlantısıyla devir dosyası
              seçilir. Yeni yönetici giriş yaptıktan sonra profil sayfasından kendi şifresini belirlemelidir.
            </p>

            <button type="button" className="pf-md-submit" onClick={finishHandover}>
              Giriş Ekranına Dön
            </button>
          </div>
        ) : (
          <div className="pf-md-body">
            <section className="pf-md-group" aria-labelledby="transfer-new-manager">
              <h3 className="pf-md-group-title" id="transfer-new-manager">
                Yeni Yönetici
              </h3>
              <div className="pf-md-row">
                <AuthField
                  id="transfer-person"
                  label="Ad Soyad"
                  icon={FiUser}
                  placeholder="Örn. Ahmet Yılmaz"
                  autoComplete="off"
                  value={newPerson}
                  ref={firstFieldRef}
                  onChange={handleFieldChange(setNewPerson)}
                  errorId={errorId}
                />
                <AuthField
                  id="transfer-username"
                  label="Kullanıcı Adı"
                  icon={FiLogIn}
                  placeholder="Örn. ahmetyilmaz"
                  autoComplete="off"
                  spellCheck={false}
                  value={newUsername}
                  onChange={handleFieldChange(setNewUsername)}
                  errorId={errorId}
                />
              </div>
            </section>

            <section className="pf-md-group" aria-labelledby="transfer-confirm">
              <h3 className="pf-md-group-title" id="transfer-confirm">
                Onay
              </h3>
              <AuthField
                id="transfer-password"
                label="Mevcut Şifreniz"
                icon={FiLock}
                type="password"
                autoComplete="current-password"
                placeholder="Devri onaylamak için şifrenizi girin"
                value={password}
                onChange={handleFieldChange(setPassword)}
                errorId={errorId}
              />
            </section>

            <ul className="pf-md-outcomes">
              {OUTCOMES.map(({ icon: Icon, text, danger }) => (
                <li key={text} className={danger ? "pf-md-outcome pf-md-outcome--danger" : "pf-md-outcome"}>
                  <span className="pf-md-outcome-mark" aria-hidden="true">
                    <Icon />
                  </span>
                  {text}
                </li>
              ))}
            </ul>

            {error && (
              <p className="pf-md-error" id={ERROR_ID} role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="pf-md-submit pf-md-submit--danger"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Devrediliyor..." : "Hesabı Devret"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

export default TransferModal;
