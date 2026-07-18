/** Device-local remembered login (pilot convenience). */

const KEY = "rm_saved_login";

export type SavedLogin = {
  username: string;
  password: string;
};

export function readSavedLogin(): SavedLogin | null {
  try {
    const raw = localStorage.getItem(KEY);
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
    KEY,
    JSON.stringify({
      username: username.trim(),
      password,
    } satisfies SavedLogin),
  );
}

export function clearSavedLogin(): void {
  localStorage.removeItem(KEY);
}
