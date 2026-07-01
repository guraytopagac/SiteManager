import { useEffect, useState } from "react";
import { FiSun, FiMoon } from "react-icons/fi";
import { useTheme } from "../hooks/useTheme.js";
import "./Footer.css";

function Footer() {
  const [version, setVersion] = useState(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    window.electronAPI
      ?.getAppVersion()
      .then(setVersion)
      .catch(() => setVersion(""));
  }, []);

  return (
    <footer className="footer" aria-label="Uygulama alt bilgisi">
      <span className="footer-copyright">© {new Date().getFullYear()} Mavikent</span>
      <span className="footer-title">Mavikent Site Yönetimi</span>
      <div className="footer-right">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
        >
          <span className="theme-toggle-icon">
            {theme === "dark" ? <FiSun size={14} /> : <FiMoon size={14} />}
          </span>
          <span className="theme-toggle-label">{theme === "dark" ? "Açık Tema" : "Koyu Tema"}</span>
        </button>
        {version && <span className="footer-version">v{version}</span>}
      </div>
    </footer>
  );
}

export default Footer;
