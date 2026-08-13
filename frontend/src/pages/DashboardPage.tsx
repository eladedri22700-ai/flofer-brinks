import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import {
  exportHoursUrl,
  getAccuracy,
  getDashboard,
  getHistory,
  getWorkDays,
  patchWorkDay,
} from "../api/phase5";
import { getPrefs, putPrefs } from "../api/live";
import { getTodayRoute } from "../api/planning";
import { apiErrorMessage } from "../api/errors";
import { DailyStartCard } from "../components/dashboard/DailyStartCard";
import { HoursReportsCard } from "../components/dashboard/HoursReportsCard";
import {
  TodayRoundPanel,
  dashboardPrimaryCta,
} from "../components/dashboard/TodayRoundPanel";
import { Card } from "../components/ui/Card";
import { HowItWorks } from "../components/ui/HowItWorks";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useToast } from "../components/ui/ToastProvider";
import { HELP_DAY } from "../lib/helpCopy";
import styles from "./DashboardPage.module.css";

function fmt(min: number | null | undefined): string {
  const m = Math.max(0, min ?? 0);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function jerusalemHour(d = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  return Number(parts.find((p) => p.type === "hour")?.value ?? d.getHours());
}

function greetingHe(d = new Date()): string {
  const h = jerusalemHour(d);
  if (h >= 5 && h < 12) return "בוקר טוב";
  if (h >= 12 && h < 17) return "צהריים טובים";
  if (h >= 17 && h < 22) return "ערב טוב";
  return "לילה טוב";
}

function todayHe(d = new Date()): string {
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jerusalem",
  });
}

export default function DashboardPage() {
  const { show } = useToast();
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const firstName = (user?.full_name ?? "").split(" ")[0] || "ראש צוות";
  const [month, setMonth] = useState(monthKey());
  const [tick, setTick] = useState(0);

  const dashQ = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  const routeQ = useQuery({ queryKey: ["route-today"], queryFn: getTodayRoute });
  const daysQ = useQuery({ queryKey: ["work-days", month], queryFn: () => getWorkDays(month) });
  const prefsQ = useQuery({ queryKey: ["prefs"], queryFn: getPrefs });
  const accuracyQ = useQuery({ queryKey: ["accuracy"], queryFn: getAccuracy });
  const historyQ = useQuery({ queryKey: ["history-lite"], queryFn: getHistory });
  const homeCta = useMemo(
    () => dashboardPrimaryCta(routeQ.data),
    [routeQ.data],
  );

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const liveElapsed = useMemo(() => {
    const d = dashQ.data;
    if (!d?.today_start_at || d.today_end_at) return d?.today_elapsed_min ?? 0;
    const start = new Date(d.today_start_at).getTime();
    return Math.max(0, Math.floor((Date.now() - start) / 60000));
  }, [dashQ.data, tick]);

  const weekPct = dashQ.data
    ? Math.min(100, Math.round((100 * dashQ.data.week_min) / dashQ.data.week_standard_min))
    : 0;

  const prefsM = useMutation({
    mutationFn: (body: { standard_day_min: number; standard_week_min: number }) =>
      putPrefs(body),
    onSuccess: () => {
      show("תקני שעות נשמרו", "success");
      void qc.invalidateQueries({ queryKey: ["prefs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const editM = useMutation({
    mutationFn: ({
      id,
      start,
      end,
    }: {
      id: number;
      start: string;
      end: string;
    }) =>
      patchWorkDay(id, {
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        note: "תיקון ידני מהלוח",
      }),
    onSuccess: () => {
      show("השעות עודכנו", "success");
      void qc.invalidateQueries({ queryKey: ["work-days"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  if (dashQ.isLoading) return <LoadingScreen label="טוען את הנתונים שלך" />;
  const d = dashQ.data!;
  const roundActive = !!d.today_start_at && !d.today_end_at;

  async function download(format: "csv" | "pdf") {
    const res = await fetch(exportHoursUrl(month, format), {
      headers: { Authorization: `Bearer ${token ?? "demo"}` },
    });
    if (!res.ok) {
      show("ייצוא נכשל", "error");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hours-${month}.${format}`;
    a.click();
  }

  return (
    <div className={`pageShell ${styles.page}`}>
      <header className={styles.greetHero}>
        <p className={styles.greetDate}>{todayHe()}</p>
        <h1 className={styles.greetTitle}>
          {greetingHe()}, {firstName}
        </h1>
        <p className={styles.greetLead}>{homeCta.lead}</p>
        <div className={styles.homeActions}>
          <Link to={homeCta.href} className={styles.homePrimaryCta}>
            {homeCta.label}
          </Link>
          {(routeQ.data?.stops?.length ?? 0) > 0 ? (
            <>
              <Link to="/app/route" className={styles.homeSecondary}>
                סדר הנקודות · שינוי ידני
              </Link>
              <Link to="/app/board" className={styles.homeSecondary}>
                מפת הסבב
              </Link>
            </>
          ) : (
            <Link to="/app/plan" className={styles.homeSecondary}>
              לתכנון סבב
            </Link>
          )}
        </div>
        <HowItWorks
          block={HELP_DAY}
          defaultOpen={(routeQ.data?.stops?.length ?? 0) === 0}
        />
        <Link to="/app/help" className={styles.homeSecondary}>
          מדריך מלא · שאלות נפוצות
        </Link>
      </header>

      <DailyStartCard route={routeQ.data} />
      <TodayRoundPanel route={routeQ.data} depotName="ברינקס" />

      <Card className={styles.tipsCard} statusBar="gold" aria-label="תובנות ולמידה">
        <h2 className={styles.h2}>המערכת לומדת כל יום</h2>
        <ul className={styles.tipsList}>
          {d.composition.insight_he ? <li>{d.composition.insight_he}</li> : null}
          {accuracyQ.data?.improvement_he ? (
            <li>{accuracyQ.data.improvement_he}</li>
          ) : (
            <li>
              אחרי כמה ביקורים באותה כתובת הזמן נלמד (חציון, לא ממוצע) — והמסלול
              מתקרב לחזרה הכי מהירה לברינקס.
            </li>
          )}
          {Array.isArray(historyQ.data) && historyQ.data[0] ? (
            <li>
              {typeof (historyQ.data[0] as { savings_min?: number }).savings_min ===
              "number"
                ? `בסבב האחרון נחסכו כ־${(historyQ.data[0] as { savings_min: number }).savings_min} דק׳ מול סדר נאיבי.`
                : "בדקו היסטוריה להשוואת תוכנית מול ביצוע."}
            </li>
          ) : (
            <li>כל יום רשימה חדשה — כתובות חוזרות נשמרות בספרייה עם זמני שירות מדויקים יותר.</li>
          )}
        </ul>
        <Link to="/app/history" className={styles.homeSecondary}>
          היסטוריה, דיוק ושכפול סבב
        </Link>
      </Card>

      <Card className={styles.clockCard} aria-label="שעון עבודה חי">
        <div className={styles.clockHead}>
          <span className={styles.clockLabel}>סבב היום</span>
          {d.today_start_at ? (
            <span
              className={`${styles.roundBadge} ${roundActive ? styles.badgeLive : styles.badgeDone}`}
            >
              <span className={styles.badgeDot} aria-hidden />
              {roundActive ? "פעיל" : "הסתיים"}
            </span>
          ) : null}
        </div>
        {d.today_start_at ? (
          <>
            <div className={styles.clockRow}>
              <span className={styles.clockUnit}>שעות</span>
              <span className={`${styles.clock} num`} key={tick}>
                {fmt(liveElapsed)}
              </span>
            </div>
            <p className={styles.clockSub}>
              יצא{" "}
              {new Date(d.today_start_at).toLocaleTimeString("he-IL", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Jerusalem",
              })}
              {d.today_end_at
                ? ` · חזר ${new Date(d.today_end_at).toLocaleTimeString("he-IL", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Jerusalem",
                  })}`
                : " · כעת"}
            </p>
          </>
        ) : (
          <p className={styles.clockEmpty}>טרם התחיל סבב היום</p>
        )}
      </Card>

      <HoursReportsCard
        dash={d}
        month={month}
        onMonth={setMonth}
        days={daysQ.data ?? []}
        weekPct={weekPct}
        stdDay={prefsQ.data?.standard_day_min ?? d.standard_day_min}
        stdWeek={prefsQ.data?.standard_week_min ?? d.week_standard_min}
        onSaveStd={(day, week) =>
          prefsM.mutate({ standard_day_min: day, standard_week_min: week })
        }
        onDownload={(format) => void download(format)}
        onEditDay={(id, start, end) => editM.mutate({ id, start, end })}
        savingStd={prefsM.isPending}
      />
    </div>
  );
}
