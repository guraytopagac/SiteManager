import { useEffect, useState } from "react";

export function useNeedsSetup() {
  const [needsSetup, setNeedsSetup] = useState(null);

  useEffect(() => {
    let isMounted = true;
    window.electronAPI
      .getSetupState()
      .then((res) => {
        if (isMounted) setNeedsSetup(Boolean(res?.needsSetup));
      })
      .catch(() => {
        if (isMounted) setNeedsSetup(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return needsSetup;
}
