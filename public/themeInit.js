// Resolves the theme before the first paint and writes it onto the root element, or anyone on the light theme
// sees a dark frame at every launch. A classic script, since a module would be deferred and run too late.
// The key is spelled out again in the theme hook, the two module systems cannot share a constant.
(function () {
  const THEME_KEY = "theme";

  const stored = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";

  document.documentElement.setAttribute("data-theme", theme);
})();
