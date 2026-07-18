import { Link } from "react-router-dom";
import { BrandTitle } from "./BrandTitle";
import { BrinksMark } from "./BrinksMark";
import styles from "./BrandLockup.module.css";

type Props = {
  size?: "sm" | "md" | "lg" | "hero";
  markSize?: number;
  to?: string | null;
  stacked?: boolean;
  className?: string;
  titleAs?: "h1" | "p" | "span";
};

export function BrandLockup({
  size = "md",
  markSize,
  to = "/app/dashboard",
  stacked = false,
  className,
  titleAs = "p",
}: Props) {
  const mark =
    markSize ??
    (size === "hero" ? 64 : size === "lg" ? 44 : size === "sm" ? 28 : 36);

  const inner = (
    <>
      <BrinksMark size={mark} />
      <BrandTitle size={size} as={titleAs} />
    </>
  );

  const cls = `${styles.lockup} ${stacked ? styles.stacked : ""} ${className ?? ""}`;

  if (to) {
    return (
      <Link to={to} className={cls} aria-label="FLOFER BRINKS">
        {inner}
      </Link>
    );
  }

  return (
    <div className={cls} aria-label="FLOFER BRINKS">
      {inner}
    </div>
  );
}
