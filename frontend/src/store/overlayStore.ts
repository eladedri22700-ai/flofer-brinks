import { create } from "zustand";

/**
 * Shared field-flow overlays (stop-detail sheet, full-round sheet). Mounted
 * once in AppLayout so any screen (Day timeline, Live's "הרשימה" button,
 * Board's stop rows, …) can open the same sheet without prop-drilling.
 */
type OverlayState = {
  detailStopId: number | null;
  fullListOpen: boolean;
  openDetail: (stopId: number) => void;
  closeDetail: () => void;
  openFullList: () => void;
  closeFullList: () => void;
};

export const useOverlayStore = create<OverlayState>((set) => ({
  detailStopId: null,
  fullListOpen: false,
  openDetail: (stopId) => set({ detailStopId: stopId, fullListOpen: false }),
  closeDetail: () => set({ detailStopId: null }),
  openFullList: () => set({ fullListOpen: true }),
  closeFullList: () => set({ fullListOpen: false }),
}));
