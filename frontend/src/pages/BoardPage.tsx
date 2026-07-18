import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../api/errors";
import { startRoute } from "../api/live";
import { getDepot, getPublicConfig, getTodayRoute } from "../api/planning";
import { RoundMap } from "../components/map/RoundMap";
import { BrandLockup } from "../components/ui/BrandLockup";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useToast } from "../components/ui/ToastProvider";
import { useLivePosition } from "../hooks/useLivePosition";
import styles from "./BoardPage.module.css";

function formatEta(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

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

  const stops = useMemo(() => {
    return [...(routeQ.data?.stops ?? [])].sort(
      (a, b) => a.sequence_order - b.sequence_order,
    );
  }, [routeQ.data?.stops]);

  const route = routeQ.data;
  const mapKey = cfgQ.data?.google_maps_browser_key ?? null;
  const depot = depotQ.data ?? null;
  const inProgress = route?.status === "in_progress";
  const returnHm =
    route?.solver_explanation?.return_hm != null
      ? String(route.solver_explanation.return_hm)
      : null;

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

  if (!route || stops.length === 0) {
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

  return (
    <div className={styles.board} dir="rtl">
      <header className={styles.top}>
        <div className={styles.brandBlock}>
          <BrandLockup size="md" markSize={36} to={null} />
          <p className={styles.kicker}>אישור סבב</p>
          <h1 className={styles.title}>{todayHe()}</h1>
          <p className={styles.confirmLead}>
            בדקו את הסדר על המפה וברשימה. אפשר לשנות — ורק כשמוכנים לוחצים «התחל
            סבב». שעת היציאה נקבעת בלחיצה.
          </p>
          <div className={styles.metaRow}>
            <span>
              יעדים: <span className="num">{stops.length}</span>
            </span>
            {route.optimized_duration_min != null ? (
              <span>
                משך משוער:{" "}
                <span className="num">{route.optimized_duration_min}</span> דק׳
              </span>
            ) : null}
            {returnHm ? (
              <span>
                צפי חזרה: <span className="num">{returnHm}</span>
              </span>
            ) : null}
            <span className={geo.denied ? styles.gpsBad : styles.gpsOk}>
              {geo.denied
                ? "GPS לא זמין"
                : geo.position
                  ? "מיקומכם על המפה"
                  : "מאתר מיקום…"}
            </span>
          </div>
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
          <Button variant="ghost" size="md" onClick={() => nav("/app/plan")}>
            עריכת יעדים
          </Button>
          <Button variant="ghost" size="md" onClick={() => nav("/app/dashboard")}>
            סגור
          </Button>
        </div>
      </header>

      <div className={`${styles.stage} ${panelOpen ? "" : styles.panelHidden}`}>
        <div className={styles.mapPane}>
          <RoundMap
            className={styles.mapFill}
            mapKey={mapKey}
            stops={stops}
            depot={depot}
            selectedStopId={selectedId}
            onSelectStop={setSelectedId}
            userPosition={geo.position}
          />
        </div>

        {panelOpen ? (
          <aside className={styles.panel} aria-label="סדר עבודה לאישור">
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>סדר הכתובות</h2>
              <Button variant="ghost" size="md" onClick={() => nav("/app/route")}>
                גרור לשינוי
              </Button>
            </div>
            {depot ? (
              <div className={styles.depotCard}>
                <strong>1 · יציאה · {depot.name}</strong>
                <div>{depot.address || "כתובת סניף מההגדרות"}</div>
              </div>
            ) : null}
            <ol className={styles.list}>
              {stops.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`${styles.item} ${selectedId === s.id ? styles.itemActive : ""}`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <span className={`${styles.seq} num`}>{i + 1}</span>
                    <span>
                      <span className={styles.name}>
                        {s.customer_name}
                        {s.priority === "vip" ? (
                          <span className={styles.vip}>VIP</span>
                        ) : null}
                      </span>
                      <span className={styles.addr}>{s.address}</span>
                    </span>
                    <span className={`${styles.eta} num`}>{formatEta(s.eta)}</span>
                  </button>
                </li>
              ))}
            </ol>
            {depot ? (
              <div className={styles.depotCard}>
                <strong>חזרה · {depot.name}</strong>
                <div>סיום הסבב באותה נקודה</div>
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
            ? "הסבב כבר פעיל — אפשר לחזור למסך הנסיעה."
            : "הלחיצה קובעת את שעת היציאה לעכשיו ומעדכנת את זמני ההגעה."}
        </p>
      </div>
    </div>
  );
}
