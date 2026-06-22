import { memo, useCallback, useEffect, useRef, useState } from "react";
import "./Footer.css";

const YEAR = new Date().getFullYear();

const Footer = memo(function Footer() {
  const [version, setVersion] = useState(null);
  const footerRef = useRef(null);

  useEffect(() => {
    window.electronAPI?.getAppVersion?.().then(setVersion).catch(() => setVersion(""));
  }, []);

  const handleAnimationEnd = useCallback(() => {
    footerRef.current?.classList.add("loaded");
  }, []);

  return (
    <footer ref={footerRef} className="footer" aria-label="Uygulama alt bilgisi" onAnimationEnd={handleAnimationEnd}>
      <p>
        Mavikent Site Yönetimi Uygulaması © {YEAR}
        {version === null ? " · ···" : version ? ` · v${version}` : ""}
      </p>
    </footer>
  );
});

export default Footer;
