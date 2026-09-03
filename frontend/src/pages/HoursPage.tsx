import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { exportHoursUrl, getDashboard, getWorkDays } from "../api/phase5";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useToast } from "../components/ui/ToastProvider";
import styles from "./HoursPage.module.css";

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtHm(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

function jerusalemDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
}

const DAY_LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export default function HoursPage() {
  const nav = useNavigate();
  const { show } = useToast();
  const token = useAuthStore((s) => s.token);
  const month = monthKey();
  const dashQ = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  const daysQ = useQuery({ queryKey: ["work-days", month], queryFn: () => getWorkDays(month) });

  const weekRows = useMemo(() => {
    const days = daysQ.data ?? [];
    const now = new Date();
    const jToday = jerusalemDateKey(now);
    // Week = Sunday..Saturday containing today, Asia/Jerusalem.
    const todayDow = new Date(`${jToday}T12:00:00`).getDay();
    const sunday = new Date(`${jToday}T12:00:00`);
    sunday.setDate(sunday.getDate() - todayDow);
    const keys: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      keys.push(jerusalemDateKey(d));
    }
    return keys
      .map((key, i) => {
        const row = days.find((d) => d.date.slice(0, 10) === key);
        return { key, dow: i, row, isToday: key === jToday };
      })
      .filter((r) => r.row || r.isToday);
  }, [daysQ.data]);

  const [loadingFmt, setLoadingFmt] = useState<"csv" | "pdf" | null>(null);

  async function download(format: "csv" | "pdf") {
    setLoadingFmt(format);
    try {
      const res = await fetch(exportHoursUrl(month, format), {
        headers: { Authorization: `Bearer ${token ?? "demo"}` },
      });
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `hours-${month}.${format}`;
      a.click();
    } catch {
      show("ייצוא נכשל", "error");
    } finally {
      setLoadingFmt(null);
    }
  }

  if (dashQ.isLoading) return <LoadingScreen label="טוען שעות" />;
  const d = dashQ.data!;
  const weekPct = Math.min(100, Math.round((100 * d.week_min) / Math.max(1, d.week_standard_min)));
  const overtimeMin = Math.max(0, d.week_min - d.week_standard_min);

  return (
    <div className={styles.screen}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.title}>שעות עבודה</div>
          <div className={styles.sub}>חודש {month}</div>
        </div>
        <button type="button" className={`${styles.closeBtn} tap`} onClick={() => nav("/app/dashboard")} aria-label="סגור">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.hero}>
          <div className={styles.heroLabel}>נצבר השבוע</div>
          <div className={styles.heroRow}>
            <div className={`${styles.heroNum} num`}>{fmtHm(d.week_min)}</div>
            <div className={styles.heroOf}>מתוך {fmtHm(d.week_standard_min)}</div>
          </div>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${weekPct}%` }} />
          </div>
          <div className={styles.heroFooter}>
            <span>{weekRows.filter((r) => r.row?.start_at).length} ימי עבודה</span>
            <span>שעות נוספות {fmtHm(overtimeMin)}</span>
          </div>
        </div>

        <div className={styles.rows}>
          {weekRows.map(({ key, dow, row, isToday }) => (
            <div key={key} className={`${styles.row} ${isToday ? styles.rowToday : ""}`}>
              <span className={styles.dayLetter}>{DAY_LETTERS[dow]}</span>
              <span className={`${styles.range} num`}>
                {row?.start_at
                  ? `${new Date(row.start_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })} – ${
                      row.end_at
                        ? new Date(row.end_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })
                        : "בנסיעה"
                    }`
                  : "—"}
              </span>
              <span className={`${styles.total} num`}>{fmtHm(row?.total_min ?? 0)}</span>
            </div>
          ))}
        </div>

        <div className={styles.note}>
          השעות נרשמות אוטומטית מזמן היציאה ומהחתימה על סגירת הסבב. תיקון ידני
          מסומן למנהל המשמרת.
        </div>

        <button
          type="button"
          className={`${styles.cta} tap`}
          onClick={() => void download("csv")}
          disabled={loadingFmt !== null}
        >
          {loadingFmt === "csv" ? "מייצא…" : "שליחת דיווח שבועי"}
        </button>
        <button
          type="button"
          className={`${styles.pdfLink} tap`}
          onClick={() => void download("pdf")}
          disabled={loadingFmt !== null}
        >
          {loadingFmt === "pdf" ? "מייצא…" : "ייצוא כ-PDF"}
        </button>
      </div>
    </div>
  );
}
