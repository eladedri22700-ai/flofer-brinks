import type { ApiError } from "./client";

export function apiErrorMessage(err: unknown, fallback = "אירעה תקלה. נסו שוב."): string {
  if (err && typeof err === "object" && "message_he" in err) {
    const msg = (err as ApiError).message_he;
    if (msg) return msg;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
