import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { loadAccountState } from "./hooks/session";
import "./style.css";

await loadAccountState();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
