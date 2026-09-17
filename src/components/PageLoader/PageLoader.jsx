import { useEffect, useState } from "react";
import "./PageLoader.css";

// Delayed on purpose so a fast route swap never flashes a loader. In practice it only appears on the very
// first launch, when there is no previous screen to hold on the display while the next one suspends.
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
