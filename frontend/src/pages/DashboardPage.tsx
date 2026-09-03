import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { getTodayRoute } from "../api/planning";
import { DayRound } from "../components/dashboard/DayRound";
import { HowItWorks } from "../components/ui/HowItWorks";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { isShiftOpen, readShiftChecks } from "../lib/shiftChecks";
import { HELP_DAY } from "../lib/helpCopy";
import styles from "./DashboardPage.module.css";

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

function shortDateHe(d = new Date()): string {
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: "Asia/Jerusalem",
  });
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const firstName = (user?.full_name ?? "").split(" ")[0] || "ראש צוות";
  const routeQ = useQuery({ queryKey: ["route-today"], queryFn: getTodayRoute });

  if (routeQ.isLoading) return <LoadingScreen label="טוען את הסבב שלך" />;

  const route = routeQ.data;
  const hasStops = (route?.stops?.length ?? 0) > 0;

  return (
    <div className={`pageShell ${styles.page}`}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>{greetingHe()}, {firstName}</h1>
        <span className={styles.headerDate}>{shortDateHe()}</span>
      </div>

      {hasStops && route ? (
        <DayRound route={route} />
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            עוד אין מסלול היום. פתחו משמרת ובנו את רשימת היעדים כדי לראות כאן
            את הציר וצפי החזרה לברינקס.
          </p>
          <Link
            to={isShiftOpen(readShiftChecks(user?.username)) ? "/app/plan" : "/app/start"}
            className={styles.emptyCta}
          >
            {isShiftOpen(readShiftChecks(user?.username)) ? "לתכנון הסבב" : "פתיחת משמרת"}
          </Link>
          <HowItWorks block={HELP_DAY} defaultOpen />
        </div>
      )}
    </div>
  );
}
