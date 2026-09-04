import { useEffect, useRef, useState } from "react";

const COPY_FEEDBACK_MS = 5000;

export function useCopyFeedback() {
  const [isCopied, setIsCopied] = useState(false);
  const resetTimer = useRef(null);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return false;
    }
    setIsCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setIsCopied(false), COPY_FEEDBACK_MS);
    return true;
  };

  return { isCopied, copy };
}
