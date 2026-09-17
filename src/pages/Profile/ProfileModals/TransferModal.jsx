// Handing the account to someone else. The target computer is not asked: this machine is locked to the new
// credentials either way, and the file is the new manager's way onto another computer or just a backup.

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiDownload, FiKey, FiLock, FiLogIn, FiLogOut, FiUser, FiX } from "react-icons/fi";
import "./ProfileModals.css";
import AuthField from "@/components/AuthField/AuthField";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { clearSession, setSavedUsername } from "@/hooks/useSession";
import { showDialog } from "@/utils/dialog";

const ERROR_ID = "transfer-modal-error";

// Sits just above the button, so it is read at the moment the decision is made. Each line was measured to
// fit on one line of text, so a longer sentence wraps.
const OUTCOMES = [
  { icon: FiDownload, text: "Tüm kayıtlar, seçeceğiniz yere devir dosyası olarak kaydedilir." },
  { icon: FiKey, text: "Yeni yönetici için geçici şifre ve kurtarma kodu bir kez gösterilir." },
  { icon: FiLogOut, text: "Şifreniz geçersiz olur. Bu işlem geri alınamaz.", danger: true },
];

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
  const firstFieldRef = useRef(null);

  const focusFirstField = (e) => {
    if (e.target !== e.currentTarget || e.currentTarget.contains(document.activeElement)) return;
    firstFieldRef.current.focus();
  };

  const handleClose = () => {
    if (isSubmitting) return;
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

    await showDialog.temporaryPassword({
      managerName: res.managerName,
      username: res.username,
      code: res.temporaryPassword,
      filePath: res.filePath,
    });
    await showDialog.transferredRecoveryCode(res.recoveryCode);
    setSavedUsername(res.username);
    clearSession();
    navigate("/", { replace: true });
  };

  const errorId = error ? ERROR_ID : undefined;

  return (
    <div className="pf-md-overlay">
      <form className="pf-md-box" onSubmit={handleSubmit} onAnimationEnd={focusFirstField}>
        <div className="pf-md-head">
          <div className="pf-md-identity">
            <h2 className="pf-md-title">Hesabı Devret</h2>
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
      </form>
    </div>
  );
}

export default TransferModal;
