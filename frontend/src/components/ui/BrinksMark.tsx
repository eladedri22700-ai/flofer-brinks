import styles from "./BrinksMark.module.css";

type Props = {
  size?: number;
  className?: string;
};

/** Brinks shield-and-B mark, inline SVG (crisp at every size, no network request). */
export function BrinksMark({ size = 40, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="FLOFER BRINKS"
      className={`${styles.mark} ${className ?? ""}`}
    >
      <defs>
        <linearGradient id="bmBg" x1="8" y1="4" x2="56" y2="60">
          <stop stopColor="#16263f" />
          <stop offset="1" stopColor="#0a1626" />
        </linearGradient>
        <linearGradient id="bmGold" x1="16" y1="8" x2="48" y2="56">
          <stop stopColor="#f0d78a" />
          <stop offset="0.42" stopColor="#d4af37" />
          <stop offset="1" stopColor="#9a7a1c" />
        </linearGradient>
        <linearGradient id="bmGoldEdge" x1="20" y1="10" x2="44" y2="50">
          <stop stopColor="#fff1b8" />
          <stop offset="1" stopColor="#b8922a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#bmBg)" />
      <path
        d="M32 8L48 14.5V28.5C48 40.2 40.8 48.6 32 54C23.2 48.6 16 40.2 16 28.5V14.5L32 8Z"
        fill="url(#bmGold)"
        stroke="url(#bmGoldEdge)"
        strokeWidth="1.5"
      />
      <path
        d="M32 14.2L44 19v9.2c0 9-5.6 15.6-12 19.6-6.4-4-12-10.6-12-19.6V19l12-4.8Z"
        fill="#0a1626"
        opacity="0.92"
      />
      <path
        d="M27.2 24.2h6.1c2.7 0 4.5 1.5 4.5 3.7 0 1.7-1 2.9-2.6 3.3v.2c2 .4 3.2 1.8 3.2 3.8 0 2.6-2.1 4.3-5.3 4.3h-5.9V24.2Zm3.4 2.5v4.1h2.3c1.2 0 1.9-.6 1.9-1.6s-.7-1.6-1.9-1.6h-2.3v-.9Zm0 6.5v4.6h2.7c1.4 0 2.2-.7 2.2-1.9s-.8-1.9-2.3-1.9h-2.6v-.8Z"
        fill="url(#bmGold)"
      />
    </svg>
  );
}
