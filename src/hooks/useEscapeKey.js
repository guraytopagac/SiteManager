// The single owner of the Escape close path, called by every modal with its own close function. Clicking the
// overlay deliberately closes nothing, so Escape and the close button are the only two ways out.

import { useEffect, useRef } from "react";
import { isDialogOpen } from "@/utils/dialog";

export function useEscapeKey(onEscape) {
  // Read through a ref because the caller's close function is rebuilt on every keystroke, and binding the
  // listener again on each render would tear down and reattach it constantly.
  const escapeRef = useRef(onEscape);

  useEffect(() => {
    escapeRef.current = onEscape;
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      // A confirmation opened from inside a modal sits on top of it, and Escape must close only the
      // topmost layer, otherwise one key press would take the answer and the form with it.
      if (isDialogOpen()) return;
      escapeRef.current();
    };

    // Bound to the document because clicking a blank part of the box moves focus to the body, and a
    // handler attached to the overlay would never fire from there.
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
