import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getTodayRoute } from "../../api/planning";
import {
  formatTimeHe,
  isRoundLive,
  nextOpenStop,
  returnTimeLabel,
  sortedStops,
} from "../../lib/roundBrief";
import { navCoords, openWaze } from "../../lib/waze";
import styles from "./NextStopHud.module.css";

export function NextStopHud() {
  const nav = useNavigate();
  const loc = useLocation();
  const routeQ = useQuery({ queryKey: ["route-today"], queryFn: getTodayRoute });
  const route = routeQ.data;
  const live = isRoundLive(route?.status);
  const next = nextOpenStop(sortedStops(route));
  const hideHere =
    loc.pathname.startsWith("/app/live") || loc.pathname.startsWith("/app/board");

  if (!live || !next || hideHere) return null;

  const coords = navCoords(next);
  const left = sortedStops(route).filter(
    (s) => s.status !== "done" && s.status !== "skipped",
  ).length;

  return (
    <div className={styles.bar} role="status" aria-label="הכתובת הבאה">
      <button
        type="button"
        className={styles.main}
        onClick={() => nav("/app/live")}
      >
        <span className={styles.kicker}>הבא · {left} נותרו</span>
        <span className={styles.name}>{next.customer_name}</span>
        <span className={styles.meta}>
          הגעה <span className="num">{formatTimeHe(next.eta)}</span>
          {" · "}
          חזרה לברינקס <span className="num">{returnTimeLabel(route)}</span>
        </span>
      </button>
      <button
        type="button"
        className={styles.waze}
        onClick={() => openWaze(coords.lat, coords.lng)}
      >
        וויז
      </button>
    </div>
  );
}
