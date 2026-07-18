import { Link } from "react-router-dom";
import type { RoundBrief } from "../../lib/roundBrief";
import styles from "./RoundPulse.module.css";

type Props = {
  brief: RoundBrief;
  depotName?: string | null;
  /** Compact card for dashboard; full strip for board */
  variant?: "strip" | "card";
  ctaHref?: string;
  ctaLabel?: string;
};

export function RoundPulse({
  brief,
  depotName = "ברינקס",
  variant = "strip",
  ctaHref,
  ctaLabel,
}: Props) {
  const nextTitle = brief.next?.customer_name ?? "אין יעד פתוח";
  const nextAddr = brief.next?.address ?? "כל היעדים הושלמו או שאין סבב פעיל";

  return (
    <section
      className={variant === "card" ? styles.card : styles.strip}
      aria-label="סיכום סבב חי"
    >
      <div className={styles.head}>
        <span className={styles.badge}>{brief.statusHe}</span>
        <span className={styles.count}>
          <span className="num">{brief.doneCount}</span>/
          <span className="num">{brief.doneCount + brief.pendingCount}</span> יעדים
        </span>
      </div>

      <div className={styles.nextBlock}>
        <p className={styles.nextLabel}>הכתובת הבאה</p>
        <p className={styles.nextName}>{nextTitle}</p>
        <p className={styles.nextAddr}>{nextAddr}</p>
      </div>

      <div className={styles.metrics} role="group" aria-label="זמנים משוערים">
        <div className={styles.metric}>
          <span className={styles.metricLabel}>הגעה ליעד</span>
          <span className={`${styles.metricValue} num`}>{brief.nextEta}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>חזרה ל{depotName}</span>
          <span className={`${styles.metricValue} num`}>{brief.returnHm}</span>
        </div>
        {brief.durationMin != null ? (
          <div className={styles.metric}>
            <span className={styles.metricLabel}>משך סבב</span>
            <span className={`${styles.metricValue} num`}>
              {brief.durationMin}
              <span className={styles.unit}> דק׳</span>
            </span>
          </div>
        ) : null}
      </div>

      {ctaHref && ctaLabel ? (
        <Link to={ctaHref} className={styles.cta}>
          {ctaLabel}
        </Link>
      ) : null}
    </section>
  );
}
