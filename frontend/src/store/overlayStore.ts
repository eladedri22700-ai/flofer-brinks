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
  /** Field-note sheet; stopId links the note to a stop (or null for a general note). */
  feedback: { open: boolean; stopId: number | null };
  openFeedback: (stopId?: number | null) => void;
  closeFeedback: () => void;
};

export const useOverlayStore = create<OverlayState>((set) => ({
  detailStopId: null,
  fullListOpen: false,
  openDetail: (stopId) => set({ detailStopId: stopId, fullListOpen: false }),
  closeDetail: () => set({ detailStopId: null }),
  openFullList: () => set({ fullListOpen: true }),
  closeFullList: () => set({ fullListOpen: false }),
  feedback: { open: false, stopId: null },
  openFeedback: (stopId = null) =>
    set({ feedback: { open: true, stopId }, detailStopId: null, fullListOpen: false }),
  closeFeedback: () => set({ feedback: { open: false, stopId: null } }),
}));
