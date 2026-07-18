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
import { apiErrorMessage } from "../api/errors";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useToast } from "../components/ui/ToastProvider";
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
  const daysQ = useQuery({ queryKey: ["work-days", month], queryFn: () => getWorkDays(month) });
  const prefsQ = useQuery({ queryKey: ["prefs"], queryFn: getPrefs });
  const accuracyQ = useQuery({ queryKey: ["accuracy"], queryFn: getAccuracy });
  const historyQ = useQuery({ queryKey: ["history-lite"], queryFn: getHistory });

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
  const comp = d.composition;
  const totalComp =
    comp.driving_min + comp.service_min + comp.waiting_min + comp.break_min || 1;

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
        <p className={styles.greetLead}>
          לוח הבקרה שלך — התחילו סבב, עקבו אחרי השעות, וראו מה המערכת למדה.
        </p>
        <div className={styles.homeActions}>
          <Link to="/app/plan" className={styles.homePrimaryCta}>
            תכנון סבב להיום
          </Link>
          <Link to="/app/board" className={styles.homeSecondary}>
            אישור סבב והתחלה
          </Link>
          <Link to="/app/live" className={styles.homeSecondary}>
            למסך נסיעה
          </Link>
        </div>
      </header>

      <Card className={styles.tipsCard} statusBar="gold" aria-label="המלצות היום">
        <h2 className={styles.h2}>המלצות היום</h2>
        <ul className={styles.tipsList}>
          {comp.insight_he ? <li>{comp.insight_he}</li> : null}
          {accuracyQ.data?.improvement_he ? (
            <li>{accuracyQ.data.improvement_he}</li>
          ) : (
            <li>אחרי כמה סבבים המערכת לומדת זמני שירות ומשפרת את הצפי.</li>
          )}
          {Array.isArray(historyQ.data) && historyQ.data[0] ? (
            <li>
              {typeof (historyQ.data[0] as { savings_min?: number }).savings_min ===
              "number"
                ? `בסבב האחרון נחסכו כ־${(historyQ.data[0] as { savings_min: number }).savings_min} דק׳ מול סדר נאיבי.`
                : "בדקו היסטוריה להשוואת תוכנית מול ביצוע."}
            </li>
          ) : (
            <li>חשבו מסלול בבוקר — המערכת ממזערת את שעת החזרה לברינקס, לא רק קילומטרים.</li>
          )}
        </ul>
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

      <div className={styles.grid}>
        <Card className={`${styles.stat} ${styles.accentBrass}`}>
          <div className={styles.statTop}>
            <span className={styles.statDot} aria-hidden />
            <h2 className={styles.h2}>השבוע</h2>
          </div>
          <div className={`${styles.big} num`}>
            {fmt(d.week_min)} / {fmt(d.week_standard_min)}
          </div>
          <div className={styles.bar} aria-hidden>
            <span style={{ width: `${weekPct}%` }} />
          </div>
          <p className={styles.meta}>{weekPct}% מהתקן השבועי</p>
        </Card>
        <Card className={`${styles.stat} ${styles.accentInfo}`}>
          <div className={styles.statTop}>
            <span className={styles.statDot} aria-hidden />
            <h2 className={styles.h2}>החודש</h2>
          </div>
          <div className={`${styles.big} num`}>{fmt(d.month_min)}</div>
          <p className={styles.meta}>נוספות: {fmt(d.month_overtime_min)}</p>
        </Card>
        <Card className={`${styles.stat} ${styles.accentSuccess}`}>
          <div className={styles.statTop}>
            <span className={styles.statDot} aria-hidden />
            <h2 className={styles.h2}>מצטבר</h2>
          </div>
          <div className={`${styles.big} num`}>{fmt(d.cumulative_min)}</div>
          <p className={styles.meta}>{d.work_days_count} ימי עבודה</p>
        </Card>
        <Card className={`${styles.stat} ${styles.accentViolet}`}>
          <div className={styles.statTop}>
            <span className={styles.statDot} aria-hidden />
            <h2 className={styles.h2}>ממוצע יומי</h2>
          </div>
          <div className={`${styles.big} num`}>{fmt(d.daily_avg_min)}</div>
          <p className={styles.meta}>
            מגמה מול חודש קודם: {d.daily_avg_trend_min >= 0 ? "+" : ""}
            {fmt(Math.abs(d.daily_avg_trend_min))}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className={styles.h2}>פילוח היום</h2>
        <div className={styles.donutWrap}>
          <div
            className={styles.donut}
            style={{
              background: `conic-gradient(
                #c9a84c 0 ${ (comp.driving_min / totalComp) * 100 }%,
                #4a7ab0 0 ${ ((comp.driving_min + comp.service_min) / totalComp) * 100 }%,
                #8a6a4a 0 ${ ((comp.driving_min + comp.service_min + comp.waiting_min) / totalComp) * 100 }%,
                #3a4a5a 0 100%)`,
            }}
            role="img"
            aria-label={comp.insight_he}
          />
          <p>{comp.insight_he}</p>
        </div>
      </Card>

      <Card>
        <div className={styles.tableHead}>
          <h2 className={styles.h2}>טבלה יומית</h2>
          <Input
            label="חודש"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <Button variant="secondary" onClick={() => void download("csv")}>
            CSV
          </Button>
          <Button variant="secondary" onClick={() => void download("pdf")}>
            PDF
          </Button>
        </div>
        <div className={styles.table}>
          <div className={styles.trHead}>
            <span>תאריך</span>
            <span>יציאה</span>
            <span>חזרה</span>
            <span>הפסקה</span>
            <span>סה״כ</span>
            <span>נוספות</span>
            <span>יעדים</span>
          </div>
          {(daysQ.data ?? []).map((row) => (
            <div key={row.id} className={styles.tr}>
              <span>
                {row.date}
                {row.manually_edited ? (
                  <span className={styles.edited}> נערך</span>
                ) : null}
              </span>
              <span className="num">
                {row.start_at
                  ? new Date(row.start_at).toLocaleTimeString("he-IL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
              <span className="num">
                {row.end_at
                  ? new Date(row.end_at).toLocaleTimeString("he-IL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
              <span className="num">{row.break_min}</span>
              <span className="num">{fmt(row.total_min)}</span>
              <span className="num">{fmt(row.overtime_min)}</span>
              <span className="num">{row.stops_done}</span>
              <Button
                variant="ghost"
                onClick={() => {
                  const s = window.prompt("שעת יציאה (ISO או YYYY-MM-DDTHH:MM)", row.start_at ?? "");
                  const e = window.prompt("שעת חזרה", row.end_at ?? "");
                  if (s && e) editM.mutate({ id: row.id, start: s, end: e });
                }}
              >
                ערוך
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className={styles.h2}>תקני שעות (מהגדרות)</h2>
        <p className={styles.meta}>נקבעים מול ברינקס — לא ערכים קשיחים בקוד.</p>
        <div className={styles.stdRow}>
          <Input
            label="יום תקן (דק')"
            type="number"
            defaultValue={String(prefsQ.data?.standard_day_min ?? d.standard_day_min)}
            id="std-day"
          />
          <Input
            label="שבוע תקן (דק')"
            type="number"
            defaultValue={String(prefsQ.data?.standard_week_min ?? d.week_standard_min)}
            id="std-week"
          />
          <Button
            onClick={() => {
              const day = Number((document.getElementById("std-day") as HTMLInputElement)?.value);
              const week = Number((document.getElementById("std-week") as HTMLInputElement)?.value);
              prefsM.mutate({ standard_day_min: day, standard_week_min: week });
            }}
          >
            שמור תקנים
          </Button>
        </div>
      </Card>
    </div>
  );
}
