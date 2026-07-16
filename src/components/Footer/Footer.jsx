import { useEffect, useState } from "react";
import { FiSun, FiMoon } from "react-icons/fi";
import { useTheme } from "../../hooks/useTheme.js";
import { showAlert } from "../../utils/alert.js";
import { formatDate, getToday } from "../../utils/format.js";
import { RELEASE_NOTES } from "../../utils/releaseNotes.js";
import "./Footer.css";

const CURRENT_YEAR = getToday().slice(0, 4);

const RELEASE_NOTES_HTML = `<div class="release-notes">${RELEASE_NOTES.map(
  (release) => `
      <section class="release-note">
        <h3 class="release-note-version">
          <span>v${release.version} — ${release.title}</span>
          ${release.date ? `<time class="release-note-date" datetime="${release.date}">${formatDate(release.date)}</time>` : ""}
        </h3>
        <ul class="release-note-list">
          ${release.changes.map((change) => `<li>${change}</li>`).join("")}
        </ul>
      </section>`,
).join("")}</div>`;

function Footer() {
  const [version, setVersion] = useState(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    window.electronAPI
      ?.getAppVersion()
      .then(setVersion)
      .catch(() => setVersion(""));
  }, []);

  const showReleaseNotes = () => showAlert.info("Sürüm Notları", RELEASE_NOTES_HTML);

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
            title="Sürüm notlarını gör"
            aria-label={`Sürüm ${version} — sürüm notlarını gör`}
          >
            v{version}
          </button>
        )}
      </div>
    </footer>
  );
}

export default Footer;
