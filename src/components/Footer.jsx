import { useEffect, useState } from "react";
import "./Footer.css";

function Footer() {
  const [version, setVersion] = useState(null);

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
      <span className="footer-version">{version === null ? "···" : version ? `v${version}` : ""}</span>
    </footer>
  );
}

export default Footer;
