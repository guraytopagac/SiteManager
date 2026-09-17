// Clipboard write plus the temporary confirmation label, shared by the two screens that show a value once.
// Only the timing is shared: copy returns a boolean and each screen writes its own failure text.

import { useEffect, useRef, useState } from "react";

const COPY_FEEDBACK_MS = 5000;

export function useCopyFeedback() {
  const [isCopied, setIsCopied] = useState(false);
  const resetTimer = useRef(null);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("[useCopyFeedback] copy:", err);
      return false;
    }
    setIsCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setIsCopied(false), COPY_FEEDBACK_MS);
    return true;
  };

  return { isCopied, copy };
}
