import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../api/errors";
import {
  arriveStop,
  completeStopResilient,
  getDelay,
  getPrefs,
  logRouteEvent,
  notifyApproach,
  reoptimizeApply,
  reoptimizePropose,
  skipStop,
  syncOfflineQueue,
  workDayEvent,
} from "../api/live";
import { getDepot, getTodayRoute } from "../api/planning";
import type { StopDto } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { StatusBanner } from "../components/ui/StatusBanner";
import { useToast } from "../components/ui/ToastProvider";
import { useGeofence } from "../hooks/useGeofence";
import { useNextStopAdvance } from "../hooks/useNextStopAdvance";
import { useWakeLock } from "../hooks/useWakeLock";
import { cacheActiveRoute, queueLength } from "../lib/offlineQueue";
import styles from "./LivePage.module.css";

const EXCEPTIONS = [
  { id: "none", label: "הכל תקין" },
  { id: "customer_not_ready", label: "לקוח לא מוכן" },
  { id: "gate_wait", label: "המתנה בשער" },
  { id: "parking", label: "חניה" },
  { id: "closed", label: "סגור" },
  { id: "branch_busy", label: "עומס" },
  { id: "other", label: "אחר" },
] as const;

function formatEta(iso: string | null | undefined): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

function openWaze(lat: number, lng: number) {
  const app = `waze://?ll=${lat},${lng}&navigate=yes`;
  const web = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  window.location.href = app;
  window.setTimeout(() => {
    window.open(web, "_blank");
  }, 800);
}

export default function LivePage() {
  const { show } = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [listOpen, setListOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [exception, setException] = useState("none");
  const [promptArrive, setPromptArrive] = useState(false);
  const [offlineN, setOfflineN] = useState(0);
  const [proposal, setProposal] = useState<{
    message_he: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [moreActions, setMoreActions] = useState(false);
  const [approachBanner, setApproachBanner] = useState(false);
  const [returnAt, setReturnAt] = useState<string | null>(null);
  const [delayMin, setDelayMin] = useState(0);
  const autoBusy = useRef(false);

  const routeQ = useQuery({ queryKey: ["route-today"], queryFn: getTodayRoute });
  const prefsQ = useQuery({ queryKey: ["prefs"], queryFn: getPrefs });
  const depotQ = useQuery({ queryKey: ["depot"], queryFn: getDepot });
  const route = routeQ.data;

  useWakeLock(Boolean(route && route.status === "in_progress"));

  useEffect(() => {
    if (route?.status !== "completed") return;
    show("יום עבודה הסתיים — כל הכבוד!", "success");
    nav(`/app/summary/${route.id}`, { replace: true });
  }, [route?.status, route?.id, nav, show]);

  useEffect(() => {
    if (route) void cacheActiveRoute(route);
  }, [route]);

  useEffect(() => {
    const tick = () => void queueLength().then(setOfflineN);
    tick();
    const onOnline = () => {
      void syncOfflineQueue()
        .then((n) => {
          if (n > 0) {
            show(`סונכרנו ${n} פעולות`, "success");
            void qc.invalidateQueries({ queryKey: ["route-today"] });
          }
          return queueLength();
        })
        .then(setOfflineN);
    };
    window.addEventListener("online", onOnline);
    const id = window.setInterval(tick, 5000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(id);
    };
  }, [qc, show]);

  const sorted = useMemo(
    () =>
      [...(route?.stops ?? [])].sort((a, b) => a.sequence_order - b.sequence_order),
    [route?.stops],
  );
  const current =
    sorted.find((s) => s.status === "arrived") ??
    sorted.find((s) => s.status === "pending") ??
    null;
  const nextUp =
    (current
      ? sorted.find(
          (s) =>
            s.status === "pending" && s.sequence_order > current.sequence_order,
        )
      : null) ?? null;
  const doneCount = sorted.filter((s) => s.status === "done" || s.status === "skipped").length;

  const target = current
    ? {
        lat: current.parking_lat ?? current.lat,
        lng: current.parking_lng ?? current.lng,
      }
    : null;

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["route-today"] });

  const onEnterTarget = useCallback(
    (pos: { lat: number; lng: number }) => {
      if (!current || current.status === "arrived") return;
      if (autoBusy.current) return;
      autoBusy.current = true;
      void arriveStop(current.id, pos.lat, pos.lng, "geofence")
        .then(() => {
          setApproachBanner(false);
          show(`זוהתה הגעה ל«${current.customer_name}»`, "success");
          invalidate();
        })
        .catch(() => undefined)
        .finally(() => {
          autoBusy.current = false;
        });
    },
    [current, show],
  );

  const onApproach = useCallback(
    (pos: { lat: number; lng: number }, distanceM: number) => {
      if (!route || !current) return;
      setApproachBanner(true);
      show(`מתקרבים ל«${current.customer_name}»`, "success");
      void notifyApproach(route.id, {
        stop_id: current.id,
        distance_m: distanceM,
      }).catch(() => undefined);
      void logRouteEvent(route.id, "approach_ui", {
        stop_id: current.id,
        distance_m: distanceM,
        lat: pos.lat,
        lng: pos.lng,
      }).catch(() => undefined);
    },
    [route, current, show],
  );

  const autoCompleteCurrent = useCallback(
    (
      pos: { lat: number; lng: number },
      source: "geofence" | "next_stop",
    ) => {
      if (!current || current.status !== "arrived") return;
      if (autoBusy.current) return;
      autoBusy.current = true;
      const name = current.customer_name;
      void completeStopResilient(current.id, {
        exception_code: exception,
        lat: pos.lat,
        lng: pos.lng,
        source,
      })
        .then((r) => {
          setPromptArrive(false);
          setException("none");
          if (r === "queued") show("נשמר במצב לא מקוון", "success");
          else if (source === "next_stop") {
            show(`«${name}» הושלם — ממשיכים ליעד הבא`, "success");
          } else {
            show(`«${name}» הושלם אוטומטית`, "success");
          }
          invalidate();
        })
        .catch(() => undefined)
        .finally(() => {
          autoBusy.current = false;
        });
    },
    [current, exception, show],
  );

  const onExitTarget = useCallback(
    (pos: { lat: number; lng: number }) => {
      autoCompleteCurrent(pos, "geofence");
    },
    [autoCompleteCurrent],
  );

  const geo = useGeofence({
    enabled: Boolean(route && route.status === "in_progress"),
    target,
    depot: depotQ.data
      ? { lat: depotQ.data.lat, lng: depotQ.data.lng }
      : null,
    radiusM: prefsQ.data?.geofence_radius_m ?? 150,
    approachM: 600,
    onEnterTarget,
    onExitTarget,
    onApproach,
    onDepotExit: (pos) => {
      if (!route) return;
      void workDayEvent(route.id, {
        event: "exit",
        lat: pos.lat,
        lng: pos.lng,
      }).catch(() => undefined);
      void logRouteEvent(route.id, "depot_exit_gps", pos).catch(() => undefined);
      show("יציאה מסניף ברינקס — יום העבודה התחיל", "success");
    },
    onDepotEnter: (pos) => {
      if (!route) return;
      void workDayEvent(route.id, {
        event: "enter",
        lat: pos.lat,
        lng: pos.lng,
      })
        .then(() => {
          void logRouteEvent(route.id, "depot_enter_gps", pos).catch(() => undefined);
          show("חזרתם לסניף — יום העבודה הסתיים", "success");
          nav(`/app/summary/${route.id}`, { replace: true });
        })
        .catch(() => {
          invalidate();
        });
    },
  });

  useNextStopAdvance({
    enabled: Boolean(route && route.status === "in_progress"),
    position: geo.position,
    current,
    nextUp,
    radiusM: prefsQ.data?.geofence_radius_m ?? 150,
    onAdvance: (pos) => autoCompleteCurrent(pos, "next_stop"),
  });

  const completeM = useMutation({
    mutationFn: () =>
      completeStopResilient(current!.id, {
        exception_code: exception,
        lat: geo.position?.lat,
        lng: geo.position?.lng,
        source: "manual",
      }),
    onSuccess: (r) => {
      setPromptArrive(false);
      setException("none");
      setMoreActions(false);
      if (r === "queued") show("נשמר במצב לא מקוון", "success");
      else show("יעד הושלם", "success");
      invalidate();
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const skipM = useMutation({
    mutationFn: () => skipStop(current!.id),
    onSuccess: () => {
      setPromptArrive(false);
      setMoreActions(false);
      invalidate();
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  useEffect(() => {
    if (!route || route.status !== "in_progress") return;
    const pull = () => {
      void getDelay(route.id).then((d) => {
        setDelayMin(d.delay_min);
        setReturnAt(d.adjusted_return_at);
        if (d.should_propose && !proposal && geo.position) {
          void reoptimizePropose(route.id, geo.position.lat, geo.position.lng).then(
            (p) => {
              if (p.feasible && p.savings_min > 0) {
                setProposal({
                  message_he: p.message_he,
                  lat: geo.position!.lat,
                  lng: geo.position!.lng,
                });
              }
            },
          );
        }
      });
    };
    pull();
    const t = window.setInterval(pull, 60_000);
    return () => window.clearInterval(t);
  }, [route, geo.position, proposal]);

  useEffect(() => {
    setApproachBanner(false);
  }, [current?.id]);

  if (routeQ.isLoading) {
    return <LoadingScreen label="טוען את מסך הנסיעה" />;
  }

  if (!route || route.stops.length === 0) {
    return (
      <div className="pageShell">
        <EmptyState
          title="אין מסלול לנסיעה"
          description="קודם מתכננים יעדים ומחשבים מסלול — ואז חוזרים לכאן."
          action={
            <Link to="/app/plan" className={styles.ctaLink}>
              לתכנון הסבב
            </Link>
          }
        />
      </div>
    );
  }

  if (route.status === "completed") {
    return <LoadingScreen label="מכינים את ברכת הסיום והסיכום" />;
  }

  if (route.status !== "in_progress") {
    return (
      <div className="pageShell">
        <PageHeader
          kicker="נסיעה"
          title="אשרו את הסדר לפני יציאה"
          lead={`${sorted.length} יעדים מחכים. במסך האישור תראו את כל הכתובות על המפה ואת מיקומכם — ואז «התחל סבב».`}
        />
        <Card className={styles.startCard} data-tour="live-primary">
          <div className={styles.startStats}>
            <div>
              <span className={styles.statLabel}>יעדים</span>
              <strong className="num">{sorted.length}</strong>
            </div>
            <div>
              <span className={styles.statLabel}>מצב</span>
              <strong>ממתין לאישור</strong>
            </div>
          </div>
          <Button size="lg" className={styles.fullBtn} onClick={() => nav("/app/board")}>
            לאישור סבב ולהתחלה
          </Button>
          <Link to="/app/route" className={styles.subtleLink}>
            שינוי סדר ידני
          </Link>
        </Card>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="pageShell">
        <EmptyState
          title="כל היעדים הושלמו — כל הכבוד!"
          description="חזרו לסניף ברינקס. כשתגיעו — היום ייסגר אוטומטית ותקבלו ברכה וסיכום. אפשר גם לסגור ידנית."
          action={
            <Button
              size="lg"
              onClick={() => {
                void workDayEvent(route.id, { event: "enter" }).finally(() => {
                  nav(`/app/summary/${route.id}`, { replace: true });
                });
              }}
            >
              סיים יום וצפה בסיכום
            </Button>
          }
        />
        {geo.denied ? (
          <StatusBanner tone="warning">
            אין הרשאת מיקום — סגירת היום האוטומטית דורשת GPS. השתמשו בכפתור למעלה.
          </StatusBanner>
        ) : (
          <StatusBanner tone="info" role="status">
            מזהים מיקום בזמן אמת
            {geo.position ? " · מחכים לחזרה לסניף" : " · ממתינים ל-GPS"}
          </StatusBanner>
        )}
      </div>
    );
  }

  const navLat = current.parking_lat ?? current.lat;
  const navLng = current.parking_lng ?? current.lng;
  const sosPhone = prefsQ.data?.sos_phone;
  const pct = sorted.length ? Math.round((doneCount / sorted.length) * 100) : 0;

  return (
    <div className={`pageShell ${styles.page}`}>
      {offlineN > 0 || !navigator.onLine ? (
        <StatusBanner tone="danger" role="status">
          {!navigator.onLine ? "לא מקוון" : "ממתין לסנכרון"}
          {offlineN > 0 ? ` · ${offlineN}` : ""}
        </StatusBanner>
      ) : null}

      {geo.denied ? (
        <StatusBanner tone="warning">
          אין הרשאת מיקום — אפשר להמשיך ידנית: נווט בוויז וסמנו «הגעתי».
        </StatusBanner>
      ) : null}

      {current.status === "arrived" && !promptArrive ? (
        <StatusBanner tone="success" role="status">
          במקום אצל «{current.customer_name}» — ביציאה היעד ייסגר אוטומטית
        </StatusBanner>
      ) : null}

      {approachBanner || geo.approaching ? (
        <StatusBanner tone="info" role="status">
          מתקרבים ל«{current.customer_name}»
          {geo.distanceM != null ? ` · ${Math.round(geo.distanceM)} מ'` : ""}
        </StatusBanner>
      ) : null}

      {proposal ? (
        <Card className={styles.proposal} statusBar="gold">
          <p className={styles.proposalTitle}>הצעה לחיסכון זמן</p>
          <p>{proposal.message_he}</p>
          <div className={styles.rowBtns}>
            <Button
              size="lg"
              onClick={() => {
                void reoptimizeApply(route.id, proposal.lat, proposal.lng).then(() => {
                  setProposal(null);
                  invalidate();
                  show("הסידור החדש הוחל", "success");
                });
              }}
            >
              החל שינוי
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setProposal(null)}>
              השאר כמו שהוא
            </Button>
          </div>
        </Card>
      ) : null}

      <div className={styles.progressRow} aria-label={`התקדמות ${doneCount} מתוך ${sorted.length}`}>
        <span className="num">
          {doneCount}/{sorted.length}
        </span>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.progressPct}>{pct}%</span>
      </div>

      <section className={styles.hero} aria-label="יעד נוכחי">
        <p className={styles.heroKicker}>היעד הבא</p>
        <h1 className={styles.stopName}>{current.customer_name}</h1>
        <p className={styles.address}>{current.address}</p>
        <div className={styles.etaBlock}>
          <span className={styles.etaLabel}>הגעה משוערת</span>
          <span className={`${styles.eta} num`}>{formatEta(current.eta)}</span>
        </div>
        <div className={styles.returnRow}>
          <span className={styles.etaLabel}>צפי חזרה לברינקס</span>
          <strong className={`${styles.returnEta} num`}>{formatEta(returnAt)}</strong>
          {delayMin > 0 ? (
            <span className={styles.delayChip}>איחור מצטבר {delayMin} דק׳</span>
          ) : null}
        </div>
        <div className={styles.meta}>
          {geo.distanceM != null ? `${Math.round(geo.distanceM)} מ' ממכם` : "ממתינים למיקום"}
          {current.learned_badge ? ` · ${current.learned_badge}` : ""}
          {current.parking_badge ? ` · ${current.parking_badge}` : ""}
        </div>
      </section>

      <div className={styles.primaryActions} data-tour="live-primary">
        <Button size="lg" className={styles.waze} onClick={() => openWaze(navLat, navLng)}>
          נווט בוויז
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className={styles.doneBtn}
          loading={completeM.isPending}
          onClick={() => {
            setPromptArrive(true);
          }}
        >
          הגעתי / סמן בוצע
        </Button>
      </div>

      {promptArrive ? (
        <Card className={styles.arrivePrompt} statusBar="success">
          <p className={styles.promptText}>סיימתם ב«{current.customer_name}»?</p>
          <p className={styles.promptHint}>אם היה עיכוב — סמנו בקצרה:</p>
          <div className={styles.chips}>
            {EXCEPTIONS.map((x) => (
              <button
                key={x.id}
                type="button"
                className={exception === x.id ? styles.chipOn : styles.chip}
                onClick={() => setException(x.id)}
              >
                {x.label}
              </button>
            ))}
          </div>
          <Button size="lg" className={styles.fullBtn} loading={completeM.isPending} onClick={() => completeM.mutate()}>
            אשר השלמה
          </Button>
          <Button variant="ghost" onClick={() => setPromptArrive(false)}>
            ביטול
          </Button>
        </Card>
      ) : null}

      {nextUp ? (
        <div className={styles.nextUp}>
          <span className={styles.nextLabel}>אחריו</span>
          <strong>{nextUp.customer_name}</strong>
          <span className={`${styles.nextEta} num`}>{formatEta(nextUp.eta)}</span>
        </div>
      ) : null}

      <div className={styles.tools}>
        <button type="button" className={styles.toolBtn} onClick={() => setDrawer(true)}>
          פרטים
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setListOpen((v) => !v)}
        >
          {listOpen ? "הסתר רשימה" : "כל היעדים"}
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setMoreActions((v) => !v)}
        >
          עוד
        </button>
      </div>

      {moreActions ? (
        <div className={styles.morePanel}>
          <Button variant="ghost" size="lg" onClick={() => skipM.mutate()}>
            דלג על יעד זה
          </Button>
        </div>
      ) : null}

      {listOpen ? (
        <ul className={styles.list}>
          {sorted.map((s: StopDto) => (
            <li
              key={s.id}
              className={
                s.id === current.id
                  ? styles.current
                  : s.status === "done" || s.status === "skipped"
                    ? styles.done
                    : undefined
              }
            >
              <span className="num">{s.sequence_order + 1}</span>
              <span>{s.customer_name}</span>
              <span className={`${styles.listEta} num`}>{formatEta(s.eta)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <button type="button" className={styles.sos} onClick={() => setSosOpen(true)} aria-label="SOS">
        SOS
      </button>

      {drawer ? (
        <div className={styles.drawer} role="dialog" aria-modal="true">
          <Card>
            <h2 className={styles.drawerTitle}>{current.customer_name}</h2>
            <p className={styles.drawerLine}>{current.address}</p>
            {current.learned_badge ? (
              <p className={styles.drawerMeta}>{current.learned_badge}</p>
            ) : null}
            {current.parking_badge ? (
              <p className={styles.drawerMeta}>{current.parking_badge}</p>
            ) : null}
            {current.notes ? <p className={styles.drawerLine}>{current.notes}</p> : null}
            <Button variant="ghost" onClick={() => setDrawer(false)}>
              סגור
            </Button>
          </Card>
        </div>
      ) : null}

      {sosOpen ? (
        <div className={styles.drawer} role="dialog" aria-modal="true">
          <Card>
            <h2 className={styles.drawerTitle}>קריאת SOS</h2>
            <p className={styles.drawerLine}>חיוג למוקד בקרה — לא מערכת אבטחה.</p>
            <div className={styles.rowBtns}>
              <Button
                size="lg"
                variant="danger"
                disabled={!sosPhone}
                onClick={() => {
                  void logRouteEvent(route.id, "sos", { phone: sosPhone });
                  if (sosPhone) window.location.href = `tel:${sosPhone}`;
                  setSosOpen(false);
                }}
              >
                חייג עכשיו
              </Button>
              <Button variant="ghost" size="lg" onClick={() => setSosOpen(false)}>
                ביטול
              </Button>
            </div>
            {!sosPhone ? (
              <p className={styles.hint}>
                הגדירו מספר ב<Link to="/app/settings">הגדרות</Link>
              </p>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
