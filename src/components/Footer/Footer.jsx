import { useEffect, useState } from "react";
import { FiSun, FiMoon } from "react-icons/fi";
import { useTheme } from "../../hooks/useTheme.js";
import { showAlert } from "../../utils/alert.js";
import { getCurrentYear } from "../../utils/date.js";
import { hasUnseenReleaseNotes, markReleaseNotesSeen, renderReleaseNotesHtml } from "../../utils/releaseNotes.js";
import "./Footer.css";

const CURRENT_YEAR = getCurrentYear();

function Footer() {
  const [version, setVersion] = useState(null);
  const [hasUnseen, setHasUnseen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    window.electronAPI
      ?.getAppVersion()
      .then((appVersion) => {
        setVersion(appVersion);
        setHasUnseen(hasUnseenReleaseNotes(appVersion));
      })
      .catch(() => setVersion(""));
  }, []);

  const showReleaseNotes = () => {
    markReleaseNotesSeen(version);
    setHasUnseen(false);
    return showAlert.info("Sürüm Notları", renderReleaseNotesHtml(version));
  };

  return (
    <footer className="footer" aria-label="Uygulama alt bilgisi">
      <span className="footer-copyright">© {CURRENT_YEAR} Güray Topağaç</span>
      <span className="footer-title">Mavikent Site Yönetimi</span>
      <div className="footer-right">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
        >
          <span key={theme} className="theme-toggle-icon">
            {theme === "dark" ? <FiSun size={16} /> : <FiMoon size={16} />}
          </span>
          <span className="theme-toggle-label">{theme === "dark" ? "Açık Tema" : "Koyu Tema"}</span>
        </button>
        {version && (
          <button
            className="footer-version"
            onClick={showReleaseNotes}
            title={hasUnseen ? "Bu sürümde neler değişti?" : "Sürüm notlarını gör"}
            aria-label={`Sürüm ${version} — sürüm notlarını gör${hasUnseen ? " (yeni)" : ""}`}
          >
            v{version}
            {hasUnseen && <span className="footer-version-dot" aria-hidden="true" />}
          </button>
        )}
      </div>
    </footer>
  );
}

export default Footer;
