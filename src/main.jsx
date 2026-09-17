import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { loadAccountState } from "./hooks/useSession";
import "./global.css";

// Awaited before the root is created, not inside an effect. The setup decision is then made synchronously in
// the first render, so the first paint is already the right screen instead of a loading frame and a fix.
await loadAccountState();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
