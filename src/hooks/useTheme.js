import { useState, useEffect } from "react";

const THEME_KEY = "theme";
const VALID_THEMES = ["light", "dark"];

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme =
    saved && VALID_THEMES.includes(saved)
      ? saved
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.setAttribute("data-theme", theme);
  return theme;
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const handleThemeToggle = () => {
      setTheme((prev) => {
        const next = prev === "light" ? "dark" : "light";
        localStorage.setItem(THEME_KEY, next);
        return next;
      });
    };
    const removeListener = window.electronAPI.onToggleTheme(handleThemeToggle);
    return () => removeListener();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return theme;
}
