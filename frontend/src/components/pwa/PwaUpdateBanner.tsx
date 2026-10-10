import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { applyUpdate, onNeedRefresh } from "../../lib/sw";
import { getTodayRoute } from "../../api/planning";
import { isRoundLive } from "../../lib/roundBrief";
import styles from "./PwaUpdateBanner.module.css";

export function PwaUpdateBanner() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const routeQ = useQuery({ queryKey: ["route-today"], queryFn: getTodayRoute });
  const live = isRoundLive(routeQ.data?.status);

  useEffect(
    () =>
      onNeedRefresh(() => {
        // Auto-update when not mid-round so phones leave stale builds behind.
        void getTodayRoute()
          .then((route) => {
            if (!isRoundLive(route?.status)) {
              void applyUpdate();
              return;
            }
            setNeedRefresh(true);
          })
          .catch(() => setNeedRefresh(true));
      }),
    [],
  );

  if (!needRefresh) return null;

  return (
    <div className={styles.bar} role="status">
      <p className={styles.text}>
        {live
          ? "יש גרסה חדשה — מומלץ לרענן אחרי החזרה לברינקס"
          : "יש גרסה חדשה של האפליקציה"}
      </p>
      <button
        type="button"
        className={styles.btn}
        onClick={() => void applyUpdate()}
      >
        רענן עכשיו
      </button>
    </div>
  );
}
