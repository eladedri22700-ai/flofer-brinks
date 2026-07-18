import { create } from "zustand";

export type TourPlanTab = "manual" | "file" | "shot" | "library";

type TourUiState = {
  active: boolean;
  stepId: string | null;
  planTab: TourPlanTab | null;
  setActive: (active: boolean) => void;
  setStepId: (stepId: string | null) => void;
  setPlanTab: (tab: TourPlanTab | null) => void;
};

export const useTourStore = create<TourUiState>((set) => ({
  active: false,
  stepId: null,
  planTab: null,
  setActive: (active) => set({ active }),
  setStepId: (stepId) => set({ stepId }),
  setPlanTab: (planTab) => set({ planTab }),
}));
