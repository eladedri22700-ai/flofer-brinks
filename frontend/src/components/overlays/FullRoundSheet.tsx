import type { RouteDto } from "../../api/client";
import { useOverlayStore } from "../../store/overlayStore";
import { formatTimeHe, sortedStops } from "../../lib/roundBrief";
import shared from "./overlays.module.css";
import styles from "./FullRoundSheet.module.css";

type Props = { route: RouteDto | null | undefined };

export function FullRoundSheet({ route }: Props) {
  const open = useOverlayStore((s) => s.fullListOpen);
  const close = useOverlayStore((s) => s.closeFullList);
  const openDetail = useOverlayStore((s) => s.openDetail);
  if (!open) return null;
  const stops = sortedStops(route);
  const currentId = stops.find((s) => s.status !== "done" && s.status !== "skipped")?.id;

  return (
    <>
      <button type="button" className={shared.scrim} style={{ zIndex: 60 }} onClick={close} aria-label="סגור" />
      <div className={shared.sheet} style={{ zIndex: 61, maxHeight: "74%", padding: "18px 22px 26px" }} role="dialog" aria-modal="true">
        <div className={styles.head}>
          <div className={styles.title}>כל הסבב</div>
          <button type="button" className={`${styles.closeLink} tap`} onClick={close}>
            סגור
          </button>
        </div>
        <div className={styles.list}>
          {stops.map((s, i) => {
            const done = s.status === "done" || s.status === "skipped";
            const isCurrent = s.id === currentId;
            return (
              <button
                key={s.id}
                type="button"
                className={`${styles.row} tap`}
                onClick={() => openDetail(s.id)}
              >
                <span className={`${styles.n} num`}>{String(i + 1).padStart(2, "0")}</span>
                <span
                  className={styles.name}
                  style={{
                    color: done ? "var(--field-disabled-numeral)" : isCurrent ? "var(--field-ink)" : "var(--field-body-text)",
                    textDecoration: done ? "line-through" : "none",
                  }}
                >
                  {s.customer_name} · {s.address}
                </span>
                <span
                  className={`${styles.eta} num`}
                  style={{ color: done ? "var(--field-done)" : "var(--field-muted)" }}
                >
                  {done ? "בוצע" : formatTimeHe(s.eta)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
