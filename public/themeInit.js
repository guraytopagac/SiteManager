(function () {
  const THEME_KEY = "theme";

  const stored = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";

  document.documentElement.setAttribute("data-theme", theme);
})();
