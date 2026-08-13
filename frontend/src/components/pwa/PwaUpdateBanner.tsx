import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import { getTodayRoute } from "../../api/planning";
import { isRoundLive } from "../../lib/roundBrief";
import styles from "./PwaUpdateBanner.module.css";

export function PwaUpdateBanner() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [update, setUpdate] = useState<((reload?: boolean) => Promise<void>) | null>(
    null,
  );
  const routeQ = useQuery({ queryKey: ["route-today"], queryFn: getTodayRoute });
  const live = isRoundLive(routeQ.data?.status);

  useEffect(() => {
    const u = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
    });
    setUpdate(() => u);
  }, []);

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
        onClick={() => void update?.(true)}
      >
        רענן עכשיו
      </button>
    </div>
  );
}
