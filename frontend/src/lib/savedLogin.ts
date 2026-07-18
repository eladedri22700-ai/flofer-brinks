/** Device-local remembered login. Sandbox uses a separate key from FLOFER. */

import { isSandboxActive } from "./sandbox";

export type SavedLogin = {
  username: string;
  password: string;
};

const KEY_PILOT = "rm_saved_login";
const KEY_SANDBOX = "rm_saved_login_sandbox";

function storageKey(): string {
  return isSandboxActive() ? KEY_SANDBOX : KEY_PILOT;
}

export function readSavedLogin(): SavedLogin | null {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedLogin>;
    if (
      typeof parsed.username === "string" &&
      parsed.username.trim() &&
      typeof parsed.password === "string" &&
      parsed.password
    ) {
      return {
        username: parsed.username.trim(),
        password: parsed.password,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeSavedLogin(username: string, password: string): void {
  localStorage.setItem(
    storageKey(),
    JSON.stringify({
      username: username.trim(),
      password,
    } satisfies SavedLogin),
  );
}

export function clearSavedLogin(): void {
  localStorage.removeItem(storageKey());
}
