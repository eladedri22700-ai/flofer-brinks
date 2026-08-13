import type { DraftStop } from "../api/client";
import { apiErrorMessage } from "../api/errors";
import {
  addStop,
  addStopsBulk,
  addStopsFromCustomers,
  createTodayRoute,
  deleteStop,
  extractFromImage,
  getDepot,
  getKeysStatus,
  getTodayRoute,
  importFile,
  optimizeRoute,
  patchRoute,
  patchStop,
  reorderManual,
  reorderStops,
} from "../api/planning";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useToast } from "../components/ui/ToastProvider";
import { CustomerPickerTab } from "../components/plan/CustomerPicker";
import { FileInputTab } from "../components/plan/FileInput";
import { ManualInput } from "../components/plan/ManualInput";
import { ScreenshotInputTab } from "../components/plan/ScreenshotInput";
import {
  StopsList,
  type StopConstraintsPatch,
  type StopDetailsPatch,
} from "../components/plan/StopsList";
import { HowItWorks } from "../components/ui/HowItWorks";
import { PageHeader } from "../components/ui/PageHeader";
import { HELP_PLAN, HELP_PLAN_LIVE } from "../lib/helpCopy";
import { StatusBanner } from "../components/ui/StatusBanner";
import { EmptyState } from "../components/ui/EmptyState";
import styles from "./PlanPage.module.css";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { emitTourEvent } from "../lib/tourEvents";
import { isRoundLive } from "../lib/roundBrief";
import { useTourStore } from "../store/tourStore";

const OPT_STEPS = ["מחשב מרחקים…", "מסדר מסלול…", "בודק אילוצים…"] as const;

type Tab = "manual" | "file" | "shot" | "library";

function parseTimeNote(note: string | null | undefined): Partial<{
  tw_type: string;
  tw_start: string | null;
  tw_end: string | null;
}> {
  if (!note) return { tw_type: "none" };
  const until = note.match(/עד\s*(\d{1,2}:\d{2})/);
  const after = note.match(/משעה\s*(\d{1,2}:\d{2})/);
  const between = note.match(/בין\s*(\d{1,2}:\d{2})\s*ל-?\s*(\d{1,2}:\d{2})/);
  if (between) return { tw_type: "window", tw_start: between[1], tw_end: between[2] };
  if (until) return { tw_type: "before", tw_end: until[1], tw_start: null };
  if (after) return { tw_type: "after", tw_start: after[1], tw_end: null };
  return { tw_type: "none" };
}

function formatDateHe(iso: string): string {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return iso;
  }
}

function isPlanTab(value: string | null): value is Tab {
  return (
    value === "manual" ||
    value === "file" ||
    value === "shot" ||
    value === "library"
  );
}

export default function PlanPage() {
  const { show } = useToast();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const tourPlanTab = useTourStore((s) => s.planTab);
  const [tab, setTab] = useState<Tab>("library");
  const [optStep, setOptStep] = useState<number | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [constraintsSavingId, setConstraintsSavingId] = useState<number | null>(
    null,
  );
  const [detailsSavingId, setDetailsSavingId] = useState<number | null>(null);

  const keysQ = useQuery({ queryKey: ["keys-status"], queryFn: getKeysStatus });
  const depotQ = useQuery({ queryKey: ["depot"], queryFn: getDepot });
  const routeQ = useQuery({ queryKey: ["route-today"], queryFn: getTodayRoute });

  useEffect(() => {
    const fromUrl = searchParams.get("tab");
    if (isPlanTab(fromUrl)) setTab(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (tourPlanTab) setTab(tourPlanTab);
  }, [tourPlanTab]);

  useEffect(() => {
    if (searchParams.get("tab")) return;
    if (tourPlanTab) return;
    if (routeQ.data && isRoundLive(routeQ.data.status)) setTab("shot");
  }, [routeQ.data, searchParams, tourPlanTab]);

  useEffect(() => {
    if (routeQ.isFetched && routeQ.data === null) {
      void createTodayRoute()
        .then(() => qc.invalidateQueries({ queryKey: ["route-today"] }))
        .catch((err: unknown) => show(apiErrorMessage(err), "error"));
    }
  }, [routeQ.isFetched, routeQ.data, qc, show]);

  const route = routeQ.data;
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["route-today"] });

  const addM = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (route!.status === "in_progress") {
        const { whatIfStop } = await import("../api/live");
        const preview = await whatIfStop(route!.id, {
          customer_name: payload.customer_name,
          address: payload.address,
          lat: payload.lat ?? 32.08,
          lng: payload.lng ?? 34.78,
          service_duration_min: payload.service_duration_min ?? 12,
          tw_type: payload.tw_type ?? "none",
          priority: payload.priority ?? "normal",
        });
        const ok = window.confirm(`${preview.message_he}\n\nלהוסיף את היעד?`);
        if (!ok) throw { message_he: "ההוספה בוטלה" };
      }
      return addStop(route!.id, payload);
    },
    onSuccess: () => {
      show("היעד נוסף ונשמר ללקוחות", "success");
      emitTourEvent("tour:stop-added");
      invalidate();
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const fromCustomersM = useMutation({
    mutationFn: (customerIds: number[]) =>
      addStopsFromCustomers(route!.id, customerIds),
    onSuccess: (stops) => {
      show(
        stops.length === 1 ? "הלקוח נוסף לסבב" : `${stops.length} לקוחות נוספו לסבב`,
        "success",
      );
      emitTourEvent("tour:stop-added");
      invalidate();
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const bulkM = useMutation({
    mutationFn: async (drafts: DraftStop[]) => {
      const stops = drafts.map((d) => ({
        customer_name: d.customer_name,
        address: d.address,
        category: d.category ?? "other",
        priority: d.priority ?? "normal",
        ...parseTimeNote(d.time_note),
      }));
      return addStopsBulk(route!.id, stops);
    },
    onSuccess: () => {
      show("היעדים נוספו ונשמרו ללקוחות", "success");
      emitTourEvent("tour:ocr-committed");
      invalidate();
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const reorderM = useMutation({
    mutationFn: async (ids: number[]) => {
      if (route!.status === "in_progress") {
        return reorderManual(route!.id, ids);
      }
      return reorderStops(route!.id, ids);
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ["route-today"] });
      const prev = qc.getQueryData(["route-today"]);
      if (route) {
        const byId = new Map(route.stops.map((s) => [s.id, s]));
        const optimistic = {
          ...route,
          stops: ids.map((id, i) => ({ ...byId.get(id)!, sequence_order: i })),
        };
        qc.setQueryData(["route-today"], optimistic);
      }
      return { prev };
    },
    onSuccess: (res) => {
      if (
        res &&
        typeof res === "object" &&
        "warnings_he" in res &&
        Array.isArray(res.warnings_he) &&
        res.warnings_he.length
      ) {
        show(String(res.warnings_he[0]), "error");
      } else if (route?.status === "in_progress") {
        show("הסדר עודכן · ETA חושב מחדש", "success");
      }
    },
    onError: (e, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(["route-today"], ctx.prev);
      show(apiErrorMessage(e, "סידור מחדש נכשל"), "error");
    },
    onSettled: invalidate,
  });

  const deleteM = useMutation({
    mutationFn: async (id: number) => {
      await deleteStop(id);
      if (route?.status === "in_progress") {
        const remaining = [...route.stops]
          .filter((s) => s.id !== id)
          .sort((a, b) => a.sequence_order - b.sequence_order)
          .map((s) => s.id);
        if (remaining.length > 0) {
          await reorderManual(route.id, remaining);
        }
      }
    },
    onSuccess: () => {
      show(
        route?.status === "in_progress"
          ? "היעד הוסר · הזמנים עודכנו"
          : "היעד הוסר מהרשימה",
        "success",
      );
      invalidate();
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const patchStopM = useMutation({
    mutationFn: ({ id, lat, lng }: { id: number; lat: number; lng: number }) =>
      patchStop(id, { lat, lng, geocode_confidence: 1 }),
    onSuccess: () => {
      show("המיקום עודכן", "success");
      invalidate();
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const detailsM = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: number;
      body: StopDetailsPatch;
    }) => {
      setDetailsSavingId(id);
      await patchStop(id, body);
      return id;
    },
    onSuccess: () => {
      show("פרטי היעד עודכנו", "success");
      invalidate();
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
    onSettled: () => setDetailsSavingId(null),
  });

  const patchRouteM = useMutation({
    mutationFn: (body: Record<string, unknown>) => patchRoute(route!.id, body),
    onSuccess: invalidate,
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  function formatReturnHint(iso: string | null | undefined): string {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jerusalem",
      });
    } catch {
      return "";
    }
  }

  const optimizeM = useMutation({
    mutationFn: ({ goToRoute }: { goToRoute: boolean }) =>
      optimizeRoute(route!.id).then((res) => ({ res, goToRoute })),
    onMutate: () => {
      setOptStep(0);
      const t1 = window.setTimeout(() => setOptStep(1), 400);
      const t2 = window.setTimeout(() => setOptStep(2), 1200);
      return { t1, t2 };
    },
    onSuccess: ({ res, goToRoute }) => {
      void qc.invalidateQueries({ queryKey: ["route-today"] });
      emitTourEvent("tour:optimized");
      if (!res.feasible) {
        show("נמצאו התנגשויות — בחרו אפשרות במסך המסלול", "error");
        nav("/app/route");
        return;
      }
      const ret = formatReturnHint(res.return_at);
      show(
        res.savings_min
          ? `מסלול לפי חזרה מהירה לסניף · חיסכון ${res.savings_min} דק'${ret ? ` · חזרה ${ret}` : ""}`
          : `מסלול מוכן לפי זמן סיום סבב קצר ביותר${ret ? ` · חזרה ${ret}` : ""}`,
        "success",
      );
      if (goToRoute) {
        // During tour stay on route order so the lock exercise can run.
        nav(useTourStore.getState().active ? "/app/route" : "/app/board");
      }
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
    onSettled: (_d, _e, _v, ctx) => {
      if (ctx) {
        window.clearTimeout(ctx.t1);
        window.clearTimeout(ctx.t2);
      }
      setOptStep(null);
      setConstraintsSavingId(null);
    },
  });

  const constraintsM = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: number;
      body: StopConstraintsPatch;
    }) => {
      setConstraintsSavingId(id);
      await patchStop(id, body);
      return id;
    },
    onSuccess: async () => {
      await invalidate();
      if ((route?.stops.length ?? 0) >= 2) {
        show("אילוץ נשמר — מחשבים מסלול מחדש לפי חזרה לסניף…", "success");
        optimizeM.mutate({ goToRoute: false });
      } else {
        setConstraintsSavingId(null);
        show("אילוץ נשמר", "success");
      }
    },
    onError: (e) => {
      setConstraintsSavingId(null);
      show(apiErrorMessage(e), "error");
    },
  });

  if (routeQ.isLoading) {
    return <LoadingScreen label="טוען את תכנון הסבב" />;
  }

  if (routeQ.isError) {
    return (
      <div className="pageShell">
        <PageHeader kicker="תכנון" title="לא הצלחנו לטעון" lead="בדקו שהשרת רץ, ואז נסו שוב." />
        <StatusBanner tone="danger" role="alert">
          {apiErrorMessage(routeQ.error)}
        </StatusBanner>
        <Button onClick={() => void routeQ.refetch()}>נסה שוב</Button>
      </div>
    );
  }

  if (!route) {
    return <LoadingScreen label="מכינים סבב להיום" />;
  }

  const mockMaps = keysQ.data?.maps_mode === "mock";
  const MAX_STOPS = 40;
  const stopCount = route.stops.length;
  const canOptimize = stopCount >= 2 && stopCount <= MAX_STOPS;
  const uncertainStops = route.stops.filter(
    (s) => s.geocode_confidence != null && s.geocode_confidence < 0.7,
  );
  const step = stopCount === 0 ? 1 : canOptimize ? 2 : 1;
  const live = isRoundLive(route.status);
  const addTabs = (
    live
      ? ([
          ["shot", "צילום מסך"],
          ["library", "שמורים"],
          ["manual", "ידני"],
          ["file", "קובץ"],
        ] as const)
      : ([
          ["library", "שמורים"],
          ["shot", "צילום מסך"],
          ["manual", "ידני"],
          ["file", "קובץ"],
        ] as const)
  );

  return (
    <div className={`pageShell ${styles.page}`}>
      <header className={styles.hero}>
        <PageHeader
          kicker={`תכנון · ${formatDateHe(route.date)}`}
          title={live ? "ניהול יעדים בזמן נסיעה" : "סבב חדש"}
          lead={
            live
              ? "הוסיפו, שנו סדר או הסירו יעדים — בלי לעצור את הסבב."
              : "הוסיפו כתובות, חשבו מסלול, ואז אשרו יציאה. המטרה: לחזור לברינקס הכי מהר."
          }
        />
        <HowItWorks
          block={live ? HELP_PLAN_LIVE : HELP_PLAN}
          defaultOpen={!live && stopCount === 0}
        />
        <div className={styles.steps} aria-label={`שלב ${step} מתוך 3`}>
          <div className={styles.stepOn}>
            <span className={styles.stepNum}>1</span>
            תכנון
          </div>
          <span className={styles.stepLine} aria-hidden />
          <div className={styles.step}>
            <span className={styles.stepNum}>2</span>
            מסלול
          </div>
          <span className={styles.stepLine} aria-hidden />
          <div className={styles.step}>
            <span className={styles.stepNum}>3</span>
            נסיעה
          </div>
        </div>
      </header>

      {depotQ.data ? (
        <Link to="/app/settings" className={styles.depotLine}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
            <circle cx="12" cy="11" r="2" />
          </svg>
          <span>
            יוצאים מ־<strong>{depotQ.data.name}</strong> · חוזרים לאותה נקודה
          </span>
        </Link>
      ) : null}

      {mockMaps ? (
        <StatusBanner tone="brass">
          כתובות במצב הדגמה.{" "}
          <Link to="/app/settings">חיבור Google Maps</Link>
        </StatusBanner>
      ) : null}

      {uncertainStops.length > 0 ? (
        <StatusBanner tone="warning" role="status">
          {uncertainStops.length === 1
            ? `כתובת אחת לא ודאית («${uncertainStops[0].customer_name}») — בדקו מיקום לפני החישוב.`
            : `${uncertainStops.length} כתובות לא ודאיות — פתחו את הרשימה למטה ועדכנו מיקום לפני «חשב מסלול».`}
        </StatusBanner>
      ) : null}

      {live ? (
        <StatusBanner tone="brass" role="status">
          הסבב פעיל.{" "}
          <Link to="/app/route">שנה סדר / הסר יעד</Link>
          {" · "}
          <Link to="/app/live">חזרה לנסיעה</Link>
        </StatusBanner>
      ) : null}

      <Card className={styles.quickCard}>
        <p className={styles.planNote}>
          {live
            ? "בזמן נסיעה: הוסיפו מצילום מסך למטה, גררו ברשימה לשינוי סדר, או לחצו «הסר» ליעד לא רלוונטי. לניהול מהיר עם מפה — «סדר הנקודות»."
            : (
              <>
                אחרי «חשב מסלול» תאשרו את הסדר על המפה — ושם לוחצים{" "}
                <strong>התחל סבב</strong>. שעת היציאה נקבעת בלחיצה, לא מראש.
              </>
            )}
        </p>
        {live ? (
          <div className={styles.liveQuickLinks}>
            <Link to="/app/route" className={styles.liveQuickPrimary}>
              שנה סדר / הסר יעד
            </Link>
            <Link to="/app/live" className={styles.liveQuickGhost}>
              חזרה לנסיעה
            </Link>
          </div>
        ) : null}
        <div className={styles.settingsRow}>
          <span className={styles.settingsLabel}>הפסקת צהריים</span>
          <div className={styles.chips}>
            {[30, 45, 60].map((m) => {
              const on = route.break_duration_min === m;
              return (
                <button
                  key={m}
                  type="button"
                  className={on ? styles.chipOn : styles.chip}
                  aria-pressed={on}
                  onClick={() => patchRouteM.mutate({ break_duration_min: m })}
                >
                  {m} דק'
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          className={styles.advancedToggle}
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {advancedOpen ? "הסתר הגדרות נוספות" : "הגדרות נוספות"}
        </button>
        {advancedOpen ? (
          <>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>הערכת תכנון (אופציונלי)</span>
              <label className={styles.timePick}>
                <span className={styles.srOnly}>שעה להערכת מסלול לפני יציאה</span>
                <input
                  className={`${styles.timeInput} num`}
                  type="time"
                  value={route.departure_time.slice(0, 5)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    patchRouteM.mutate({ departure_time: `${v}:00` });
                  }}
                />
              </label>
            </div>
            <p className={styles.planNoteMuted}>
              משמש רק לחישוב מקדים. בלחיצת «התחל סבב» הזמנים מתעדכנים לפי השעה
              האמיתית.
            </p>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={route.variance_mode}
                onChange={(e) =>
                  patchRouteM.mutate({ variance_mode: e.target.checked })
                }
              />
              <span>
                גיוון מסלול
                <small>מסלול שונה מעט מהימים הקודמים</small>
              </span>
            </label>
          </>
        ) : null}
      </Card>

      <section
        className={styles.section}
        aria-labelledby="add-heading"
        data-tour="plan-add"
      >
        <div className={styles.sectionHead}>
          <h2 id="add-heading" className={styles.h2}>
            {live ? "הוספת יעד עכשיו" : "הוספת יעד"}
          </h2>
          {live ? (
            <span className={styles.sectionMeta}>גם באמצע נסיעה</span>
          ) : null}
        </div>
        <div className={styles.tabs} role="tablist" aria-label="אופן הזנה">
          {addTabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? styles.tabActive : styles.tab}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <Card className={styles.inputCard}>
          {tab === "library" ? (
            <CustomerPickerTab
              excludeCustomerIds={route.stops
                .map((s) => s.customer_id)
                .filter((id): id is number => id != null)}
              loading={fromCustomersM.isPending}
              onAdd={(ids) => fromCustomersM.mutate(ids)}
            />
          ) : null}
          {tab === "manual" ? (
            <ManualInput
              loading={addM.isPending}
              onSubmit={(payload) => addM.mutate(payload)}
            />
          ) : null}
          {tab === "file" ? (
            <FileInputTab
              loading={bulkM.isPending}
              onImport={async (file) => {
                const drafts = await importFile(route.id, file);
                void qc.invalidateQueries({ queryKey: ["customers"] });
                show("הכתובות נשמרו בספריית הלקוחות", "success");
                return drafts;
              }}
              onCommit={(drafts) => bulkM.mutate(drafts)}
            />
          ) : null}
          {tab === "shot" ? (
            <ScreenshotInputTab
              loading={bulkM.isPending}
              onExtract={async (file) => {
                const drafts = await extractFromImage(file);
                void qc.invalidateQueries({ queryKey: ["customers"] });
                show("הכתובות מהצילום נשמרו לספרייה", "success");
                return drafts;
              }}
              onCommit={(drafts) => bulkM.mutate(drafts)}
            />
          ) : null}
        </Card>
      </section>

      <section className={styles.section} aria-labelledby="stops-heading">
        <div className={styles.sectionHead}>
          <h2 id="stops-heading" className={styles.h2}>
            רשימת היום
          </h2>
          {stopCount > 0 ? (
            <span className={styles.sectionMeta}>
              {stopCount}/{MAX_STOPS} יעדים
            </span>
          ) : null}
        </div>
        {stopCount > 0 ? (
          <p className={styles.stopsHint}>
            גררו ב־⋮⋮ לשינוי סדר בכל רגע · «הסר» ליעד לא רלוונטי · יעדים שבוצעו
            נשארים ברשימה ולא נמחקים
          </p>
        ) : null}
        {stopCount === 0 ? (
          <EmptyState
            title="עדיין אין יעדים"
            description="בחרו מלקוחות שמורים, צלמו צילום מסך של הרשימה, או הזינו ידנית."
          />
        ) : (
          <StopsList
            stops={[...route.stops].sort((a, b) => a.sequence_order - b.sequence_order)}
            onReorder={(ids) => reorderM.mutate(ids)}
            onDelete={(id) => deleteM.mutate(id)}
            onFixCoords={(id, lat, lng) => patchStopM.mutate({ id, lat, lng })}
            onUpdateConstraints={(id, body) => constraintsM.mutate({ id, body })}
            onUpdateDetails={(id, body) => detailsM.mutate({ id, body })}
            constraintsSavingId={constraintsSavingId}
            detailsSavingId={detailsSavingId}
          />
        )}
      </section>

      <div className={styles.optimizeBar} data-tour="plan-optimize">
        <div className={styles.optimizeInner}>
          <Button
            size="lg"
            className={styles.optimizeBtn}
            loading={optimizeM.isPending}
            disabled={!canOptimize}
            onClick={() => optimizeM.mutate({ goToRoute: true })}
          >
            {stopCount > MAX_STOPS
              ? `מקסימום ${MAX_STOPS} יעדים — פצלו סבב`
              : canOptimize
                ? `חשב מסלול · ${stopCount} יעדים`
                : "הוסיפו לפחות 2 יעדים"}
          </Button>
          {optStep != null ? (
            <p className={styles.optProgress}>
              {stopCount >= 20
                ? "מחשב מסלול גדול — זה עשוי לקחת עד חצי דקה…"
                : OPT_STEPS[optStep]}
            </p>
          ) : (
            <p className={styles.optHint}>
              החישוב ממזער את שעת החזרה לברינקס (יציאה→חזרה), כולל פקקים וזמני
              שירות — עד {MAX_STOPS} יעדים לסבב.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
