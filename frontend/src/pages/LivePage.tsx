import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { addStop, getDepot, getTodayRoute, reorderManual } from "../api/planning";
import type { StopDto } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { HowItWorks } from "../components/ui/HowItWorks";
import { PageHeader } from "../components/ui/PageHeader";
import { HELP_LIVE } from "../lib/helpCopy";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { StatusBanner } from "../components/ui/StatusBanner";
import { useToast } from "../components/ui/ToastProvider";
import { useGeofence } from "../hooks/useGeofence";
import { useLiveLockNotifications } from "../hooks/useLiveLockNotifications";
import { useNextStopAdvance } from "../hooks/useNextStopAdvance";
import { useWakeLock } from "../hooks/useWakeLock";
import { cacheActiveRoute, queueLength } from "../lib/offlineQueue";
import { alertApproach, alertArrive } from "../lib/liveNotifications";
import { firstVipAtRisk, formatTimeHe, returnTimeLabel, sortedStops } from "../lib/roundBrief";
import { openWaze } from "../lib/waze";
import { useChromeStore } from "../store/chromeStore";
import { useOverlayStore } from "../store/overlayStore";
import styles from "./LivePage.module.css";

const EXCEPTIONS = [
  { id: "customer_not_ready", label: "לקוח לא מוכן" },
  { id: "gate_wait", label: "המתנה בשער" },
  { id: "parking", label: "חניה" },
  { id: "closed", label: "סגור" },
  { id: "branch_busy", label: "עומס" },
  { id: "other", label: "אחר" },
] as const;

function formatEta(iso: string | null | undefined): string {
  if (!iso) return "--:--";
  return formatTimeHe(iso);
}

export default function LivePage() {
  const { show } = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const setDrivingLocked = useChromeStore((s) => s.setDrivingLocked);
  const openDetail = useOverlayStore((s) => s.openDetail);
  const openFullList = useOverlayStore((s) => s.openFullList);

  const [offlineN, setOfflineN] = useState(0);
  const [proposal, setProposal] = useState<{ message_he: string; lat: number; lng: number } | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [moreActions, setMoreActions] = useState(false);
  const [approachBanner, setApproachBanner] = useState(false);
  const [returnAt, setReturnAt] = useState<string | null>(null);
  const [delayMin, setDelayMin] = useState(0);
  const [note, setNote] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [exReason, setExReason] = useState<string | null>(null);
  const [exPlan, setExPlan] = useState<"retry" | "drop" | null>(null);
  const [vipDismissed, setVipDismissed] = useState<Set<number>>(() => new Set());
  const [vipDialogStop, setVipDialogStop] = useState<StopDto | null>(null);
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

  const sorted = useMemo(() => sortedStops(route), [route]);
  const current =
    sorted.find((s) => s.status === "arrived") ?? sorted.find((s) => s.status === "pending") ?? null;
  const nextUp =
    (current
      ? sorted.find((s) => s.status === "pending" && s.sequence_order > current.sequence_order)
      : null) ?? null;
  const doneCount = sorted.filter((s) => s.status === "done" || s.status === "skipped").length;
  const pendingLeft = sorted.filter((s) => s.status !== "done" && s.status !== "skipped").length;

  const vipRisk = route?.status === "in_progress" ? firstVipAtRisk(sorted.filter((s) => !vipDismissed.has(s.id))) : null;

  useLayoutEffect(() => {
    setDrivingLocked(Boolean(route && route.status === "in_progress" && current));
    return () => setDrivingLocked(false);
  }, [route, current, setDrivingLocked]);

  useEffect(() => {
    if (current?.status !== "arrived") return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [current?.status, current?.id]);

  useLiveLockNotifications({
    live: route?.status === "in_progress",
    current,
    returnHm: returnTimeLabel(route),
    leftCount: pendingLeft,
  });

  const target = current ? { lat: current.parking_lat ?? current.lat, lng: current.parking_lng ?? current.lng } : null;

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
          void alertArrive(current.customer_name);
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
      void alertApproach(current.customer_name, distanceM);
      void notifyApproach(route.id, { stop_id: current.id, distance_m: distanceM }).catch(() => undefined);
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
    (pos: { lat: number; lng: number }, source: "geofence" | "next_stop") => {
      if (!current || current.status !== "arrived") return;
      if (autoBusy.current) return;
      autoBusy.current = true;
      const name = current.customer_name;
      void completeStopResilient(current.id, { lat: pos.lat, lng: pos.lng, source })
        .then((r) => {
          setNote("");
          if (r === "queued") show("נשמר במצב לא מקוון", "success");
          else if (source === "next_stop") show(`«${name}» הושלם — ממשיכים ליעד הבא`, "success");
          else show(`«${name}» הושלם אוטומטית`, "success");
          invalidate();
        })
        .catch(() => undefined)
        .finally(() => {
          autoBusy.current = false;
        });
    },
    [current, show],
  );

  const onExitTarget = useCallback((pos: { lat: number; lng: number }) => autoCompleteCurrent(pos, "geofence"), [
    autoCompleteCurrent,
  ]);

  const geo = useGeofence({
    enabled: Boolean(route && route.status === "in_progress"),
    target,
    depot: depotQ.data ? { lat: depotQ.data.lat, lng: depotQ.data.lng } : null,
    radiusM: prefsQ.data?.geofence_radius_m ?? 150,
    approachM: 600,
    onEnterTarget,
    onExitTarget,
    onApproach,
    onDepotExit: (pos) => {
      if (!route) return;
      void workDayEvent(route.id, { event: "exit", lat: pos.lat, lng: pos.lng }).catch(() => undefined);
      void logRouteEvent(route.id, "depot_exit_gps", pos).catch(() => undefined);
      show("יציאה מסניף ברינקס — יום העבודה התחיל", "success");
    },
    onDepotEnter: (pos) => {
      if (!route) return;
      void workDayEvent(route.id, { event: "enter", lat: pos.lat, lng: pos.lng })
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

  const arriveM = useMutation({
    mutationFn: () => arriveStop(current!.id, geo.position?.lat, geo.position?.lng, "manual"),
    onSuccess: () => {
      invalidate();
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const completeM = useMutation({
    mutationFn: (exceptionCode: string | undefined) =>
      completeStopResilient(current!.id, {
        exception_code: exceptionCode,
        lat: geo.position?.lat,
        lng: geo.position?.lng,
        source: "manual",
      }),
    onSuccess: (r) => {
      setNote("");
      if (r === "queued") show("נשמר במצב לא מקוון", "success");
      else show("יעד הושלם", "success");
      invalidate();
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const skipM = useMutation({
    mutationFn: (skipNote?: string) => skipStop(current!.id, skipNote),
    onSuccess: () => {
      setMoreActions(false);
      invalidate();
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const exConfirmM = useMutation({
    mutationFn: async () => {
      if (!current || !route || !exReason || !exPlan) return;
      const reasonLabel = EXCEPTIONS.find((x) => x.id === exReason)?.label ?? exReason;
      if (exPlan === "drop") {
        await skipStop(current.id, reasonLabel);
      } else {
        await completeStopResilient(current.id, { exception_code: exReason, source: "manual" });
        await addStop(route.id, {
          customer_name: current.customer_name,
          address: current.address,
          lat: current.lat,
          lng: current.lng,
          priority: current.priority,
          tw_type: current.tw_type,
          tw_start: current.tw_start,
          tw_end: current.tw_end,
          service_duration_min: current.service_duration_min,
          notes: `חזרה לאחר שלא הושלם בסבב זה · ${reasonLabel}`,
        });
      }
    },
    onSuccess: () => {
      setExceptionOpen(false);
      setExReason(null);
      setExPlan(null);
      invalidate();
      show(exPlan === "drop" ? "העצירה סומנה כלא בוצעה" : "העצירה תחזור בסוף הסבב", "success");
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const vipFixM = useMutation({
    mutationFn: async () => {
      if (!route || !vipDialogStop) return;
      const stops = sortedStops(route);
      const ids = stops.map((s) => s.id);
      const idx = ids.indexOf(vipDialogStop.id);
      if (idx > 0) {
        const before = stops[idx - 1];
        if (before.status !== "done" && before.status !== "skipped") {
          [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
          await reorderManual(route.id, ids);
        }
      }
    },
    onSuccess: () => {
      if (vipDialogStop) setVipDismissed((prev) => new Set(prev).add(vipDialogStop.id));
      setVipDialogStop(null);
      invalidate();
      show("הסדר עודכן", "success");
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
          void reoptimizePropose(route.id, geo.position.lat, geo.position.lng).then((p) => {
            if (p.feasible && p.savings_min > 0) {
              setProposal({ message_he: p.message_he, lat: geo.position!.lat, lng: geo.position!.lng });
            }
          });
        }
      });
    };
    pull();
    const t = window.setInterval(pull, 60_000);
    return () => window.clearInterval(t);
  }, [route, geo.position, proposal]);

  useEffect(() => {
    setApproachBanner(false);
    setNote("");
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
          lead={`${sorted.length} יעדים מוכנים. אשרו על המפה ואז «התחל סבב».`}
        />
        <HowItWorks block={HELP_LIVE} defaultOpen />
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
  const wazeHref = `https://waze.com/ul?ll=${navLat},${navLng}&navigate=yes`;
  const sosPhone = prefsQ.data?.sos_phone;
  const pct = sorted.length ? Math.round((doneCount / sorted.length) * 100) : 0;
  const arrivedElapsedSec = current.actual_arrival
    ? Math.max(0, Math.floor((nowTick - new Date(current.actual_arrival).getTime()) / 1000))
    : 0;
  const goalMin = Math.max(2, current.service_duration_min || 7);
  const ringPct = Math.min(100, Math.round((arrivedElapsedSec / (goalMin * 60)) * 100));
  const mm = Math.floor(arrivedElapsedSec / 60);
  const ss = String(arrivedElapsedSec % 60).padStart(2, "0");

  const banners: JSX.Element[] = [];
  if (offlineN > 0 || !navigator.onLine) {
    banners.push(
      <div key="offline" className={`${styles.banner} ${styles.bannerDanger}`}>
        {!navigator.onLine ? "לא מקוון" : "ממתין לסנכרון"}
        {offlineN > 0 ? ` · ${offlineN}` : ""}
      </div>,
    );
  }
  if (geo.denied) {
    banners.push(
      <div key="gps" className={`${styles.banner} ${styles.bannerInfo}`}>
        אין הרשאת מיקום — אפשר להמשיך ידנית: נווט בוויז וסמנו «הגעתי».
      </div>,
    );
  }
  if (current.status === "arrived" && !exceptionOpen) {
    banners.push(
      <div key="arrived" className={`${styles.banner} ${styles.bannerSuccess}`}>
        במקום אצל «{current.customer_name}» — ביציאה היעד ייסגר אוטומטית
      </div>,
    );
  }
  if (approachBanner || geo.approaching) {
    banners.push(
      <div key="approach" className={`${styles.banner} ${styles.bannerInfo}`}>
        מתקרבים ל«{current.customer_name}»
        {geo.distanceM != null ? ` · ${Math.round(geo.distanceM)} מ'` : ""}
      </div>,
    );
  }
  if (proposal) {
    banners.push(
      <div key="proposal" className={`${styles.banner} ${styles.bannerGold}`}>
        <p className={styles.bannerGoldTitle}>הצעה לחיסכון זמן</p>
        <p style={{ margin: 0 }}>{proposal.message_he}</p>
        <div className={styles.bannerBtns}>
          <button
            type="button"
            className={`${styles.bannerBtnPrimary} tap`}
            onClick={() => {
              void reoptimizeApply(route.id, proposal.lat, proposal.lng).then(() => {
                setProposal(null);
                invalidate();
                show("הסידור החדש הוחל", "success");
              });
            }}
          >
            החל שינוי
          </button>
          <button type="button" className={`${styles.bannerBtnGhost} tap`} onClick={() => setProposal(null)}>
            השאר כמו שהוא
          </button>
        </div>
      </div>,
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.body}>
        {banners.length > 0 ? <div className={styles.bannerStack}>{banners}</div> : null}

        <div className={styles.progress} aria-label={`התקדמות ${doneCount} מתוך ${sorted.length}`}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
          <span className={`${styles.progressPos} num`}>
            {doneCount}/{sorted.length}
          </span>
        </div>

        {current.status !== "arrived" ? (
          <>
            <div className={styles.heroBlock}>
              <div className={styles.heroEyebrow}>העצירה הבאה</div>
              <h1 className={styles.heroStopName}>{current.customer_name}</h1>
              <p className={styles.heroAddr}>{current.address}</p>
              <p className={styles.heroDetail}>
                {current.priority === "vip"
                  ? "לקוח VIP · חלון זמן קבוע"
                  : current.parking_badge || "כניסת שירות · חנייה בכיכר"}
              </p>
            </div>

            <div className={styles.etaRow}>
              <div className={`${styles.etaNum} num`}>{formatEta(current.eta)}</div>
              <div className={styles.etaCaption}>
                הגעה
                <br />
                משוערת
              </div>
            </div>

            <div className={styles.returnStrip}>
              <span className={styles.returnLabel}>חזרה לברינקס</span>
              <span className={styles.returnValRow}>
                <span className={`${styles.returnVal} num`}>{returnAt ? formatEta(returnAt) : returnTimeLabel(route)}</span>
                {delayMin > 0 ? <span className={styles.returnDelay}>+{delayMin}</span> : null}
              </span>
            </div>

            {vipRisk ? (
              <button
                type="button"
                className={`${styles.banner} ${styles.bannerDanger} tap`}
                style={{ textAlign: "start", display: "block" }}
                onClick={() => setVipDialogStop(vipRisk)}
              >
                <strong style={{ display: "block", marginBottom: 2 }}>חלון VIP בסיכון</strong>
                {vipRisk.customer_name} · חלון עד {vipRisk.tw_end?.slice(0, 5)} · צפי {formatEta(vipRisk.eta)}
              </button>
            ) : null}

            <div className={styles.spacer} />

            <div className={styles.actions} data-tour="live-primary">
              <button
                type="button"
                className={`${styles.primaryBrass} tap`}
                disabled={arriveM.isPending}
                onClick={() => arriveM.mutate()}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--field-ink)" strokeWidth="2.6" strokeLinecap="round">
                  <path d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z" />
                  <circle cx="12" cy="10" r="2.4" />
                </svg>
                הגעתי
              </button>
              <div className={styles.actionRow}>
                <a href={wazeHref} target="_blank" rel="noreferrer" className={`${styles.wazeBtn} tap`} onClick={() => openWaze(navLat, navLng)}>
                  נווט ב־Waze
                </a>
                <button type="button" className={`${styles.listBtn} tap`} onClick={openFullList}>
                  הרשימה
                </button>
              </div>
              <button type="button" className={`${styles.nextLine} tap`} onClick={() => nav("/app/dashboard")}>
                {nextUp ? (
                  <>
                    אחר כך · {nextUp.customer_name} <span className="num">{formatEta(nextUp.eta)}</span>
                  </>
                ) : (
                  "זו העצירה האחרונה"
                )}
              </button>
            </div>
          </>
        ) : (
          <div className={styles.arrivedBody}>
            <div className={styles.statusRow}>
              <span className={styles.statusDot} />
              בנקודה · עצירה {doneCount + 1}/{sorted.length}
            </div>
            <div className={styles.arrivedName}>{current.customer_name}</div>
            <div className={styles.arrivedAddr}>{current.address}</div>
            <div className={styles.ring} style={{ background: `conic-gradient(var(--field-brass-light) 0 ${ringPct}%, rgba(255,255,255,.1) 0)` }}>
              <div className={styles.ringInner}>
                <div className={styles.ringLabel}>זמן בנקודה</div>
                <div className={`${styles.ringTimer} num`}>
                  {mm}:{ss}
                </div>
                <div className={styles.ringLabel}>צפי {goalMin} דק׳</div>
              </div>
            </div>
            <div className={styles.arrivedNote}>{note}</div>

            <div className={styles.spacer} />

            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.finishBtn} tap`}
                disabled={completeM.isPending}
                onClick={() => completeM.mutate(undefined)}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                  <path d="M5 13l4 4 10-10" />
                </svg>
                סיימתי כאן
              </button>
              <div className={styles.chipRow}>
                <button type="button" className={`${styles.chipBtn} tap`} onClick={() => setExceptionOpen(true)}>
                  לא בוצע
                </button>
                <button type="button" className={`${styles.chipBtn} tap`} onClick={() => openDetail(current.id)}>
                  פרטי הנקודה
                </button>
                <button
                  type="button"
                  className={`${styles.chipBtn} tap`}
                  onClick={() => {
                    setNote("סומן: עיכוב — צפי החזרה יעודכן אוטומטית");
                    void logRouteEvent(route.id, "delay_flag", { stop_id: current.id }).catch(() => undefined);
                  }}
                >
                  עיכוב
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.utilRow}>
          <button type="button" className={`${styles.utilLink} tap`} onClick={() => openDetail(current.id)}>
            פרטי היעד
          </button>
          <span className={styles.utilDot}>·</span>
          <button type="button" className={`${styles.utilLink} tap`} onClick={() => setMoreActions((v) => !v)}>
            עוד אפשרויות
          </button>
        </div>

        {moreActions ? (
          <div className={styles.bannerStack}>
            <button
              type="button"
              className={`${styles.chipBtn} tap`}
              onClick={() => {
                skipM.mutate(undefined);
              }}
            >
              דלג על יעד זה
            </button>
            <button type="button" className={`${styles.chipBtn} tap`} onClick={() => nav("/app/add-stop")}>
              הוספת יעד עם בדיקת השפעה
            </button>
            <button type="button" className={`${styles.chipBtn} tap`} onClick={() => nav("/app/route")}>
              סדר מלא עם גרירה
            </button>
          </div>
        ) : null}
      </div>

      <button type="button" className={`${styles.sos} tap`} onClick={() => setSosOpen(true)} aria-label="SOS">
        SOS
      </button>

      {exceptionOpen ? (
        <div className={styles.exOverlay}>
          <div className={styles.exHead}>
            <span className={styles.exIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                <path d="M12 8v5" />
                <circle cx="12" cy="16.6" r="1.1" fill="currentColor" stroke="none" />
                <path d="M12 3.5L21 19H3z" />
              </svg>
            </span>
            <div>
              <div className={styles.exTitle}>העצירה לא בוצעה</div>
              <div className={styles.exSub}>
                {current.customer_name} · עצירה {doneCount + 1}/{sorted.length}
              </div>
            </div>
          </div>

          <div>
            <div className={styles.exSectionLabel}>מה קרה בפועל?</div>
            <div className={styles.exReasons}>
              {EXCEPTIONS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className={`${styles.exReason} ${exReason === x.id ? styles.exReasonOn : ""} tap`}
                  onClick={() => setExReason(x.id)}
                >
                  <span className={styles.exRing}>
                    {exReason === x.id ? <span className={styles.exRingFill} style={{ background: "var(--field-brass-light)" }} /> : null}
                  </span>
                  <span style={{ fontSize: 15.5, fontWeight: 600 }}>{x.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.exPanel}>
            <div className={styles.exSectionLabel} style={{ margin: 0 }}>מה קורה עם העצירה</div>
            <button
              type="button"
              className={`${styles.exDisposition} ${exPlan === "retry" ? styles.exDispositionOn : ""} tap`}
              onClick={() => setExPlan("retry")}
            >
              <span style={{ fontWeight: 600 }}>חזרה בסוף הסבב</span>
              <span className="num" style={{ fontSize: 13.5, color: "var(--field-muted-dark)" }}>
                יעד חדש
              </span>
            </button>
            <button
              type="button"
              className={`${styles.exDisposition} ${exPlan === "drop" ? styles.exDispositionOn : ""} tap`}
              onClick={() => setExPlan("drop")}
            >
              <span style={{ fontWeight: 600 }}>ביטול והעברה למחר</span>
              <span style={{ fontSize: 13.5, color: "var(--field-muted-dark)" }}>דיווח למוקד</span>
            </button>
          </div>

          <div className={styles.exImpact}>
            {exPlan === "retry"
              ? "העצירה תתווסף מחדש בסוף הסבב — צפי החזרה יתעדכן לאחר האישור."
              : exPlan === "drop"
                ? "העצירה תסומן כלא בוצעה ותוסר מהסבב של היום."
                : "בחר מה קורה עם העצירה כדי לראות את ההשפעה."}
          </div>

          <button
            type="button"
            className={`${styles.exConfirm} tap`}
            style={{ opacity: exReason && exPlan ? 1 : 0.45 }}
            disabled={!exReason || !exPlan || exConfirmM.isPending}
            onClick={() => exConfirmM.mutate()}
          >
            שלח דיווח והמשך
          </button>
          <button
            type="button"
            className={`${styles.exCancel} tap`}
            onClick={() => {
              setExceptionOpen(false);
              setExReason(null);
              setExPlan(null);
            }}
          >
            חזרה — העצירה בוצעה בכל זאת
          </button>
        </div>
      ) : null}

      {vipDialogStop ? (
        <>
          <button
            type="button"
            style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(4,10,20,.6)", border: "none" }}
            onClick={() => setVipDialogStop(null)}
            aria-label="סגור"
          />
          <div className={styles.vipDialog} role="dialog" aria-modal="true">
            <div className={styles.vipHead}>
              <span className={styles.vipIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M12 8v5" />
                  <circle cx="12" cy="16.6" r="1.1" fill="currentColor" stroke="none" />
                  <path d="M12 3.5L21 19H3z" />
                </svg>
              </span>
              <div>
                <div className={styles.vipTitle}>חלון VIP בסיכון</div>
                <div className={styles.vipSub}>
                  {vipDialogStop.customer_name} · חלון עד {vipDialogStop.tw_end?.slice(0, 5)}
                </div>
              </div>
            </div>
            <div className={styles.vipTiles}>
              <div className={styles.vipTile} style={{ background: "var(--field-day-bg)" }}>
                <div className={styles.vipTileLabel}>הגעה בסדר הנוכחי</div>
                <div className={`${styles.vipTileVal} num`} style={{ color: "var(--field-exception)" }}>
                  {formatEta(vipDialogStop.eta)}
                </div>
              </div>
              <div className={styles.vipTile} style={{ background: "rgba(31,170,99,.1)" }}>
                <div className={styles.vipTileLabel}>אם נקדים אותו</div>
                <div className={`${styles.vipTileVal} num`} style={{ color: "var(--field-done)" }}>
                  לפני התור הנוכחי
                </div>
              </div>
            </div>
            <div className={styles.vipBody}>
              הקדמת {vipDialogStop.customer_name} בתור עלולה לדחות את העצירה שלפניו. צפי החזרה יתעדכן מייד לאחר האישור.
            </div>
            <button type="button" className={`${styles.vipPrimary} tap`} disabled={vipFixM.isPending} onClick={() => vipFixM.mutate()}>
              הקדם את {vipDialogStop.customer_name}
            </button>
            <button
              type="button"
              className={`${styles.vipSecondary} tap`}
              onClick={() => {
                setVipDismissed((prev) => new Set(prev).add(vipDialogStop.id));
                setVipDialogStop(null);
              }}
            >
              השאר את הסדר כמו שהוא
            </button>
          </div>
        </>
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
