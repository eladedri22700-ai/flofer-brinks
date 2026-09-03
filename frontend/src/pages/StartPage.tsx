import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { getDepot } from "../api/planning";
import { readShiftChecks, writeShiftChecks } from "../lib/shiftChecks";
import styles from "./StartPage.module.css";

function jerusalemTime(d = new Date()): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
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

const CHECK_META = [
  { key: "vehicle" as const, title: "בדיקת רכב", subtitle: "כספת, דלק, גלגלים" },
  { key: "team" as const, title: "זיווג צוות", subtitle: "נהג משובץ ואושר" },
  { key: "comms" as const, title: "קשר ומצלמה", subtitle: "מוקד מגיב · שידור תקין" },
];

export default function StartPage() {
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const firstName = (user?.full_name ?? "").split(" ")[0] || "ראש צוות";
  const [checks, setChecks] = useState(() => readShiftChecks(user?.username));
  const [openedAt, setOpenedAt] = useState<string | null>(checks.completedAt);
  const depotQ = useQuery({ queryKey: ["depot"], queryFn: getDepot });

  const allChecked = checks.vehicle && checks.team && checks.comms;
  const remaining = [checks.vehicle, checks.team, checks.comms].filter((c) => !c).length;
  const departure = useMemo(() => jerusalemTime(), []);

  function toggle(key: "vehicle" | "team" | "comms") {
    const next = writeShiftChecks({ [key]: !checks[key] }, user?.username);
    setChecks(next);
  }

  function startShift() {
    if (!allChecked) return;
    const at = jerusalemTime();
    writeShiftChecks({ completedAt: new Date().toISOString() }, user?.username);
    setOpenedAt(at);
    nav("/app/plan");
  }

  return (
    <div className={styles.screen}>
      <div className={styles.body}>
        <div>
          <div className={styles.eyebrow}>FLOFER · פתיחת משמרת</div>
          <h1 className={styles.title}>{greetingHe()}, {firstName}</h1>
          <p className={styles.lead}>שלוש בדיקות ואתה בדרך. הכל נרשם על השטר.</p>
        </div>

        <div className={styles.checks}>
          {CHECK_META.map((c) => {
            const on = checks[c.key];
            return (
              <button
                key={c.key}
                type="button"
                className={`${styles.check} tap ${on ? styles.checkOn : ""}`}
                onClick={() => toggle(c.key)}
                aria-pressed={on}
              >
                <span className={styles.checkDot}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={on ? "#fff" : "rgba(255,255,255,.25)"} strokeWidth="3.2" strokeLinecap="round">
                    <path d="M5 13l4 4 10-10" />
                  </svg>
                </span>
                <span>
                  <span className={styles.checkTitle}>{c.title}</span>
                  <br />
                  <span className={styles.checkSub}>{c.subtitle}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className={styles.strip}>
          <div>
            <div className={styles.stripLabel}>יציאה מ</div>
            <div className={styles.stripValue}>{depotQ.data?.name ?? "ברינקס"}</div>
          </div>
          <div className={styles.stripRight}>
            <div className={styles.stripLabel}>שעת יציאה</div>
            <div className={`${styles.stripTime} num`}>{departure}</div>
          </div>
        </div>

        <div className={styles.ctaWrap}>
          <button
            type="button"
            className={`${styles.cta} tap`}
            onClick={startShift}
            disabled={!allChecked}
            style={{ opacity: allChecked ? 1 : 0.45 }}
          >
            {allChecked ? "פתיחת משמרת" : "השלם את הבדיקות"}
          </button>
          <div className={styles.note}>
            {allChecked ? `הבדיקות נרשמו · ${openedAt ? jerusalemTime(new Date(openedAt)) : departure}` : `${remaining} בדיקות נותרו`}
          </div>
        </div>
      </div>
    </div>
  );
}
