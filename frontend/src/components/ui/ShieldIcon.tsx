import { BrinksMark } from "./BrinksMark";

/** @deprecated Prefer BrinksMark — kept for older imports. */
export function ShieldIcon({ size = 28 }: { size?: number }) {
  return <BrinksMark size={size} />;
}
