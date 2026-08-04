import { useEffect, useLayoutEffect, useState } from "react";

const THEME_KEY = "theme";
const VALID_THEMES = ["light", "dark"];

function getInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (VALID_THEMES.includes(savedTheme)) {
    return savedTheme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

let currentTheme = getInitialTheme();
const listeners = new Set();

export function toggleTheme() {
  currentTheme = currentTheme === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, currentTheme);
  listeners.forEach((listener) => listener(currentTheme));
}

window.electronAPI?.onToggleTheme(toggleTheme);

export function useTheme() {
  const [theme, setTheme] = useState(currentTheme);

  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    listeners.add(setTheme);
    return () => {
      listeners.delete(setTheme);
    };
  }, []);

  return { theme, toggleTheme };
}
