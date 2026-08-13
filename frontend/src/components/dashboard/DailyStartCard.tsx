import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { duplicateRoute, getHistory } from "../../api/phase5";
import {
  addStopsFromCustomers,
  createTodayRoute,
  listCustomers,
} from "../../api/planning";
import { apiErrorMessage } from "../../api/errors";
import type { RouteDto } from "../../api/client";
import { isRoundLive, isRoundReady } from "../../lib/roundBrief";
import { useToast } from "../ui/ToastProvider";
import { Card } from "../ui/Card";
import styles from "./DailyStartCard.module.css";

type Props = {
  route: RouteDto | null | undefined;
};

export function DailyStartCard({ route }: Props) {
  const { show } = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const live = isRoundLive(route?.status);
  const ready = isRoundReady(route?.status);
  const stopCount = route?.stops?.length ?? 0;
  const completedToday = route?.status === "completed";
  const onRouteIds = new Set(
    (route?.stops ?? [])
      .map((s) => s.customer_id)
      .filter((id): id is number => id != null),
  );

  const custQ = useQuery({
    queryKey: ["customers", "frequent"],
    queryFn: () => listCustomers("", 40),
    enabled: !live,
  });
  const histQ = useQuery({
    queryKey: ["history-lite"],
    queryFn: getHistory,
    enabled: !live && stopCount === 0,
  });

  const frequent = (custQ.data ?? [])
    .filter((c) => c.service_sample_count > 0)
    .sort((a, b) => b.service_sample_count - a.service_sample_count)
    .slice(0, 8);
  const learnedCount = (custQ.data ?? []).filter(
    (c) => c.service_estimate_source === "learned",
  ).length;
  const lastHist = Array.isArray(histQ.data) ? histQ.data[0] : null;
  const lastId =
    lastHist && typeof (lastHist as { id?: number }).id === "number"
      ? (lastHist as { id: number }).id
      : null;
  const toAdd = frequent.filter((c) => !onRouteIds.has(c.id));

  const addM = useMutation({
    mutationFn: async (ids: number[]) => {
      let routeId = route?.id;
      if (!routeId || route?.status === "completed") {
        const created = await createTodayRoute();
        routeId = created.id;
      }
      await addStopsFromCustomers(routeId, ids);
    },
    onSuccess: (_d, ids) => {
      show(ids.length === 1 ? "נוסף לסבב היום" : `${ids.length} כתובות נוספו לסבב`, "success");
      void qc.invalidateQueries({ queryKey: ["route-today"] });
      try {
        navigator.vibrate?.(12);
      } catch {
        /* ignore */
      }
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const dupM = useMutation({
    mutationFn: (id: number) => duplicateRoute(id),
    onSuccess: () => {
      show("סבב אחרון שוכפל — בדקו ועדכנו כתובות להיום", "success");
      void qc.invalidateQueries({ queryKey: ["route-today"] });
      nav("/app/plan");
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  if (live) return null;

  const title = completedToday
    ? "היום הסתיים · מחר מתחילים מחדש"
    : stopCount === 0
      ? "יום חדש · כתובות אחרות"
      : ready
        ? "אפשר להוסיף עוד לפני היציאה"
        : "המשיכו לבנות את רשימת היום";

  const lead = completedToday
    ? "כל יום רשימה חדשה. כתובות שחוזרות נשמרות בספרייה עם זמנים שנלמדו."
    : "צלמו רשימה, לחצו «הוסף» על כתובת חוזרת, או שכפלו סבב דומה — המטרה: לחזור לברינקס הכי מהר.";

  return (
    <Card className={styles.card} aria-label="התחלת יום">
      <h2 className={styles.h2}>{title}</h2>
      <p className={styles.lead}>{lead}</p>
      {learnedCount > 0 ? (
        <p className={styles.learned}>
          המערכת כבר למדה {learnedCount} כתובות — הזמנים מתעדכנים אחרי כל ביקור.
        </p>
      ) : null}

      <div className={styles.actions}>
        <Link to="/app/plan?tab=shot" className={styles.primary}>
          צילום מסך של הרשימה
        </Link>
        <Link to="/app/plan?tab=library" className={styles.secondary}>
          כתובות שמורות
        </Link>
        {lastId && stopCount === 0 ? (
          <button
            type="button"
            className={styles.ghost}
            disabled={dupM.isPending}
            onClick={() => dupM.mutate(lastId)}
          >
            שכפל סבב אחרון
          </button>
        ) : (
          <Link to="/app/history" className={styles.ghost}>
            היסטוריה ותובנות
          </Link>
        )}
      </div>

      {frequent.length > 0 && !completedToday ? (
        <div className={styles.freq}>
          <p className={styles.freqLabel}>כתובות שחוזרות — לחצו להוספה להיום</p>
          <ul className={styles.freqList}>
            {frequent.map((c) => {
              const added = onRouteIds.has(c.id);
              return (
                <li key={c.id}>
                  <span className={styles.freqBody}>
                    <span className={styles.freqName}>{c.name}</span>
                    <span className={`${styles.freqMeta} num`}>
                      {c.service_duration_min} דק׳
                      {c.service_estimate_source === "learned"
                        ? ` · נלמד (${c.service_sample_count})`
                        : ` · ${c.service_sample_count} ביקורים`}
                    </span>
                  </span>
                  {added ? (
                    <span className={styles.onRoute}>ברשימה</span>
                  ) : (
                    <button
                      type="button"
                      className={styles.addBtn}
                      disabled={addM.isPending}
                      onClick={() => addM.mutate([c.id])}
                      aria-label={`הוסף את ${c.name} לסבב`}
                    >
                      הוסף
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {toAdd.length >= 2 ? (
            <button
              type="button"
              className={styles.freqCtaBtn}
              disabled={addM.isPending}
              onClick={() => addM.mutate(toAdd.map((c) => c.id))}
            >
              הוסף את כולן ({toAdd.length})
            </button>
          ) : (
            <Link to="/app/plan?tab=library" className={styles.freqCta}>
              עוד מהספרייה
            </Link>
          )}
        </div>
      ) : null}
    </Card>
  );
}
