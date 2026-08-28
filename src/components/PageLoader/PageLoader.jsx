import { useEffect, useState } from "react";
import "./PageLoader.css";

function PageLoader({ message = "Yükleniyor...", delay = 150 }) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return undefined;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;

  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="page-loader-spinner" aria-hidden="true" />
      <p className="page-loader-text">{message}</p>
    </div>
  );
}

export default PageLoader;
