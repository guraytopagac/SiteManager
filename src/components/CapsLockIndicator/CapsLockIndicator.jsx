import { FiAlertTriangle } from "react-icons/fi";
import { useCapsLockOn } from "@/hooks/useCapsLockOn";
import "./CapsLockIndicator.css";

const CAPS_LOCK_MESSAGE = "Caps Lock tuşu açık, şifreniz büyük harfle yazılıyor.";

function CapsLockIndicator() {
  const capsLockState = useCapsLockOn();

  if (!capsLockState) return null;

  return (
    <span
      className="caps-indicator"
      role="img"
      aria-label={CAPS_LOCK_MESSAGE}
      title={CAPS_LOCK_MESSAGE}
    >
      <FiAlertTriangle size={15} />
      Büyük Harf
    </span>
  );
}

export default CapsLockIndicator;
