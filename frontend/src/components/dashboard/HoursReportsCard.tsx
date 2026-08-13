import { useState } from "react";
import type { DashboardDto, WorkDayRow } from "../../api/phase5";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import styles from "../../pages/DashboardPage.module.css";

function fmt(min: number | null | undefined): string {
  const m = Math.max(0, min ?? 0);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

type Props = {
  dash: DashboardDto;
  month: string;
  onMonth: (v: string) => void;
  days: WorkDayRow[];
  weekPct: number;
  stdDay: number;
  stdWeek: number;
  onSaveStd: (day: number, week: number) => void;
  onDownload: (format: "csv" | "pdf") => void;
  onEditDay: (id: number, start: string, end: string) => void;
  savingStd?: boolean;
};

export function HoursReportsCard({
  dash: d,
  month,
  onMonth,
  days,
  weekPct,
  stdDay,
  stdWeek,
  onSaveStd,
  onDownload,
  onEditDay,
  savingStd,
}: Props) {
  const [open, setOpen] = useState(false);
  const comp = d.composition;
  const totalComp =
    comp.driving_min + comp.service_min + comp.waiting_min + comp.break_min || 1;

  return (
    <section aria-label="שעות ודוחות">
      <button
        type="button"
        className={styles.reportsToggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "הסתר שעות ודוחות" : "שעות, פילוח וייצוא"}
      </button>
      {open ? (
        <div className={styles.reportsBody}>
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
                #c9a84c 0 ${(comp.driving_min / totalComp) * 100}%,
                #4a7ab0 0 ${((comp.driving_min + comp.service_min) / totalComp) * 100}%,
                #8a6a4a 0 ${((comp.driving_min + comp.service_min + comp.waiting_min) / totalComp) * 100}%,
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
                onChange={(e) => onMonth(e.target.value)}
              />
              <Button variant="secondary" onClick={() => onDownload("csv")}>
                CSV
              </Button>
              <Button variant="secondary" onClick={() => onDownload("pdf")}>
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
              {days.map((row) => (
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
                      const s = window.prompt(
                        "שעת יציאה (ISO או YYYY-MM-DDTHH:MM)",
                        row.start_at ?? "",
                      );
                      const e = window.prompt("שעת חזרה", row.end_at ?? "");
                      if (s && e) onEditDay(row.id, s, e);
                    }}
                  >
                    ערוך
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className={styles.h2}>תקני שעות</h2>
            <p className={styles.meta}>נקבעים מול ברינקס — לא ערכים קשיחים בקוד.</p>
            <div className={styles.stdRow}>
              <Input
                label="יום תקן (דק')"
                type="number"
                defaultValue={String(stdDay)}
                id="std-day"
              />
              <Input
                label="שבוע תקן (דק')"
                type="number"
                defaultValue={String(stdWeek)}
                id="std-week"
              />
              <Button
                loading={savingStd}
                onClick={() => {
                  const day = Number(
                    (document.getElementById("std-day") as HTMLInputElement)?.value,
                  );
                  const week = Number(
                    (document.getElementById("std-week") as HTMLInputElement)?.value,
                  );
                  onSaveStd(day, week);
                }}
              >
                שמור תקנים
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
