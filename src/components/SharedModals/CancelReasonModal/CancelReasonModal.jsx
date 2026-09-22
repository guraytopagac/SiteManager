// The reason asked before a record is cancelled, shared by the three screens that cancel something. It opens
// on top of another modal, so the caller keeps its own box open until onConfirm reports success.

import { useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import "./CancelReasonModal.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";

const ERROR_ID = "cancel-reason-error";
const MAX_REASON_LENGTH = 300;

function CancelReasonModal({ title, scope, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fieldRef = useRef(null);

  // Focus waits for the opening animation, as in the profile modals: focusing in the same frame moves a field
  // inside a box that is still being painted.
  const focusField = (e) => {
    if (e.target !== e.currentTarget || e.currentTarget.contains(document.activeElement)) return;
    fieldRef.current.focus();
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  useEscapeKey(handleClose);

  const handleChange = (e) => {
    setReason(e.target.value);
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmed = reason.trim();
    if (!trimmed) {
      setError("İptal nedeni zorunludur.");
      return;
    }

    setIsSubmitting(true);
    try {
      const isDone = await onConfirm(trimmed);
      if (isDone) return;
    } catch (err) {
      console.error("[CancelReasonModal] onConfirm:", err);
      setError(UNEXPECTED_ERROR_MESSAGE);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="cr-md-overlay">
      <form className="cr-md-box" onSubmit={handleSubmit} onAnimationEnd={focusField}>
        <div className="cr-md-head">
          <div className="cr-md-identity">
            <h2 className="cr-md-title">{title}</h2>
            {scope && (
              <span className="cr-md-scope" title={scope}>
                {scope}
              </span>
            )}
          </div>
          <button
            type="button"
            className="cr-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="cr-md-body">
          <div className="cr-md-field">
            <label htmlFor="cancel-reason">İptal Nedeni</label>
            <textarea
              id="cancel-reason"
              ref={fieldRef}
              value={reason}
              onChange={handleChange}
              maxLength={MAX_REASON_LENGTH}
              placeholder="Örn. Ödeme yanlış daireye işlendi"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? ERROR_ID : undefined}
            />
          </div>

          {error && (
            <p className="cr-md-error" id={ERROR_ID} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="cr-md-submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "İptal Ediliyor..." : "Evet, İptal Et"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CancelReasonModal;
