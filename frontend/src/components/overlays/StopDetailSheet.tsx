import type { RouteDto } from "../../api/client";
import { useOverlayStore } from "../../store/overlayStore";
import { formatTimeHe, sortedStops, stopWindowHe } from "../../lib/roundBrief";
import shared from "./overlays.module.css";
import styles from "./StopDetailSheet.module.css";

type Props = {
  route: RouteDto | null | undefined;
  /** Called when the user taps "קבע כעצירה הבאה" — jump straight to driving. */
  onSetAsNext?: (stopId: number) => void;
};

function statusHe(status: string): { label: string; bg: string; color: string } {
  if (status === "done") return { label: "בוצע", bg: "rgba(31,170,99,.1)", color: "var(--field-done)" };
  if (status === "arrived" || status === "pending")
    return { label: status === "arrived" ? "נוכחית" : "ממתינה", bg: "var(--field-day-bg)", color: "var(--field-body-text)" };
  if (status === "skipped") return { label: "לא בוצע", bg: "rgba(138,47,47,.1)", color: "var(--field-exception)" };
  return { label: status, bg: "var(--field-day-bg)", color: "var(--field-body-text)" };
}

export function StopDetailSheet({ route, onSetAsNext }: Props) {
  const detailStopId = useOverlayStore((s) => s.detailStopId);
  const closeDetail = useOverlayStore((s) => s.closeDetail);
  if (detailStopId == null) return null;
  const stops = sortedStops(route);
  const stop = stops.find((s) => s.id === detailStopId);
  if (!stop) return null;

  const win = stopWindowHe(stop);
  const st = statusHe(stop.status);
  const navHref = `https://waze.com/ul?ll=${stop.parking_lat ?? stop.lat},${stop.parking_lng ?? stop.lng}&navigate=yes`;

  return (
    <>
      <button type="button" className={shared.scrim} onClick={closeDetail} aria-label="סגור" />
      <div className={shared.sheet} style={{ maxHeight: "82%" }} role="dialog" aria-modal="true">
        <div className={shared.sheetHead}>
          <div>
            <div className={shared.sheetTitleName}>{stop.customer_name}</div>
            <div className={shared.sheetTitleSub}>{stop.address}</div>
          </div>
          <button type="button" className={shared.closeBtn} onClick={closeDetail} aria-label="סגור">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className={shared.sheetBody}>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>הגעה</div>
              <div className={`${styles.statValue} num`}>{formatTimeHe(stop.eta)}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>שירות</div>
              <div className={`${styles.statValue} num`}>{stop.service_duration_min} דק׳</div>
            </div>
            <div className={styles.stat} style={{ background: st.bg }}>
              <div className={styles.statLabel}>מצב</div>
              <div className={styles.statValue} style={{ color: st.color, fontSize: 15 }}>{st.label}</div>
            </div>
          </div>

          {stop.priority === "vip" || win ? (
            <div className={styles.infoRow}>
              <span className={styles.infoIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                  <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />
                </svg>
              </span>
              <div>
                <div className={styles.infoTitle}>חלון זמן{stop.priority === "vip" ? " · VIP" : ""}</div>
                <div className={styles.infoBody}>{win ?? "אין אילוץ זמן"}</div>
              </div>
            </div>
          ) : null}

          <div className={styles.infoRow}>
            <span className={styles.infoIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                <rect x="3" y="7" width="18" height="11" rx="2.5" /><path d="M7 7V5h10v2" />
              </svg>
            </span>
            <div>
              <div className={styles.infoTitle}>חנייה</div>
              <div className={styles.infoBody}>{stop.parking_badge || "אין הערת חנייה שמורה"}</div>
            </div>
          </div>

          {stop.phone || stop.notes ? (
            <div className={styles.infoRow}>
              <span className={styles.infoIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                  <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1.5 1.5 0 0 1-1.7 1.5C10.9 19.6 4.4 13.1 3.5 5.7A1.5 1.5 0 0 1 5 4z" />
                </svg>
              </span>
              <div>
                <div className={styles.infoTitle}>איש קשר</div>
                <div className={styles.infoBody}>
                  {stop.phone ? <a href={`tel:${stop.phone}`}>{stop.phone}</a> : null}
                  {stop.phone && stop.notes ? " · " : null}
                  {stop.notes}
                </div>
              </div>
            </div>
          ) : null}

          <div className={styles.infoRow}>
            <span className={styles.infoIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />
              </svg>
            </span>
            <div>
              <div className={styles.infoTitle}>זמן שירות</div>
              <div className={styles.infoBody}>
                {stop.service_duration_min} דק׳
                {stop.service_estimate_source === "learned" ? " · נלמד מהיסטוריית ביקורים" : " · ברירת מחדל"}
                {stop.learned_badge ? ` · ${stop.learned_badge}` : ""}
              </div>
            </div>
          </div>

          <div className={styles.footerBtns}>
            <a href={navHref} target="_blank" rel="noreferrer" className={`${styles.footerOutline} tap`}>
              נווט לכאן
            </a>
            {onSetAsNext && stop.status !== "done" && stop.status !== "skipped" ? (
              <button
                type="button"
                className={`${styles.footerDark} tap`}
                onClick={() => {
                  onSetAsNext(stop.id);
                  closeDetail();
                }}
              >
                קבע כעצירה הבאה
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
