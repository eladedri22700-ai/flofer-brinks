import { create } from "zustand";

/**
 * "Driving mode" (binding rule #2 of the field-flow redesign): while a stop
 * is actively being driven to / worked at / reported as an exception, the
 * app chrome (bottom nav, brand bar, HUD) must disappear — two big actions,
 * nothing else. LivePage owns this because it's the only place that knows
 * whether the current stop is pending/arrived/mid-exception; AppLayout just
 * reads it.
 */
type ChromeState = {
  drivingLocked: boolean;
  setDrivingLocked: (locked: boolean) => void;
};

export const useChromeStore = create<ChromeState>((set) => ({
  drivingLocked: false,
  setDrivingLocked: (locked) => set({ drivingLocked: locked }),
}));
