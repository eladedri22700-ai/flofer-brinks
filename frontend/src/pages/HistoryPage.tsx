import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { duplicateRoute, getAccuracy, getHistory, getRouteCompare } from "../api/phase5";
import { apiErrorMessage } from "../api/errors";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/ToastProvider";
import styles from "./HistoryPage.module.css";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

function ComparePanel({ routeId }: { routeId: number }) {
  const q = useQuery({
    queryKey: ["route-compare", routeId],
    queryFn: () => getRouteCompare(routeId),
  });
  if (q.isLoading) return <Skeleton height={120} />;
  if (!q.data) return null;
  const d = q.data;
  return (
    <div className={styles.compare}>
      <p className={styles.compareMeta}>
        {d.median_abs_error_min != null
          ? `חציון סטיית ETA: ${d.median_abs_error_min} דק'`
          : "אין נתוני בפועל להשוואה"}
      </p>
      <ul className={styles.compareList}>
        {d.stops.map((s) => (
          <li key={s.id}>
            <span className="num">{s.sequence_order + 1}</span>
            <span className={styles.compareName}>{s.customer_name}</span>
            <span className={`${styles.compareTimes} num`}>
              תוכנן {fmtTime(s.eta)} · בפועל {fmtTime(s.actual_arrival)}
              {s.eta_error_min != null ? ` (${s.eta_error_min > 0 ? "+" : ""}${s.eta_error_min})` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HistoryPage() {
  const { show } = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(null);
  const histQ = useQuery({ queryKey: ["history"], queryFn: getHistory });
  const accQ = useQuery({ queryKey: ["accuracy"], queryFn: getAccuracy });

  const dupM = useMutation({
    mutationFn: (id: number) => duplicateRoute(id),
    onSuccess: () => {
      show("סבב שוכפל", "success");
      void qc.invalidateQueries({ queryKey: ["route-today"] });
      nav("/app/plan");
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  if (histQ.isLoading) return <LoadingScreen label="טוען היסטוריית סבבים" />;

  return (
    <div className={`pageShell ${styles.page}`}>
      <PageHeader
        kicker="ארכיון"
        title="היסטוריה"
        lead="סבבים קודמים, השוואת תוכנית מול בפועל, ושכפול למחר."
      />

      {accQ.data?.improvement_he ? (
        <Card className={styles.accuracy} statusBar="gold">
          <p>{accQ.data.improvement_he}</p>
          <ul className={styles.weeks}>
            {(accQ.data.weeks ?? []).slice(-6).map((w) => (
              <li key={w.week} className="num">
                {w.week}: חציון שגיאה {w.median_error_min} דק' (n={w.n})
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className={styles.list}>
        {(histQ.data ?? []).length === 0 ? (
          <EmptyState
            title="אין היסטוריה עדיין"
            description="אחרי סיום סבבים יופיעו כאן לסיכום ושכפול."
          />
        ) : null}
        {(histQ.data ?? []).map((r) => {
          const row = r as {
            id: number;
            date: string;
            status: string;
            is_demo: boolean;
            stops_done: number;
            stops_total: number;
            savings_min: number | null;
          };
          const expanded = openId === row.id;
          return (
            <Card key={row.id}>
              <div className={styles.row}>
                <div>
                  <div className={styles.date}>
                    {row.date}
                    {row.is_demo ? <span className={styles.demo}>דמו</span> : null}
                  </div>
                  <div className={styles.meta}>
                    {row.stops_done}/{row.stops_total} · {row.status}
                    {row.savings_min != null ? ` · חיסכון ${row.savings_min} דק'` : ""}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => setOpenId(expanded ? null : row.id)}
                  >
                    {expanded ? "הסתר פירוט" : "תוכנית מול בפועל"}
                  </button>
                  <Link to={`/app/summary/${row.id}`}>סיכום</Link>
                  <Button
                    variant="secondary"
                    loading={dupM.isPending}
                    onClick={() => dupM.mutate(row.id)}
                  >
                    שכפל
                  </Button>
                </div>
              </div>
              {expanded ? <ComparePanel routeId={row.id} /> : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
