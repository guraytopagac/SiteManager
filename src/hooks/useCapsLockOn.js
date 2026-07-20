import { useEffect, useState } from "react";

const SYNC_EVENTS = ["keydown", "keyup", "mousedown"];

export function useCapsLockOn() {
  const [isOn, setIsOn] = useState(false);

  useEffect(() => {
    const sync = (e) => {
      if (typeof e.getModifierState === "function") {
        setIsOn(e.getModifierState("CapsLock"));
      }
    };

    SYNC_EVENTS.forEach((type) => document.addEventListener(type, sync));
    return () => SYNC_EVENTS.forEach((type) => document.removeEventListener(type, sync));
  }, []);

  return isOn;
}
