import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../api/errors";
import { startRoute } from "../api/live";
import { getDepot, getPublicConfig, getTodayRoute } from "../api/planning";
import { RoundMap } from "../components/map/RoundMap";
import { RoundPulse } from "../components/round/RoundPulse";
import { BrandLockup } from "../components/ui/BrandLockup";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useToast } from "../components/ui/ToastProvider";
import { useLivePosition } from "../hooks/useLivePosition";
import { buildRoundBrief, formatTimeHe } from "../lib/roundBrief";
import styles from "./BoardPage.module.css";

function todayHe(): string {
  return new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jerusalem",
  });
}

export default function BoardPage() {
  const nav = useNavigate();
  const { show } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const geo = useLivePosition(true);

  const routeQ = useQuery({ queryKey: ["route-today"], queryFn: getTodayRoute });
  const cfgQ = useQuery({ queryKey: ["public-config"], queryFn: getPublicConfig });
  const depotQ = useQuery({ queryKey: ["depot"], queryFn: getDepot });

  const route = routeQ.data;
  const brief = useMemo(() => buildRoundBrief(route), [route]);
  const stops = brief?.stops ?? [];
  const mapKey = cfgQ.data?.google_maps_browser_key ?? null;
  const depot = depotQ.data ?? null;
  const inProgress = route?.status === "in_progress";
  const nextId = brief?.next?.id ?? null;

  const startM = useMutation({
    mutationFn: () => startRoute(route!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["route-today"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      show("הסבב התחיל · זמנים עודכנו לפי עכשיו", "success");
      nav("/app/live");
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  if (routeQ.isLoading) {
    return <LoadingScreen full label="טוען אישור סבב" />;
  }

  if (!route || !brief || stops.length === 0) {
    return (
      <div className={styles.board}>
        <div className={styles.empty}>
          <EmptyState
            title="אין עדיין סבב לאישור"
            description="חשבו מסלול במסך התכנון — ואז חזרו לכאן לאשר את הסדר ולהתחיל."
            action={
              <Button size="lg" onClick={() => nav("/app/plan")}>
                לתכנון הסבב
              </Button>
            }
          />
          <p className={styles.backHome}>
            <Link to="/app/dashboard">חזרה לבית</Link>
          </p>
        </div>
      </div>
    );
  }

  const activeId = selectedId ?? nextId;

  return (
    <div className={styles.board} dir="rtl">
      <header className={styles.top}>
        <div className={styles.brandBlock}>
          <BrandLockup size="md" markSize={36} to={null} />
          <p className={styles.kicker}>לוח סבב</p>
          <h1 className={styles.title}>{todayHe()}</h1>
        </div>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setPanelOpen((v) => !v)}
          >
            {panelOpen ? "הסתר רשימה" : "הצג רשימה"}
          </Button>
          <Button variant="ghost" size="md" onClick={() => nav("/app/route")}>
            שנה סדר
          </Button>
          <Button variant="ghost" size="md" onClick={() => nav("/app/dashboard")}>
            בית
          </Button>
        </div>
      </header>

      <RoundPulse
        brief={brief}
        depotName={depot?.name || "ברינקס"}
        variant="strip"
      />

      <div className={`${styles.stage} ${panelOpen ? "" : styles.panelHidden}`}>
        <div className={styles.mapPane}>
          <RoundMap
            className={styles.mapFill}
            mapKey={mapKey}
            stops={stops}
            depot={depot}
            selectedStopId={activeId}
            onSelectStop={setSelectedId}
            userPosition={geo.position}
          />
          {brief.next ? (
            <div className={styles.mapCallout}>
              <span className={styles.calloutLabel}>הבא במסלול</span>
              <strong>{brief.next.customer_name}</strong>
              <span className={`${styles.calloutEta} num`}>
                הגעה {formatTimeHe(brief.next.eta)}
              </span>
            </div>
          ) : null}
          <span
            className={geo.denied ? styles.gpsBadgeBad : styles.gpsBadge}
            aria-live="polite"
          >
            {geo.denied
              ? "GPS לא זמין"
              : geo.position
                ? "מיקומכם על המפה"
                : "מאתר מיקום…"}
          </span>
        </div>

        {panelOpen ? (
          <aside className={styles.panel} aria-label="סדר עבודה">
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>סדר הכתובות</h2>
              <span className={styles.panelMeta}>
                חזרה לסניף <span className="num">{brief.returnHm}</span>
              </span>
            </div>
            {depot ? (
              <div className={styles.depotCard}>
                <strong>יציאה · {depot.name}</strong>
                <div>{depot.address || "כתובת סניף מההגדרות"}</div>
              </div>
            ) : null}
            <ol className={styles.list}>
              {stops.map((s, i) => {
                const done = s.status === "done" || s.status === "skipped";
                const isNext = s.id === nextId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={[
                        styles.item,
                        activeId === s.id ? styles.itemActive : "",
                        isNext ? styles.itemNext : "",
                        done ? styles.itemDone : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <span className={`${styles.seq} num`}>{i + 1}</span>
                      <span className={styles.itemBody}>
                        <span className={styles.name}>
                          {s.customer_name}
                          {isNext ? (
                            <span className={styles.nextTag}>הבא</span>
                          ) : null}
                          {s.priority === "vip" ? (
                            <span className={styles.vip}>VIP</span>
                          ) : null}
                        </span>
                        <span className={styles.addr}>{s.address}</span>
                      </span>
                      <span className={styles.etaCol}>
                        <span className={styles.etaLabel}>הגעה</span>
                        <span className={`${styles.eta} num`}>
                          {formatTimeHe(s.eta)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {depot ? (
              <div className={`${styles.depotCard} ${styles.depotReturn}`}>
                <strong>חזרה · {depot.name}</strong>
                <div>
                  סיום משוער{" "}
                  <span className="num">{brief.returnHm}</span>
                </div>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>

      <div className={styles.startBar}>
        {inProgress ? (
          <Button size="lg" className={styles.startBtn} onClick={() => nav("/app/live")}>
            המשך לנסיעה
          </Button>
        ) : (
          <Button
            size="lg"
            className={styles.startBtn}
            loading={startM.isPending}
            onClick={() => startM.mutate()}
          >
            התחל סבב
          </Button>
        )}
        <p className={styles.startHint}>
          {inProgress
            ? "הסבב פעיל — חזרה משוערת לסניף מוצגת למעלה."
            : "הלחיצה קובעת יציאה לעכשיו ומעדכנת את זמני ההגעה והחזרה."}
        </p>
      </div>
    </div>
  );
}
