const SNOOZE_KEY = "flofer_install_snooze_until";
const DAY_SHEET_KEY = "flofer_install_sheet_day";
const SNOOZE_MS = 12 * 60 * 60 * 1000;

function todayKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

export function isInstallSnoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY) ?? "0");
    return until > Date.now();
  } catch {
    return false;
  }
}

export function snoozeInstallPrompt(): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    markInstallSheetDay();
  } catch {
    /* ignore */
  }
}

export function installSheetShownToday(): boolean {
  try {
    return localStorage.getItem(DAY_SHEET_KEY) === todayKey();
  } catch {
    return false;
  }
}

export function markInstallSheetDay(): void {
  try {
    localStorage.setItem(DAY_SHEET_KEY, todayKey());
  } catch {
    /* ignore */
  }
}
