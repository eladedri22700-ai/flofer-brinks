import { Link } from "react-router-dom";
import type { RouteDto } from "../../api/client";
import { RoundPulse } from "../round/RoundPulse";
import { Card } from "../ui/Card";
import {
  buildRoundBrief,
  formatTimeHe,
  isRoundLive,
  isRoundReady,
  stopWindowHe,
} from "../../lib/roundBrief";
import styles from "./TodayRoundPanel.module.css";

type Props = {
  route: RouteDto | null | undefined;
  depotName?: string;
};

export function TodayRoundPanel({ route, depotName = "ברינקס" }: Props) {
  const brief = buildRoundBrief(route);
  const status = route?.status;
  const live = isRoundLive(status);
  const ready = isRoundReady(status);
  const planningOnly =
    Boolean(route) && status === "planning" && (route?.stops?.length ?? 0) > 0;

  if (!brief) {
    return (
      <Card
        className={styles.empty}
        aria-label="אין סבב היום"
        data-tour="home-round"
      >
        <h2 className={styles.h2}>סבב היום</h2>
        <p className={styles.emptyText}>
          עוד אין מסלול מחושב. הוסיפו יעדים וחשבו מסלול — ואז תופיע כאן רשימת
          הכתובות לפי הסדר, עם אפשרות לשנות ידנית.
        </p>
        <Link to="/app/plan" className={styles.primaryLink}>
          לתכנון הסבב
        </Link>
      </Card>
    );
  }

  const primary = live
    ? { href: "/app/live", label: "המשך לנסיעה" }
    : ready
      ? { href: "/app/board", label: "למפה ולאישור הסבב" }
      : planningOnly
        ? { href: "/app/plan", label: "המשך תכנון וחשב מסלול" }
        : { href: "/app/plan", label: "לתכנון הסבב" };

  return (
    <div className={styles.wrap} data-tour="home-round">
      <RoundPulse
        brief={brief}
        depotName={depotName}
        variant="card"
        ctaHref={primary.href}
        ctaLabel={primary.label}
      />

      <Card className={styles.orderCard} aria-label="סדר היעדים להיום">
        <div className={styles.orderHead}>
          <div>
            <h2 className={styles.h2}>סדר הנקודות</h2>
            <p className={styles.orderLead}>
              {live
                ? "הסבב פעיל — שנו סדר, הסירו כתובות לא רלוונטיות, או הוסיפו מצילום מסך בזמן אמת."
                : "אחרי החישוב רואים כאן את כל הנקודות. אפשר לשנות סדר ולהסיר יעדים לפני היציאה — וגם אחריה."}
            </p>
          </div>
          <div className={styles.orderActions}>
            <Link to="/app/route" className={styles.reorderLink}>
              {live ? "שנה סדר / הסר" : "שנה סדר ידנית"}
            </Link>
            {live ? (
              <Link to="/app/plan?tab=shot" className={styles.photoLink}>
                הוסף מצילום
              </Link>
            ) : null}
          </div>
        </div>

        <ol className={styles.list}>
          {brief.stops.map((s, i) => {
            const done = s.status === "done" || s.status === "skipped";
            const isNext = brief.next?.id === s.id;
            const win = stopWindowHe(s);
            return (
              <li
                key={s.id}
                className={[
                  styles.item,
                  isNext ? styles.itemNext : "",
                  done ? styles.itemDone : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className={`${styles.seq} num`}>{i + 1}</span>
                <span className={styles.body}>
                  <span className={styles.name}>
                    {s.customer_name}
                    {isNext ? <span className={styles.tag}>הבא</span> : null}
                    {s.priority === "vip" ? (
                      <span className={styles.vip}>VIP</span>
                    ) : null}
                  </span>
                  <span className={styles.addr}>{s.address}</span>
                  {win ? <span className={styles.win}>{win}</span> : null}
                </span>
                <span className={`${styles.eta} num`}>{formatTimeHe(s.eta)}</span>
              </li>
            );
          })}
        </ol>

        <div className={styles.footerLinks}>
          <Link to="/app/board">מפת הסבב</Link>
          <Link to="/app/route">סדר מלא · הסרה · גרירה</Link>
          {live ? <Link to="/app/live">מסך נסיעה</Link> : null}
          <Link to={live ? "/app/plan?tab=shot" : "/app/plan"}>
            {live ? "הוספה מצילום מסך" : "הוספת יעדים"}
          </Link>
        </div>
      </Card>
    </div>
  );
}

export function dashboardPrimaryCta(route: RouteDto | null | undefined): {
  href: string;
  label: string;
  lead: string;
} {
  const status = route?.status;
  const hasStops = (route?.stops?.length ?? 0) > 0;
  if (isRoundLive(status)) {
    return {
      href: "/app/live",
      label: "המשך לנסיעה",
      lead: "הסבב רץ — הכתובת הבאה מופיעה גם בבאנר למטה. המטרה: לסיים ולחזור לברינקס.",
    };
  }
  if (isRoundReady(status) && hasStops) {
    return {
      href: "/app/board",
      label: "צפה בסדר ואשר יציאה",
      lead: "המסלול מוכן לחזרה הכי מהירה לסניף. בדקו סדר — ואז התחילו.",
    };
  }
  if (hasStops) {
    return {
      href: "/app/plan",
      label: "המשך תכנון · חשב מסלול",
      lead: "יש יעדים ברשימה — חשבו מסלול לפי חזרה לברינקס, לא לפי המשלוח האחרון.",
    };
  }
  return {
    href: "/app/plan",
    label: "תכנון סבב להיום",
    lead: "יום חדש, כתובות אחרות. צלמו רשימה או בחרו כתובות חוזרות — ואז חשבו מסלול.",
  };
}
