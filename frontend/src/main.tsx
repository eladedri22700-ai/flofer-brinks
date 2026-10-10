import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyStandaloneMode } from "./lib/standalone";
import { startServiceWorker } from "./lib/sw";
import "./styles/global.css";

applyStandaloneMode();
startServiceWorker();
window.matchMedia("(display-mode: standalone)").addEventListener("change", () => {
  applyStandaloneMode();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
