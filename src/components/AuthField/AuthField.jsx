import { useEffect, useState } from "react";
import { FiAlertTriangle, FiEye, FiEyeOff } from "react-icons/fi";
import "./AuthField.css";

const CAPS_LOCK_MESSAGE = "Caps Lock tuşu açık, şifreniz büyük harfle yazılıyor.";
const CAPS_LOCK_EVENTS = ["keydown", "keyup", "mousedown"];

let isCapsLockOn = false;
const capsLockListeners = new Set();

function syncCapsLock(e) {
  const next = e.getModifierState("CapsLock");
  if (next === isCapsLockOn) return;
  isCapsLockOn = next;
  capsLockListeners.forEach((listener) => listener(isCapsLockOn));
}

CAPS_LOCK_EVENTS.forEach((type) => document.addEventListener(type, syncCapsLock));

function useCapsLockOn() {
  const [isOn, setIsOn] = useState(isCapsLockOn);

  useEffect(() => {
    capsLockListeners.add(setIsOn);
    return () => {
      capsLockListeners.delete(setIsOn);
    };
  }, []);

  return isOn;
}

function CapsLockBadge() {
  const isOn = useCapsLockOn();

  if (!isOn) return null;

  return (
    <span className="af-caps" role="img" aria-label={CAPS_LOCK_MESSAGE} title={CAPS_LOCK_MESSAGE}>
      <FiAlertTriangle size={15} />
      Büyük Harf
    </span>
  );
}

function AuthField({
  id,
  label,
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
  autoFocus = false,
  spellCheck,
  hint,
  errorId,
  ref,
}) {
  const [isVisible, setIsVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && isVisible ? "text" : type;

  return (
    <div className="af-field">
      <div className="af-wrapper">
        <Icon className="af-icon" size={18} />
        <input
          id={id}
          ref={ref}
          className={isPassword ? "af-input af-input-with-toggle" : "af-input"}
          type={inputType}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          spellCheck={spellCheck}
          value={value}
          onChange={onChange}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={errorId}
          required
        />
        <label className="af-float-label" htmlFor={id}>
          {label}
        </label>
        {isPassword && (
          <>
            <CapsLockBadge />
            <button
              type="button"
              className="af-toggle"
              onClick={() => setIsVisible((visible) => !visible)}
              aria-label={isVisible ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {isVisible ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </>
        )}
      </div>
      {hint && <p className="af-hint">{hint}</p>}
    </div>
  );
}

export default AuthField;
