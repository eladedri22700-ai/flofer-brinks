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
import { deleteStop, getTodayRoute, optimizeRoute, patchStop, reorderManual } from "../api/planning";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useToast } from "../components/ui/ToastProvider";
import { emitTourEvent } from "../lib/tourEvents";
import { formatTimeHe, isRoundLive, returnTimeLabel, sortedStops } from "../lib/roundBrief";
import styles from "./RoutePage.module.css";

function SortableRow({
  stop,
  index,
  onToggleLock,
  onRemove,
  removing,
}: {
  stop: StopDto;
  index: number;
  onToggleLock: (id: number, locked: boolean) => void;
  onRemove: (id: number) => void;
  removing: boolean;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: stop.id,
    disabled: stop.locked,
  });
  const accent =
    index === 0 ? "var(--field-brass-light)" : stop.priority === "vip" ? "var(--field-exception)" : "rgba(10,22,38,.12)";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, borderInlineStartColor: accent }}
      className={styles.row}
    >
      <button
        type="button"
        className={styles.grip}
        aria-label={stop.locked ? "יעד נעול" : "גרור לשינוי סדר"}
        disabled={stop.locked}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <span className={`${styles.n} num`}>{String(index + 1).padStart(2, "0")}</span>
      <span className={styles.main}>
        <span className={styles.name}>
          {stop.customer_name}
          {stop.priority === "vip" ? <span className={styles.vip}> ★ VIP</span> : null}
        </span>
        <br />
        <span className={`${styles.sub} num`}>
          {formatTimeHe(stop.eta)} · {stop.address}
        </span>
      </span>
      <button
        type="button"
        className={styles.sqBtn}
        onClick={() => onToggleLock(stop.id, !stop.locked)}
        aria-label={stop.locked ? "שחרר נעילה" : "נעל יעד"}
      >
        {stop.locked ? "🔓" : "🔒"}
      </button>
      {confirmDel ? (
        <button type="button" className={`${styles.sqBtn} ${styles.sqDanger}`} disabled={removing} onClick={() => onRemove(stop.id)}>
          {removing ? "…" : "הסר"}
        </button>
      ) : (
        <button type="button" className={styles.sqBtn} onClick={() => setConfirmDel(true)} aria-label="הסר יעד">
          ✕
        </button>
      )}
    </li>
  );
}

export default function RoutePage() {
  const { show } = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [conflict, setConflict] = useState<OptimizeResult | null>(null);
  const [dirty, setDirty] = useState(false);
  const [localStops, setLocalStops] = useState<StopDto[]>([]);

  const routeQ = useQuery({ queryKey: ["route-today"], queryFn: getTodayRoute });
  const route = routeQ.data;
  const allSorted = useMemo(() => sortedStops(route), [route]);
  const pending = useMemo(() => allSorted.filter((s) => s.status !== "done" && s.status !== "skipped"), [allSorted]);

  useEffect(() => {
    setLocalStops(pending);
  }, [pending]);

  const live = isRoundLive(route?.status);

  const optimizeM = useMutation({
    mutationFn: (resolve_option?: string) => optimizeRoute(route!.id, resolve_option ? { resolve_option } : {}),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["route-today"] });
      setDirty(false);
      if (!res.feasible) {
        setConflict(res);
        show("נמצאו התנגשויות במסלול", "error");
        return;
      }
      setConflict(null);
      show(res.savings_min ? `מסלול מוכן · חיסכון ${res.savings_min} דק'` : "מסלול מוכן", "success");
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const reorderM = useMutation({
    mutationFn: (ids: number[]) => reorderManual(route!.id, ids),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["route-today"] });
      if (res.warnings_he?.length) show(res.warnings_he[0], "error");
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const lockM = useMutation({
    mutationFn: ({ id, locked }: { id: number; locked: boolean }) => patchStop(id, { locked }),
    onSuccess: (_data, vars) => {
      if (vars.locked) emitTourEvent("tour:locked");
      void qc.invalidateQueries({ queryKey: ["route-today"] });
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const deleteM = useMutation({
    mutationFn: async (id: number) => {
      await deleteStop(id);
      const doneIds = allSorted.filter((s) => s.status === "done" || s.status === "skipped").map((s) => s.id);
      const remaining = localStops.filter((s) => s.id !== id).map((s) => s.id);
      if (route) await reorderManual(route.id, [...doneIds, ...remaining]);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["route-today"] });
      show("היעד הוסר · הסדר והזמנים עודכנו", "success");
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id || !route) return;
    const oldIndex = localStops.findIndex((s) => s.id === active.id);
    const newIndex = localStops.findIndex((s) => s.id === over.id);
    const next = arrayMove(localStops, oldIndex, newIndex);
    setLocalStops(next);
    setDirty(true);
    const doneIds = allSorted.filter((s) => s.status === "done" || s.status === "skipped").map((s) => s.id);
    reorderM.mutate([...doneIds, ...next.map((s) => s.id)]);
  }

  if (routeQ.isLoading) return <LoadingScreen label="טוען את המסלול" />;

  if (!route || route.stops.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.body} style={{ paddingTop: "calc(20px + env(safe-area-inset-top,0px))" }}>
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
      </div>
    );
  }

  const closeHref = live ? "/app/live" : "/app/dashboard";
  const returnEta = returnTimeLabel(route);

  return (
    <div className={styles.screen}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.title}>סדר הנקודות</div>
          <div className={styles.sub}>{dirty ? "הסדר שונה ידנית" : "מסודר לחזרה המהירה ביותר"}</div>
        </div>
        <button type="button" className={`${styles.closeBtn} tap`} onClick={() => nav(closeHref)} aria-label="סגור">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {conflict && !conflict.feasible ? (
        <div className={styles.conflict}>
          <h2 className={styles.conflictTitle}>התנגשות אילוצים</h2>
          {conflict.conflicts.map((c, i) => (
            <p key={i} style={{ margin: "4px 0" }}>
              {c.message_he}
            </p>
          ))}
          <div className={styles.optRow}>
            {conflict.options.map((o) => (
              <Button key={o.id} size="md" variant="secondary" loading={optimizeM.isPending} onClick={() => optimizeM.mutate(o.id)}>
                {o.label_he}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.list}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={localStops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol className={styles.listInner}>
              {localStops.map((s, i) => (
                <SortableRow
                  key={s.id}
                  stop={s}
                  index={i}
                  onToggleLock={(id, locked) => lockM.mutate({ id, locked })}
                  onRemove={(id) => deleteM.mutate(id)}
                  removing={deleteM.isPending && deleteM.variables === s.id}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.etaRow}>
          <span>צפי חזרה בסדר הזה</span>
          <span className={`${styles.etaVal} num`} style={{ color: dirty ? "var(--field-exception)" : "var(--field-done)" }}>
            {returnEta}
          </span>
        </div>
        <div className={styles.bottomBtns}>
          {live ? (
            <>
              <button type="button" className={`${styles.outline} tap`} onClick={() => nav("/app/board")}>
                מפת הסבב
              </button>
              <button type="button" className={`${styles.dark} tap`} onClick={() => nav("/app/live")}>
                חזרה לנסיעה
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`${styles.outline} tap`}
                disabled={optimizeM.isPending}
                onClick={() => optimizeM.mutate(undefined)}
              >
                חשב מחדש
              </button>
              <button type="button" className={`${styles.dark} tap`} onClick={() => nav("/app/board")}>
                שמור סדר
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
