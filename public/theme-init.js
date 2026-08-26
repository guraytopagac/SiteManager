// Runs before the first paint so a light theme user never sees the dark default from style.css.
// It has to be a plain script in public/, because a module in src/ is deferred and would run only
// after that paint. The storage key is mirrored in src/hooks/useTheme.js, which owns writing it.
(function () {
  const stored = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";

  document.documentElement.setAttribute("data-theme", theme);
})();
