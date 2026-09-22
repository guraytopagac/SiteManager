// Draws whatever the dialog store holds: the queued message box and the toasts. Mounted once from App, so a
// page never renders a dialog itself and a second one waits its turn instead of replacing the first.

import { useEffect, useRef } from "react";
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle } from "react-icons/fi";
import "./DialogHost.css";
import { closeDialog, useDialogState } from "./dialogStore";

const TONES = {
  error: { icon: FiAlertCircle, confirmClass: "dlg-btn--primary" },
  warning: { icon: FiAlertTriangle, confirmClass: "dlg-btn--primary" },
  danger: { icon: FiAlertTriangle, confirmClass: "dlg-btn--danger" },
};

function DialogBox({ dialog }) {
  const confirmRef = useRef(null);
  const openerRef = useRef(null);
  const tone = TONES[dialog.tone];
  const isConfirm = Boolean(dialog.confirmText);

  // Focus moves to the confirming button and returns to whatever opened the dialog, because a dialog raised
  // from inside a modal must not leave the focus on the body when it closes. The dialog itself is the
  // dependency, so a queued one that takes over this box runs the same handover instead of keeping the focus
  // the box it replaced had left behind.
  useEffect(() => {
    openerRef.current = document.activeElement;
    confirmRef.current.focus();
    return () => {
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [dialog]);

  // Escape answers with the cancelling result, clicking the backdrop answers with nothing: a stray click must
  // not decide anything, which is the same rule the modals follow.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") closeDialog(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="dlg-overlay">
      <div
        className="dlg-box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dlg-title"
        aria-describedby={dialog.body ? "dlg-body" : undefined}
      >
        <span className={`dlg-mark dlg-mark--${dialog.tone}`} aria-hidden="true">
          <tone.icon />
        </span>

        <h2 className="dlg-title" id="dlg-title">
          {dialog.title}
        </h2>

        {dialog.body && (
          <p className="dlg-body" id="dlg-body">
            {dialog.body}
          </p>
        )}

        <div className="dlg-actions">
          {isConfirm && (
            <button type="button" className="dlg-btn dlg-btn--ghost" onClick={() => closeDialog(false)}>
              {dialog.cancelText}
            </button>
          )}
          <button
            type="button"
            ref={confirmRef}
            className={`dlg-btn ${tone.confirmClass}`}
            onClick={() => closeDialog(true)}
          >
            {isConfirm ? dialog.confirmText : "Tamam"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DialogHost() {
  const { queue, toasts } = useDialogState();
  const dialog = queue[0];

  return (
    <>
      {dialog && <DialogBox dialog={dialog} />}

      {toasts.length > 0 && (
        <div className="dlg-toasts" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div className="dlg-toast" key={toast.id}>
              <span className="dlg-toast-mark" aria-hidden="true">
                <FiCheckCircle />
              </span>
              <span className="dlg-toast-text">
                <span className="dlg-toast-title">{toast.title}</span>
                {toast.body && <span className="dlg-toast-body">{toast.body}</span>}
              </span>
              <span className="dlg-toast-timer" aria-hidden="true" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default DialogHost;
