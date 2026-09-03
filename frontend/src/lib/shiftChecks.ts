/**
 * Pre-drive shift-open checklist (design: "פתיחת משמרת"). This is a
 * client-only gate — the backend has no vehicle/team/comms-check fields —
 * so state lives in localStorage, scoped per user and per calendar day
 * (Asia/Jerusalem), same pattern as lib/onboarding.ts.
 */
const KEY_PREFIX = "flofer_shift_checks_v1";

export type ShiftChecks = {
  vehicle: boolean;
  team: boolean;
  comms: boolean;
  completedAt: string | null;
};

const EMPTY: ShiftChecks = {
  vehicle: false,
  team: false,
  comms: false,
  completedAt: null,
};

function jerusalemDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function storageKey(username?: string | null): string {
  const u = (username?.trim() || "_anon").toLowerCase();
  return `${KEY_PREFIX}_${u}_${jerusalemDateKey()}`;
}

export function readShiftChecks(username?: string | null): ShiftChecks {
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<ShiftChecks>;
    return {
      vehicle: Boolean(parsed.vehicle),
      team: Boolean(parsed.team),
      comms: Boolean(parsed.comms),
      completedAt: parsed.completedAt ?? null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function writeShiftChecks(
  patch: Partial<ShiftChecks>,
  username?: string | null,
): ShiftChecks {
  const next = { ...readShiftChecks(username), ...patch };
  localStorage.setItem(storageKey(username), JSON.stringify(next));
  return next;
}

export function isShiftOpen(checks: ShiftChecks): boolean {
  return checks.vehicle && checks.team && checks.comms;
}

export function markShiftOpened(username?: string | null): ShiftChecks {
  return writeShiftChecks(
    { vehicle: true, team: true, comms: true, completedAt: new Date().toISOString() },
    username,
  );
}
