import { useSyncExternalStore } from "react";

const THEME_KEY = "theme";

const listeners = new Set();
let currentTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";

function addListener(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getTheme = () => currentTheme;

export function toggleTheme() {
  currentTheme = currentTheme === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, currentTheme);
  document.documentElement.setAttribute("data-theme", currentTheme);
  listeners.forEach((listener) => listener());
}

window.electronAPI?.onToggleTheme(toggleTheme);

export function useTheme() {
  return useSyncExternalStore(addListener, getTheme);
}
