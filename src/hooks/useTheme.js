import { useState, useEffect, useLayoutEffect } from "react";

const THEME_KEY = "theme";
const VALID_THEMES = ["light", "dark"];

function getInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (VALID_THEMES.includes(savedTheme)) {
    return savedTheme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "light" ? "dark" : "light";
      localStorage.setItem(THEME_KEY, nextTheme);
      return nextTheme;
    });
  };

  useEffect(() => {
    const removeListener = window.electronAPI?.onToggleTheme(toggleTheme);
    return () => removeListener?.();
  }, []);

  return { theme, toggleTheme };
}
