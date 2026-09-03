import { Link } from "react-router-dom";
import type { RouteDto } from "../../api/client";
import { formatTimeHe, returnTimeLabel, sortedStops, stopWindowHe } from "../../lib/roundBrief";
import { useOverlayStore } from "../../store/overlayStore";
import styles from "./DayRound.module.css";

type Props = { route: RouteDto };

function hm(iso: string): string {
  return iso.slice(0, 5);
}

export function DayRound({ route }: Props) {
  const openDetail = useOverlayStore((s) => s.openDetail);
  const openFullList = useOverlayStore((s) => s.openFullList);
  const stops = sortedStops(route);
  const total = stops.length;
  const done = stops.filter((s) => s.status === "done" || s.status === "skipped").length;
  const idx = stops.findIndex((s) => s.status !== "done" && s.status !== "skipped");
  const currentIdx = idx === -1 ? total - 1 : idx;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const vipRemaining = stops.filter(
    (s) => s.priority === "vip" && s.status !== "done" && s.status !== "skipped",
  ).length;
  const returnHm = returnTimeLabel(route);
  const departure = hm(route.departure_time);

  const savingsMin =
    route.naive_duration_min != null && route.optimized_duration_min != null
      ? route.naive_duration_min - route.optimized_duration_min
      : null;

  const live = route.status === "in_progress";
  const allDone = total > 0 && done >= total;
  const cta = !live
    ? { href: "/app/board", label: "לאישור סבב ולהתחלה" }
    : allDone
      ? { href: "/app/live", label: "סגירת הסבב" }
      : { href: "/app/live", label: `המשך לעצירה ${currentIdx + 1}` };

  const windowStart = Math.max(0, currentIdx - 1);
  const windowEnd = Math.min(total, currentIdx + 3);
  const rows = stops.slice(windowStart, windowEnd).map((s, offset) => {
    const i = windowStart + offset;
    const isDone = s.status === "done" || s.status === "skipped";
    const isCurrent = i === currentIdx && !allDone;
    const isLastRow = i === windowEnd - 1;
    return { stop: s, isDone, isCurrent, isLastRow };
  });

  const restCount = total - currentIdx - 3;

  return (
    <>
      <div className={styles.hero}>
        <div className={styles.heroLabel}>צפי חזרה לברינקס</div>
        <div className={styles.heroRow}>
          <div className={`${styles.heroNum} num`}>{returnHm}</div>
          {savingsMin != null && savingsMin > 0 ? (
            <span className={styles.savings}>−{savingsMin} דק׳</span>
          ) : null}
        </div>
        <div className={styles.rail}>
          <span className={`${styles.railTime} num`}>{departure}</span>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${pct}%` }} />
            <div className={styles.head} style={{ insetInlineStart: `${pct}%` }} />
          </div>
          <span className={`${styles.railTime} num`}>{returnHm}</span>
        </div>
        <div className={styles.footerRow}>
          <span>{done} בוצעו</span>
          <span>
            {total - done} נותרו{vipRemaining > 0 ? ` · ${vipRemaining} VIP` : ""}
          </span>
        </div>
      </div>

      <Link to={cta.href} className={`${styles.cta} ${allDone ? styles.ctaDone : ""} tap`}>
        {cta.label}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--field-brass-light)" strokeWidth="2.4" strokeLinecap="round">
          <path d="M14 6l-6 6 6 6" />
        </svg>
      </Link>

      <div>
        <div className={styles.timelineLabel}>הציר של היום</div>
        <div className={styles.grid}>
          {rows.map(({ stop, isDone, isCurrent, isLastRow }) => (
            <RowCells
              key={stop.id}
              stop={stop}
              isDone={isDone}
              isCurrent={isCurrent}
              isLastRow={isLastRow}
              onOpen={() => openDetail(stop.id)}
            />
          ))}
        </div>
        <button type="button" className={`${styles.restLink} tap`} onClick={openFullList}>
          {restCount > 0 ? `עוד ${restCount} עצירות · לצפייה בכל הציר` : "לצפייה בכל הציר"}
        </button>
      </div>
    </>
  );
}

function RowCells({
  stop,
  isDone,
  isCurrent,
  isLastRow,
  onOpen,
}: {
  stop: RouteDto["stops"][number];
  isDone: boolean;
  isCurrent: boolean;
  isLastRow: boolean;
  onOpen: () => void;
}) {
  const win = stopWindowHe(stop);
  return (
    <>
      <span
        className={`${styles.timeCell} num`}
        style={{
          fontSize: isCurrent ? 15 : 13,
          fontWeight: isCurrent ? 700 : 400,
          color: isDone ? "var(--field-disabled-numeral)" : isCurrent ? "var(--field-ink)" : "var(--field-body-text)",
        }}
      >
        {formatTimeHe(stop.eta)}
      </span>
      <span className={styles.railCell}>
        <span
          className={styles.dot}
          style={{
            width: isCurrent ? 17 : 11,
            height: isCurrent ? 17 : 11,
            background: isDone ? "var(--field-done)" : isCurrent ? "var(--field-brass-light)" : "#fff",
            border: isCurrent ? "4px solid var(--field-ink)" : isDone ? "none" : "2.5px solid #dcd9cf",
            boxShadow: isCurrent ? "0 0 0 5px rgba(232,198,90,.28)" : "none",
          }}
        />
        <span className={styles.connector} style={{ height: isLastRow ? 0 : isCurrent ? 58 : 44 }} />
      </span>
      <button type="button" className={`${styles.nameCell} tap`} onClick={onOpen}>
        <span
          style={{
            fontSize: isCurrent ? 17 : 15,
            fontWeight: isCurrent ? 800 : 600,
            color: isDone ? "#a8b2c0" : "var(--field-ink)",
            textDecoration: isDone ? "line-through" : "none",
          }}
        >
          {stop.customer_name}
        </span>
        {stop.priority === "vip" ? <span className={styles.vipTag}> ★ VIP</span> : null}
        <br />
        <span className={styles.sub}>
          {stop.address}
          {isCurrent ? ` · שירות ${stop.service_duration_min} דק׳` : win ? ` · ${win}` : ""}
        </span>
      </button>
    </>
  );
}
