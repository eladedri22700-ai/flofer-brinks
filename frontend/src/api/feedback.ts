import { apiFetch } from "./client";

export type FeedbackCategory = "field_data" | "bug" | "idea";

export type FeedbackResult = {
  id: number;
  summary_he: string | null;
  applied: string[];
  forwarded: boolean;
  status: string;
};

export const sendFeedback = (body: {
  text: string;
  category: FeedbackCategory;
  route_id?: number | null;
  stop_id?: number | null;
  screen?: string;
  app_version?: string;
}) =>
  apiFetch<FeedbackResult>("/api/feedback", { method: "POST", body: JSON.stringify(body) });
