import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { duplicateRoute, getSummary } from "../api/phase5";
import { getTodayRoute } from "../api/planning";
import { apiErrorMessage } from "../api/errors";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { VaultDial } from "../components/ui/VaultDial";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useToast } from "../components/ui/ToastProvider";
import styles from "./SummaryPage.module.css";

export default function SummaryPage() {
  const { routeId } = useParams();
  const nav = useNavigate();
  const { show } = useToast();
  const todayQ = useQuery({ queryKey: ["route-today"], queryFn: getTodayRoute });
  const id = Number(routeId) || todayQ.data?.id;

  const sumQ = useQuery({
    queryKey: ["summary", id],
    queryFn: () => getSummary(id!),
    enabled: Boolean(id),
  });

  const dupM = useMutation({
    mutationFn: () => duplicateRoute(id!),
    onSuccess: () => {
      show("הסבב שוכפל למחר / להיום", "success");
      nav("/app/plan");
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  if (!id && todayQ.isFetched) {
    return (
      <div className={`pageShell ${styles.page}`}>
        <EmptyState
          title="אין סיכום להצגה"
          description="סיימו סבב בנסיעה, או בחרו סבב מההיסטוריה."
          action={
            <Button size="lg" onClick={() => nav("/app/history")}>
              להיסטוריה
            </Button>
          }
        />
      </div>
    );
  }

  if (sumQ.isLoading || !sumQ.data) {
    return <LoadingScreen label="מכין את סיכום היום" />;
  }

  const s = sumQ.data as {
    stops_done: number;
    stops_total: number;
    savings_he: string;
    message_he: string;
    exceptions: { name: string; code: string }[];
    top_slow_customers: { name: string; avg_min: number }[];
    planned_finish: string | null;
    actual_finish: string | null;
  };

  return (
    <div className={`pageShell ${styles.page}`}>
      <PageHeader kicker="סיום יום" title="סיכום סבב" lead={s.message_he} />

      <div className={styles.seal}>
        <VaultDial completed={s.stops_done} total={s.stops_total} size={120} />
      </div>

      <Card className={styles.savings} statusBar="gold">
        <p className={styles.savingsText}>{s.savings_he}</p>
        <p className={styles.meta}>
          יעדים שבוצעו: {s.stops_done}/{s.stops_total}
        </p>
        {s.planned_finish ? (
          <p className={`${styles.meta} num`}>
            סיום מתוכנן:{" "}
            {new Date(s.planned_finish).toLocaleTimeString("he-IL", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {s.actual_finish
              ? ` · בפועל: ${new Date(s.actual_finish).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </p>
        ) : null}
      </Card>

      {s.exceptions?.length ? (
        <Card>
          <h2 className={styles.h2}>חריגות היום</h2>
          <ul className={styles.list}>
            {s.exceptions.map((e, i) => (
              <li key={i} className={`${styles.item} ${styles.itemWarn}`}>
                <span className={styles.itemName}>{e.name}</span>
                <span className={styles.itemMeta}>{e.code}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {s.top_slow_customers?.length ? (
        <Card>
          <h2 className={styles.h2}>לקוחות שגוזלים זמן החודש</h2>
          <ul className={styles.list}>
            {s.top_slow_customers.map((c) => (
              <li key={c.name} className={styles.item}>
                <span className={styles.itemName}>{c.name}</span>
                <span className={`${styles.itemMeta} num`}>ממוצע {c.avg_min} דק'</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Button size="lg" className={styles.fullBtn} loading={dupM.isPending} onClick={() => dupM.mutate()}>
        שכפל סבב זה למחר
      </Button>
      <Button variant="ghost" onClick={() => nav("/app/dashboard")}>
        ללוח הבקרה
      </Button>
    </div>
  );
}
