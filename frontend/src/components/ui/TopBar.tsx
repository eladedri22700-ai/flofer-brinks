import { BrandLockup } from "./BrandLockup";
import styles from "./TopBar.module.css";

type Props = {
  userName: string;
  completed?: number;
  total?: number;
  demoMode?: boolean;
};

export function TopBar({
  completed = 0,
  total = 0,
  demoMode = false,
}: Props) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <BrandLockup size="sm" markSize={26} />
        {demoMode ? <span className={styles.demoBanner}>הדגמה</span> : null}
      </div>
      <div className={styles.status} aria-label={`התקדמות ${completed} מתוך ${total}`}>
        <div className={styles.progressWrap}>
          <span className={`${styles.progressLabel} num`}>
            {completed}/{total}
          </span>
          <div className={styles.progressTrack} aria-hidden>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </header>
  );
}
