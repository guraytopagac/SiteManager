import { useState, useEffect } from "react";

const THEME_KEY = "theme";
const VALID_THEMES = ["light", "dark"];

function getInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const theme = VALID_THEMES.includes(savedTheme)
    ? savedTheme
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
      setTheme((currentTheme) => {
        const nextTheme = currentTheme === "light" ? "dark" : "light";
        localStorage.setItem(THEME_KEY, nextTheme);
        document.documentElement.setAttribute("data-theme", nextTheme);
        return nextTheme;
      });
    };
    const removeListener = window.electronAPI.onToggleTheme(handleThemeToggle);
    return () => removeListener();
  }, []);

  return theme;
}
