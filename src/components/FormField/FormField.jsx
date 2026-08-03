import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import CapsLockIndicator from "@/components/CapsLockIndicator/CapsLockIndicator";
import "./FormField.css";

function FormField({
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
}) {
  const [isVisible, setIsVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && isVisible ? "text" : type;

  return (
    <div className="ff-field">
      <div className="ff-wrapper">
        <Icon className="ff-icon" size={18} />
        <input
          id={id}
          className={isPassword ? "ff-input ff-input-with-toggle" : "ff-input"}
          type={inputType}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          spellCheck={spellCheck}
          value={value}
          onChange={onChange}
          required
        />
        <label className="ff-float-label" htmlFor={id}>
          {label}
        </label>
        {isPassword && <CapsLockIndicator />}
        {isPassword && (
          <button
            type="button"
            className="ff-toggle"
            onClick={() => setIsVisible((visible) => !visible)}
            aria-label={isVisible ? "Şifreyi gizle" : "Şifreyi göster"}
          >
            {isVisible ? <FiEyeOff size={18} /> : <FiEye size={18} />}
          </button>
        )}
      </div>
      {hint && <p className="ff-hint">{hint}</p>}
    </div>
  );
}

export default FormField;
