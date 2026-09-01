import { useEffect, useState } from "react";
import "./PageLoader.css";

const DELAY_MS = 150;

function PageLoader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="page-loader" role="status">
      <div className="page-loader-spinner" aria-hidden="true" />
      <p className="page-loader-text">Sayfa yükleniyor...</p>
    </div>
  );
}

export default PageLoader;
