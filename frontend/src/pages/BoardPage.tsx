import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../api/errors";
import { startRoute } from "../api/live";
import { getDepot, getPublicConfig, getTodayRoute } from "../api/planning";
import { BoardStopRow } from "../components/board/BoardStopRow";
import { RoundMap } from "../components/map/RoundMap";
import { BrandLockup } from "../components/ui/BrandLockup";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useToast } from "../components/ui/ToastProvider";
import { useLivePosition } from "../hooks/useLivePosition";
import { buildRoundBrief } from "../lib/roundBrief";
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
  const listRef = useRef<HTMLOListElement>(null);
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
  const activeId = selectedId ?? nextId;

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

  const selectStop = (id: number) => {
    setSelectedId(id);
    setPanelOpen(true);
  };

  useEffect(() => {
    if (!activeId || !panelOpen) return;
    const el = listRef.current?.querySelector(`[data-stop-id="${activeId}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId, panelOpen]);

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

  const pct = Math.round((brief.doneCount / stops.length) * 100);

  return (
    <div className={styles.board} dir="rtl">
      <header className={styles.top}>
        <div className={styles.brandRow}>
          <BrandLockup size="sm" markSize={26} to={null} />
          <div className={styles.brandText}>
            <p className={styles.kicker}>
              לוח סבב · <span className="num">{stops.length}</span> יעדים
            </p>
            <h1 className={styles.title}>{todayHe()}</h1>
          </div>
        </div>
        <nav className={styles.actions} aria-label="פעולות לוח">
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setPanelOpen((v) => !v)}
            aria-pressed={panelOpen}
          >
            {panelOpen ? "מפה מלאה" : "רשימה"}
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => nav("/app/route")}
          >
            שנה סדר
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => window.print()}
          >
            הדפס
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => nav("/app/dashboard")}
          >
            בית
          </button>
        </nav>
      </header>

      <div className={styles.metrics} role="group" aria-label="סיכום סבב">
        <div className={styles.metric}>
          <span className={styles.metricLabel}>סטטוס</span>
          <strong className={styles.metricValue}>{brief.statusHe}</strong>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>הגעה הבאה</span>
          <strong className={`${styles.metricValue} num`}>{brief.nextEta}</strong>
        </div>
        <div className={`${styles.metric} ${styles.metricAccent}`}>
          <span className={styles.metricLabel}>
            חזרה ל{depot?.name || "ברינקס"}
          </span>
          <strong className={`${styles.metricValue} num`}>{brief.returnHm}</strong>
        </div>
        {brief.durationMin != null ? (
          <div className={styles.metric}>
            <span className={styles.metricLabel}>משך</span>
            <strong className={`${styles.metricValue} num`}>
              {brief.durationMin}
              <span className={styles.unit}> דק׳</span>
            </strong>
          </div>
        ) : null}
      </div>

      <div
        className={styles.progress}
        role="progressbar"
        aria-valuenow={brief.doneCount}
        aria-valuemin={0}
        aria-valuemax={stops.length}
        aria-label={`בוצעו ${brief.doneCount} מתוך ${stops.length}`}
      >
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>

      <div className={`${styles.stage} ${panelOpen ? "" : styles.panelHidden}`}>
        <div className={styles.mapPane}>
          <RoundMap
            className={styles.mapFill}
            mapKey={mapKey}
            stops={stops}
            depot={depot}
            selectedStopId={activeId}
            onSelectStop={selectStop}
            userPosition={geo.position}
            showLegend={false}
          />
          <span
            className={geo.denied ? styles.gpsBadgeBad : styles.gpsBadge}
            aria-live="polite"
          >
            {geo.denied
              ? "אין GPS"
              : geo.position
                ? "אתם על המפה"
                : "מאתר…"}
          </span>
          {!panelOpen ? (
            <button
              type="button"
              className={styles.peekList}
              onClick={() => setPanelOpen(true)}
            >
              הצג רשימת כתובות
            </button>
          ) : null}
        </div>

        {panelOpen ? (
          <aside className={styles.panel} aria-label="סדר עבודה">
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>סדר הכתובות</h2>
                <p className={styles.panelLead}>
                  לחצו על שורה כדי למקד במפה · הסיכות ממוספרות לפי הסדר
                </p>
              </div>
            </div>

            <div className={styles.loopRail}>
              <span className={styles.loopChip}>
                יציאה · {depot?.name || "סניף"}
              </span>
              <span className={styles.loopArrow} aria-hidden>
                ←
              </span>
              <span className={`${styles.loopChip} num`}>
                {stops.length} יעדים
              </span>
              <span className={styles.loopArrow} aria-hidden>
                ←
              </span>
              <span className={`${styles.loopChip} ${styles.loopReturn}`}>
                חזרה · <span className="num">{brief.returnHm}</span>
              </span>
            </div>

            <ol className={styles.list} ref={listRef}>
              {stops.map((s, i) => (
                <BoardStopRow
                  key={s.id}
                  stop={s}
                  index={i}
                  active={activeId === s.id}
                  isNext={s.id === nextId}
                  onSelect={selectStop}
                />
              ))}
            </ol>
          </aside>
        ) : null}
      </div>

      <div className={styles.startBar} data-tour="board-start">
        {brief.next ? (
          <p className={styles.nextLine}>
            <span className={styles.nextLineLabel}>הבא</span>
            <strong>{brief.next.customer_name}</strong>
            <span className={`${styles.nextLineEta} num`}>
              {brief.nextEta}
            </span>
          </p>
        ) : null}
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
            ? "הסבב פעיל — אפשר לחזור למסך הנסיעה בכל רגע."
            : "מאשרים את הסדר ויוצאים עכשיו · זמני ההגעה מתעדכנים ליציאה מיידית."}
        </p>
      </div>
    </div>
  );
}
