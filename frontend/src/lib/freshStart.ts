import { clearOnboarding } from "./onboarding";
import { clearSavedLogin } from "./savedLogin";
import { markSandbox } from "./sandbox";

const TOKEN_KEY = "rm_token";
const USER_KEY = "rm_user";
const LEGACY_KILLED_KEY = "flofer_v3_relogin_done";

export function isFreshQuery(): boolean {
  try {
    const q = new URLSearchParams(window.location.search);
    const v = (q.get("fresh") || q.get("reset") || "").toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  } catch {
    return false;
  }
}

/**
 * Hard reset for Daniel's pilot link: no leftover session, no skipped tour,
 * no auto-login from a previous demo on this phone.
 */
export function applyFreshStart(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("rm_saved_login");
    clearSavedLogin();
    clearOnboarding("FLOFER");
    markSandbox(false);
  } catch {
    /* ignore */
  }
}

/**
 * One-time: old v1/v2 "tour done" + leftover demo session caused Daniel to
 * skip login and guidance. Wipe once per device after this upgrade.
 */
export function killLegacySkipOnce(): boolean {
  try {
    if (localStorage.getItem(LEGACY_KILLED_KEY) === "1") return false;
    const hadLegacy =
      Boolean(localStorage.getItem("flofer_onboarding_v1")) ||
      Boolean(localStorage.getItem("flofer_onboarding_v2")) ||
      localStorage.getItem(TOKEN_KEY) === "demo";
    localStorage.removeItem("flofer_onboarding_v1");
    localStorage.removeItem("flofer_onboarding_v2");
    if (hadLegacy || localStorage.getItem(TOKEN_KEY)) {
      // Force password screen + full v3 tour for any leftover pilot session.
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem("rm_saved_login");
      clearOnboarding("FLOFER");
    }
    localStorage.setItem(LEGACY_KILLED_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** Remove fresh/reset from the URL so refresh does not wipe again mid-session. */
export function stripFreshFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("fresh") && !url.searchParams.has("reset")) return;
    url.searchParams.delete("fresh");
    url.searchParams.delete("reset");
    // Keep user=FLOFER if present for login prefill.
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  } catch {
    /* ignore */
  }
}
