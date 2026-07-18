export const ONBOARDING_KEY = "flofer_onboarding_v2";

export type OnboardingState = {
  /** Fully finished: permissions + live tour + switched to real mode */
  done: boolean;
  /** Install / location / notifications finished */
  permissionsDone: boolean;
  installSeen: boolean;
  locationOk: boolean | null;
  notifyOk: boolean | null;
  completedAt?: string;
};

const EMPTY: OnboardingState = {
  done: false,
  permissionsDone: false,
  installSeen: false,
  locationOk: null,
  notifyOk: null,
};

function migrateLegacy(): OnboardingState | null {
  try {
    const legacy = localStorage.getItem("flofer_onboarding_v1");
    if (!legacy) return null;
    const old = JSON.parse(legacy) as {
      done?: boolean;
      installSeen?: boolean;
      locationOk?: boolean | null;
      notifyOk?: boolean | null;
      completedAt?: string;
    };
    // Veterans who already finished v1 skip the new tour (field pilots).
    if (old.done) {
      return {
        done: true,
        permissionsDone: true,
        installSeen: Boolean(old.installSeen),
        locationOk: old.locationOk ?? null,
        notifyOk: old.notifyOk ?? null,
        completedAt: old.completedAt,
      };
    }
    return {
      done: false,
      permissionsDone: false,
      installSeen: Boolean(old.installSeen),
      locationOk: old.locationOk ?? null,
      notifyOk: old.notifyOk ?? null,
    };
  } catch {
    return null;
  }
}

export function readOnboarding(): OnboardingState {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) {
      const migrated = migrateLegacy();
      if (migrated) {
        localStorage.setItem(ONBOARDING_KEY, JSON.stringify(migrated));
        return migrated;
      }
      return { ...EMPTY };
    }
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      ...EMPTY,
      ...parsed,
      done: Boolean(parsed.done),
      permissionsDone: Boolean(parsed.permissionsDone || parsed.done),
    };
  } catch {
    return { ...EMPTY };
  }
}

export function writeOnboarding(patch: Partial<OnboardingState>): OnboardingState {
  const next = { ...readOnboarding(), ...patch };
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(next));
  return next;
}

export function markPermissionsDone(): void {
  writeOnboarding({ permissionsDone: true });
}

export function markOnboardingDone(): void {
  writeOnboarding({
    done: true,
    permissionsDone: true,
    completedAt: new Date().toISOString(),
  });
}

/** Restart live tour (keeps permissions). */
export function resetTourForReplay(): void {
  writeOnboarding({
    done: false,
    permissionsDone: true,
  });
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

export function detectPlatform(): "ios" | "android" | "desktop" {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}
