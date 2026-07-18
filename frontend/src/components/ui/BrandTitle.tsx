import styles from "./BrandTitle.module.css";

type Props = {
  size?: "sm" | "md" | "lg" | "hero";
  as?: "h1" | "p" | "span";
  className?: string;
};

/** FLOFER BRINKS — metallic 3D gold wordmark. */
export function BrandTitle({ size = "md", as: Tag = "p", className }: Props) {
  return (
    <Tag className={`${styles.title} ${styles[size]} ${className ?? ""}`}>
      <span className={styles.depth} aria-hidden>
        FLOFER BRINKS
      </span>
      <span className={styles.face}>FLOFER BRINKS</span>
    </Tag>
  );
}
