// Module level single source for the theme, shaped like the session store. Keeping the value inside the hook
// would give every consumer its own copy, and one menu event would flip the theme once per subscriber.

import { useSyncExternalStore } from "react";

const THEME_KEY = "theme";

const listeners = new Set();
// Read back from the document rather than from storage: the startup script in public/ resolves the theme
// before first paint, and this module only mirrors what it already wrote.
let currentTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";

function addListener(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getTheme = () => currentTheme;

// One of exactly two places that write the data-theme attribute, the other being the startup script. Writing
// it from the hook would rewrite the same value on every mount and once per consumer on every switch.
export function toggleTheme() {
  currentTheme = currentTheme === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, currentTheme);
  document.documentElement.setAttribute("data-theme", currentTheme);
  listeners.forEach((listener) => listener());
}

// Optional chaining is required: this runs at import time, before React exists, so a throw would break the
// import chain and leave a blank window. The unsubscribe is dropped, the subscription outlives every screen.
window.electronAPI?.onToggleTheme(toggleTheme);

export function useTheme() {
  return useSyncExternalStore(addListener, getTheme);
}
