import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OptimizeResult, StopDto } from "../api/client";
import { apiErrorMessage } from "../api/errors";
import {
  getDepot,
  getPublicConfig,
  getTodayRoute,
  optimizeRoute,
  patchStop,
  reorderManual,
} from "../api/planning";
import { RoundMap } from "../components/map/RoundMap";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useToast } from "../components/ui/ToastProvider";
import { isRoundLive } from "../lib/roundBrief";
import styles from "./RoutePage.module.css";

function formatEta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

function SortableRow({
  stop,
  index,
  onToggleLock,
}: {
  stop: StopDto;
  index: number;
  onToggleLock: (id: number, locked: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: stop.id,
    disabled: stop.locked,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={styles.row}
    >
      <button
        type="button"
        className={styles.grip}
        aria-label="גרור"
        disabled={stop.locked}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <span className={`${styles.num} num`}>{index + 1}</span>
      <div className={styles.main}>
        <div className={styles.name}>
          {stop.customer_name}
          {stop.priority === "vip" ? <span className={styles.vip}>VIP</span> : null}
          {stop.locked ? <span className={styles.lockBadge}>נעול</span> : null}
        </div>
        <div className={styles.addr}>{stop.address}</div>
      </div>
      <span className={`${styles.eta} num`}>{formatEta(stop.eta)}</span>
      <button
        type="button"
        className={styles.lockBtn}
        onClick={() => onToggleLock(stop.id, !stop.locked)}
        aria-label={stop.locked ? "שחרר נעילה" : "נעל יעד"}
      >
        {stop.locked ? "🔓" : "🔒"}
      </button>
    </li>
  );
}

export default function RoutePage() {
  const { show } = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [conflict, setConflict] = useState<OptimizeResult | null>(null);
  const [localStops, setLocalStops] = useState<StopDto[]>([]);

  const routeQ = useQuery({ queryKey: ["route-today"], queryFn: getTodayRoute });
  const cfgQ = useQuery({ queryKey: ["public-config"], queryFn: getPublicConfig });
  const depotQ = useQuery({ queryKey: ["depot"], queryFn: getDepot });

  const route = routeQ.data;
  const sorted = useMemo(
    () =>
      [...(route?.stops ?? [])].sort((a, b) => a.sequence_order - b.sequence_order),
    [route?.stops],
  );

  useEffect(() => {
    setLocalStops(sorted);
  }, [sorted]);

  const mapKey = cfgQ.data?.google_maps_browser_key ?? null;

  const optimizeM = useMutation({
    mutationFn: (resolve_option?: string) =>
      optimizeRoute(route!.id, resolve_option ? { resolve_option } : {}),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["route-today"] });
      if (!res.feasible) {
        setConflict(res);
        show("נמצאו התנגשויות במסלול", "error");
        return;
      }
      setConflict(null);
      show(
        res.savings_min
          ? `מסלול מוכן · חיסכון ${res.savings_min} דק'`
          : "מסלול מוכן",
        "success",
      );
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const reorderM = useMutation({
    mutationFn: (ids: number[]) => reorderManual(route!.id, ids),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["route-today"] });
      if (res.warnings_he?.length) {
        show(res.warnings_he[0], "error");
      } else {
        show("הסדר עודכן · ETA חושב מחדש", "success");
      }
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const lockM = useMutation({
    mutationFn: ({ id, locked }: { id: number; locked: boolean }) =>
      patchStop(id, { locked }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["route-today"] }),
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = localStops.findIndex((s) => s.id === active.id);
    const newIndex = localStops.findIndex((s) => s.id === over.id);
    const next = arrayMove(localStops, oldIndex, newIndex);
    setLocalStops(next);
    reorderM.mutate(next.map((s) => s.id));
  }

  if (routeQ.isLoading) {
    return <LoadingScreen label="טוען את המסלול" />;
  }

  if (!route || route.stops.length === 0) {
    return (
      <div className={`pageShell ${styles.page}`}>
        <EmptyState
          title="עדיין אין מסלול"
          description="חשבו מסלול ממסך התכנון — ואז תחזרו לכאן לאישור ויציאה."
          action={
            <Link to="/app/plan" className={styles.ctaLink}>
              חזרה לתכנון
            </Link>
          }
        />
      </div>
    );
  }

  const savings =
    route.solver_explanation?.savings_he ??
    (route.naive_duration_min != null && route.optimized_duration_min != null
      ? `חיסכון ${Math.max(0, route.naive_duration_min - route.optimized_duration_min)} דק'`
      : null);
  const live = isRoundLive(route.status);

  return (
    <div className={`pageShell ${styles.page}`}>
      <PageHeader
        kicker="מסלול"
        title="סדר הנקודות"
        lead={
          live
            ? "הסבב פעיל. אפשר לגרור כדי לשנות סדר ליעדים שטרם בוצעו — הזמנים יתעדכנו."
            : "כאן רואים את כל הנקודות לפי הסדר. גררו לשינוי ידני, נעלו יעד חשוב, ואז אשרו יציאה במפה."
        }
      />

      <div className={styles.ctaStack}>
        {live ? (
          <Button size="lg" className={styles.fullBtn} onClick={() => nav("/app/live")}>
            חזרה לנסיעה
          </Button>
        ) : (
          <Button size="lg" className={styles.fullBtn} onClick={() => nav("/app/board")}>
            אישור סבב והתחלה
          </Button>
        )}
        <div className={styles.secondaryRow}>
          {!live ? (
            <Button
              variant="secondary"
              onClick={() => optimizeM.mutate(undefined)}
              loading={optimizeM.isPending}
            >
              חשב מחדש
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => nav("/app/board")}>
            מפת הסבב
          </Button>
          <Button variant="ghost" onClick={() => nav("/app/plan")}>
            עריכת יעדים
          </Button>
        </div>
      </div>

      {conflict && !conflict.feasible ? (
        <Card className={styles.conflict}>
          <h2 className={styles.h2}>התנגשות אילוצים</h2>
          {conflict.conflicts.map((c, i) => (
            <p key={i}>{c.message_he}</p>
          ))}
          <div className={styles.optRow}>
            {conflict.options.map((o) => (
              <Button
                key={o.id}
                size="md"
                variant="secondary"
                loading={optimizeM.isPending}
                onClick={() => optimizeM.mutate(o.id)}
              >
                {o.label_he}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}

      {!conflict ? (
        <Card className={styles.savings}>
          {savings ? <p className={styles.savingsText}>{String(savings)}</p> : null}
          {route.solver_explanation?.return_hm ? (
            <p className={`${styles.meta} num`}>
              צפי חזרה לברינקס: {String(route.solver_explanation.return_hm)}
              {route.optimized_duration_min != null
                ? ` · משך סבב (יציאה→חזרה): ${route.optimized_duration_min} דק'`
                : ""}
            </p>
          ) : route.optimized_duration_min != null ? (
            <p className={`${styles.meta} num`}>
              משך סבב (יציאה→חזרה): {route.optimized_duration_min} דק'
              {route.naive_duration_min != null
                ? ` · נאיבי: ${route.naive_duration_min} דק'`
                : ""}
            </p>
          ) : null}
          {route.solver_explanation?.depot_he ? (
            <p className={styles.meta}>{String(route.solver_explanation.depot_he)}</p>
          ) : (
            <p className={styles.meta}>
              המסלול מחושב לסיום מהיר ביותר עד החזרה לסניף — לא עד המשלוח האחרון.
            </p>
          )}
        </Card>
      ) : null}

      <div className={styles.map}>
        <RoundMap
          mapKey={mapKey}
          stops={localStops}
          depot={depotQ.data ?? null}
        />
      </div>
      <Button variant="ghost" className={styles.fullBtn} onClick={() => nav("/app/board")}>
        פתח תצוגה רחבה על המפה
      </Button>

      <Card>
        <h2 className={styles.h2}>סדר היעדים</h2>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={localStops.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className={styles.list}>
              {localStops.map((s, i) => (
                <SortableRow
                  key={s.id}
                  stop={s}
                  index={i}
                  onToggleLock={(id, locked) => lockM.mutate({ id, locked })}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </Card>
    </div>
  );
}
