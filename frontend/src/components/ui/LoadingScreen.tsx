import { BrandLockup } from "./BrandLockup";
import styles from "./LoadingScreen.module.css";

type Props = {
  /** Message announced to screen readers and shown under the mark. */
  label?: string;
  /** Full-viewport splash (app boot / route load) vs. inline page block. */
  full?: boolean;
};

export function LoadingScreen({ label = "טוען…", full = false }: Props) {
  return (
    <div
      className={`${styles.wrap} ${full ? styles.full : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className={styles.aurora} aria-hidden />
      <div className={styles.markWrap}>
        <span className={styles.ring} aria-hidden />
        <span className={styles.mark} aria-hidden>
          <BrandLockup size="lg" stacked to={null} />
        </span>
      </div>
      <p className={styles.label}>
        <span>{label}</span>
        <span className={styles.dots} aria-hidden>
          <i />
          <i />
          <i />
        </span>
      </p>
    </div>
  );
}
