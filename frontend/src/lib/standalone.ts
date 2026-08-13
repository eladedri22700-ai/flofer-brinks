import { isStandaloneDisplay } from "./onboarding";

export function syncThemeColor(theme?: string | null): void {
  if (typeof document === "undefined") return;
  const dark =
    theme === "dark" || document.documentElement.dataset.theme === "dark";
  const standalone = isStandaloneDisplay();
  const color = dark || standalone ? "#0b1f3a" : "#e8eef6";
  let meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
}

/** Mark the document as a home-screen app so CSS can drop browser chrome feel. */
export function applyStandaloneMode(): boolean {
  if (typeof document === "undefined") return false;
  const on = isStandaloneDisplay();
  const root = document.documentElement;
  if (on) {
    root.dataset.standalone = "1";
    root.classList.add("is-standalone");
  } else {
    delete root.dataset.standalone;
    root.classList.remove("is-standalone");
  }
  syncThemeColor();
  return on;
}
