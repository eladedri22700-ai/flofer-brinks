import styles from "./BrandTitle.module.css";

type Props = {
  size?: "sm" | "md" | "lg" | "hero";
  as?: "h1" | "p" | "span";
  className?: string;
};

/** FLOFER BRINKS — clean brass wordmark. */
export function BrandTitle({ size = "md", as: Tag = "p", className }: Props) {
  return (
    <Tag className={`${styles.title} ${styles[size]} ${className ?? ""}`}>
      FLOFER <span className={styles.sub}>BRINKS</span>
    </Tag>
  );
}
