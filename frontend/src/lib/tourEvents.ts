export type TourWaitEvent =
  | "tour:stop-added"
  | "tour:vip-set"
  | "tour:ocr-ready"
  | "tour:ocr-committed"
  | "tour:optimized"
  | "tour:locked";

export function emitTourEvent(name: TourWaitEvent): void {
  window.dispatchEvent(new CustomEvent(name));
}

export function onTourEvent(
  name: TourWaitEvent,
  handler: () => void,
): () => void {
  const fn = () => handler();
  window.addEventListener(name, fn);
  return () => window.removeEventListener(name, fn);
}
