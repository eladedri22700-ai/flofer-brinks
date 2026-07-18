/** Isolated tester sandbox — never shares session with FLOFER (Daniel). */

export const SANDBOX_USERNAME = "TEST";
export const SANDBOX_PASSWORD = "1234";
export const SANDBOX_FLAG_KEY = "rm_sandbox";

export function isSandboxQuery(): boolean {
  try {
    const q = new URLSearchParams(window.location.search);
    const mode = (q.get("sandbox") || q.get("mode") || "").toLowerCase();
    return mode === "1" || mode === "true" || mode === "test";
  } catch {
    return false;
  }
}

export function isSandboxActive(): boolean {
  if (isSandboxQuery()) return true;
  try {
    return localStorage.getItem(SANDBOX_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSandbox(on: boolean): void {
  try {
    if (on) localStorage.setItem(SANDBOX_FLAG_KEY, "1");
    else localStorage.removeItem(SANDBOX_FLAG_KEY);
  } catch {
    /* ignore */
  }
}

export function isSandboxUser(username: string | null | undefined): boolean {
  if (!username) return false;
  const u = username.toLowerCase();
  return u === "test" || u === "elad" || u === "leader";
}
