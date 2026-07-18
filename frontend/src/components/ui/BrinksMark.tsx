import styles from "./BrinksMark.module.css";

type Props = {
  size?: number;
  className?: string;
};

/** Brinks-style shield mark (in-app + matches PWA icon language). */
export function BrinksMark({ size = 40, className }: Props) {
  return (
    <img
      src="/icons/icon-192.png"
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={`${styles.mark} ${className ?? ""}`}
      aria-hidden
    />
  );
}
