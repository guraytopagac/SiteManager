// What changed in the last releases, opened from the version button in the footer. Read only, so the box is a
// plain div and the only ways out are the close button and Escape.

import { FiX } from "react-icons/fi";
import "./ReleaseNotesModal.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { formatDate } from "@/utils/date";
import { RELEASE_NOTES } from "@/utils/releaseNotes";

function ReleaseNotesModal({ version, onClose }) {
  useEscapeKey(onClose);

  return (
    <div className="rn-md-overlay">
      <div className="rn-md-box" role="dialog" aria-modal="true" aria-labelledby="release-notes-title">
        <div className="rn-md-head">
          <h2 className="rn-md-title" id="release-notes-title">
            Sürüm Notları
          </h2>
          <button type="button" className="rn-md-close" onClick={onClose} aria-label="Kapat">
            <FiX />
          </button>
        </div>

        <div className="rn-md-body">
          {RELEASE_NOTES.map((release) => (
            <section className="rn-release" key={release.version}>
              <h3 className="rn-release-head">
                <span className="rn-release-title">
                  v{release.version}: {release.title}
                  {release.version === version && <span className="rn-badge">Şu anki sürüm</span>}
                </span>
                <time className="rn-date" dateTime={release.date}>
                  {formatDate(release.date)}
                </time>
              </h3>
              <ul className="rn-list">
                {release.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ReleaseNotesModal;
