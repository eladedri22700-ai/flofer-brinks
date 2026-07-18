import { useState } from "react";
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
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import type { StopDto } from "../../api/client";
import { emitTourEvent } from "../../lib/tourEvents";
import styles from "./StopsList.module.css";

export type StopConstraintsPatch = {
  priority: "normal" | "vip";
  tw_type: "none" | "before" | "after" | "window";
  tw_start: string | null;
  tw_end: string | null;
};

type Props = {
  stops: StopDto[];
  onReorder: (ids: number[]) => void;
  onDelete: (id: number) => void;
  onFixCoords: (id: number, lat: number, lng: number) => void;
  onUpdateConstraints: (id: number, body: StopConstraintsPatch) => void;
  constraintsSavingId?: number | null;
};

const TW_OPTIONS = [
  { value: "none", label: "ללא" },
  { value: "before", label: "עד שעה" },
  { value: "after", label: "משעה" },
  { value: "window", label: "חלון" },
] as const;

function toTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  // API may return "HH:MM:SS" or ISO
  const m = value.match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "";
}

function twLabelHe(stop: StopDto): string | null {
  const start = toTimeInput(stop.tw_start);
  const end = toTimeInput(stop.tw_end);
  if (stop.tw_type === "before" && end) return `עד ${end}`;
  if (stop.tw_type === "after" && start) return `מ־${start}`;
  if (stop.tw_type === "window" && start && end) return `${start}–${end}`;
  if (stop.tw_type !== "none") return "אילוץ זמן";
  return null;
}

function SortableStop({
  stop,
  onDelete,
  onFixCoords,
  onUpdateConstraints,
  saving,
}: {
  stop: StopDto;
  onDelete: (id: number) => void;
  onFixCoords: (id: number, lat: number, lng: number) => void;
  onUpdateConstraints: (id: number, body: StopConstraintsPatch) => void;
  saving: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: stop.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const low = stop.geocode_confidence != null && stop.geocode_confidence < 0.7;
  const [open, setOpen] = useState(false);
  const [vip, setVip] = useState(stop.priority === "vip");
  const [twType, setTwType] = useState<StopConstraintsPatch["tw_type"]>(
    (stop.tw_type as StopConstraintsPatch["tw_type"]) || "none",
  );
  const [twStart, setTwStart] = useState(toTimeInput(stop.tw_start));
  const [twEnd, setTwEnd] = useState(toTimeInput(stop.tw_end));

  const constraintText = twLabelHe(stop);

  function saveConstraints() {
    if (
      (twType === "before" && !twEnd) ||
      (twType === "after" && !twStart) ||
      (twType === "window" && (!twStart || !twEnd))
    ) {
      return;
    }
    const body: StopConstraintsPatch = {
      priority: vip ? "vip" : "normal",
      tw_type: twType,
      tw_start:
        twType === "after" || twType === "window" ? twStart || null : null,
      tw_end:
        twType === "before" || twType === "window" ? twEnd || null : null,
    };
    onUpdateConstraints(stop.id, body);
  }

  return (
    <div ref={setNodeRef} style={style} className={styles.item}>
      <Card statusBar={stop.priority === "vip" ? "gold" : low ? "danger" : "info"}>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.grip}
            aria-label="גרור לסידור ידני"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
          <div className={styles.main}>
            <div className={styles.name}>
              <span className={`${styles.seq} num`}>{stop.sequence_order + 1}</span>
              {stop.customer_name}
              {stop.priority === "vip" ? <span className={styles.vip}>VIP</span> : null}
              {constraintText ? (
                <span className={`${styles.twBadge} num`}>{constraintText}</span>
              ) : null}
            </div>
            <div className={styles.addr}>{stop.address}</div>
            <div className={styles.meta}>
              {stop.learned_badge}
              {stop.parking_badge ? ` · ${stop.parking_badge}` : ""}
            </div>

            <div className={styles.quickActions}>
              <button
                type="button"
                className={vip || stop.priority === "vip" ? styles.chipOn : styles.chip}
                onClick={() => {
                  const next = !(stop.priority === "vip");
                  setVip(next);
                  onUpdateConstraints(stop.id, {
                    priority: next ? "vip" : "normal",
                    tw_type: (stop.tw_type as StopConstraintsPatch["tw_type"]) || "none",
                    tw_start:
                      stop.tw_type === "after" || stop.tw_type === "window"
                        ? toTimeInput(stop.tw_start) || null
                        : null,
                    tw_end:
                      stop.tw_type === "before" || stop.tw_type === "window"
                        ? toTimeInput(stop.tw_end) || null
                        : null,
                  });
                  if (next) emitTourEvent("tour:vip-set");
                }}
                aria-pressed={stop.priority === "vip"}
                data-tour="plan-vip"
              >
                VIP
              </button>
              <button
                type="button"
                className={open ? styles.chipOn : styles.chip}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? "סגור דרישות" : "עדיפות / דרישת זמן"}
              </button>
            </div>

            {open ? (
              <div className={styles.constraints}>
                <p className={styles.constraintsHint}>
                  האילוץ נכנס לחישוב המסלול — המטרה היא חזרה מהירה לסניף ברינקס,
                  לא רק סיום המשלוח האחרון.
                </p>
                <div className={styles.segments} role="group" aria-label="דרישת זמן">
                  {TW_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={twType === opt.value ? styles.segActive : styles.seg}
                      onClick={() => setTwType(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {(twType === "before" || twType === "window") && (
                  <label className={styles.timeLabel}>
                    עד שעה
                    <input
                      className={styles.timeInput}
                      type="time"
                      value={twEnd}
                      onChange={(e) => setTwEnd(e.target.value)}
                    />
                  </label>
                )}
                {(twType === "after" || twType === "window") && (
                  <label className={styles.timeLabel}>
                    משעה
                    <input
                      className={styles.timeInput}
                      type="time"
                      value={twStart}
                      onChange={(e) => setTwStart(e.target.value)}
                    />
                  </label>
                )}
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={vip}
                    onChange={(e) => setVip(e.target.checked)}
                  />
                  עדיפות VIP (לדחוף מוקדם יותר, בלי להרוס את יום העבודה)
                </label>
                <Button
                  type="button"
                  size="lg"
                  loading={saving}
                  disabled={
                    (twType === "before" && !twEnd) ||
                    (twType === "after" && !twStart) ||
                    (twType === "window" && (!twStart || !twEnd))
                  }
                  onClick={saveConstraints}
                >
                  שמור וחשב מסלול מחדש
                </Button>
              </div>
            ) : null}

            {low ? (
              <div className={styles.warn}>
                כתובת לא ודאית — בדקו את המיקום
                <div className={styles.coords}>
                  <input
                    className={styles.coordInput}
                    type="number"
                    step="0.0001"
                    defaultValue={stop.lat}
                    id={`lat-${stop.id}`}
                    aria-label="lat"
                  />
                  <input
                    className={styles.coordInput}
                    type="number"
                    step="0.0001"
                    defaultValue={stop.lng}
                    id={`lng-${stop.id}`}
                    aria-label="lng"
                  />
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      const lat = Number(
                        (document.getElementById(`lat-${stop.id}`) as HTMLInputElement)
                          .value,
                      );
                      const lng = Number(
                        (document.getElementById(`lng-${stop.id}`) as HTMLInputElement)
                          .value,
                      );
                      onFixCoords(stop.id, lat, lng);
                    }}
                  >
                    עדכן מיקום
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <Button variant="danger" type="button" onClick={() => onDelete(stop.id)}>
            מחק
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function StopsList({
  stops,
  onReorder,
  onDelete,
  onFixCoords,
  onUpdateConstraints,
  constraintsSavingId = null,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const ids = stops.map((s) => s.id);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(Number(active.id));
    const newIndex = ids.indexOf(Number(over.id));
    const next = arrayMove(ids, oldIndex, newIndex);
    onReorder(next);
  }

  if (stops.length === 0) {
    return (
      <div className={styles.empty}>
        <p>אין עדיין יעדים — הוסף את הראשון</p>
      </div>
    );
  }

  return (
    <div data-tour="plan-stops">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className={styles.list}>
            {stops.map((s) => (
              <SortableStop
                key={`${s.id}-${s.priority}-${s.tw_type}-${s.tw_start}-${s.tw_end}`}
                stop={s}
                onDelete={onDelete}
                onFixCoords={onFixCoords}
                onUpdateConstraints={onUpdateConstraints}
                saving={constraintsSavingId === s.id}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
