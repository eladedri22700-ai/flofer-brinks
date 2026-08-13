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

export type StopDetailsPatch = {
  customer_name: string;
  address: string;
  notes: string | null;
  service_duration_min: number;
};

type Props = {
  stops: StopDto[];
  onReorder: (ids: number[]) => void;
  onDelete: (id: number) => void;
  onFixCoords: (id: number, lat: number, lng: number) => void;
  onUpdateConstraints: (id: number, body: StopConstraintsPatch) => void;
  onUpdateDetails: (id: number, body: StopDetailsPatch) => void;
  constraintsSavingId?: number | null;
  detailsSavingId?: number | null;
};

const TW_OPTIONS = [
  { value: "none", label: "ללא" },
  { value: "before", label: "עד שעה" },
  { value: "after", label: "משעה" },
  { value: "window", label: "חלון" },
] as const;

function toTimeInput(value: string | null | undefined): string {
  if (!value) return "";
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
  onUpdateDetails,
  savingConstraints,
  savingDetails,
}: {
  stop: StopDto;
  onDelete: (id: number) => void;
  onFixCoords: (id: number, lat: number, lng: number) => void;
  onUpdateConstraints: (id: number, body: StopConstraintsPatch) => void;
  onUpdateDetails: (id: number, body: StopDetailsPatch) => void;
  savingConstraints: boolean;
  savingDetails: boolean;
}) {
  const isDone = stop.status === "done";
  const canRemove = !isDone;
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: stop.id, disabled: isDone });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDone ? 0.72 : undefined,
  };
  const low = stop.geocode_confidence != null && stop.geocode_confidence < 0.7;
  const [panel, setPanel] = useState<"none" | "edit" | "tw">("none");
  const [confirmDel, setConfirmDel] = useState(false);
  const [vip, setVip] = useState(stop.priority === "vip");
  const [twType, setTwType] = useState<StopConstraintsPatch["tw_type"]>(
    (stop.tw_type as StopConstraintsPatch["tw_type"]) || "none",
  );
  const [twStart, setTwStart] = useState(toTimeInput(stop.tw_start));
  const [twEnd, setTwEnd] = useState(toTimeInput(stop.tw_end));
  const [name, setName] = useState(stop.customer_name);
  const [address, setAddress] = useState(stop.address);
  const [notes, setNotes] = useState(stop.notes ?? "");
  const [serviceMin, setServiceMin] = useState(String(stop.service_duration_min));

  const constraintText = twLabelHe(stop);

  function saveConstraints() {
    if (
      (twType === "before" && !twEnd) ||
      (twType === "after" && !twStart) ||
      (twType === "window" && (!twStart || !twEnd))
    ) {
      return;
    }
    onUpdateConstraints(stop.id, {
      priority: vip ? "vip" : "normal",
      tw_type: twType,
      tw_start:
        twType === "after" || twType === "window" ? twStart || null : null,
      tw_end:
        twType === "before" || twType === "window" ? twEnd || null : null,
    });
  }

  function saveDetails() {
    if (!name.trim() || !address.trim()) return;
    onUpdateDetails(stop.id, {
      customer_name: name.trim(),
      address: address.trim(),
      notes: notes.trim() || null,
      service_duration_min: Number(serviceMin) || stop.service_duration_min,
    });
    setPanel("none");
  }

  return (
    <div ref={setNodeRef} style={style} className={styles.item}>
      <Card statusBar={stop.priority === "vip" ? "gold" : low ? "danger" : "info"}>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.grip}
            aria-label={isDone ? "יעד שבוצע — לא ניתן לגרור" : "גרור לסידור ידני"}
            disabled={isDone}
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
          <div className={styles.main}>
            <div className={styles.name}>
              <span className={`${styles.seq} num`}>{stop.sequence_order + 1}</span>
              {stop.customer_name}
              {stop.priority === "vip" ? (
                <span className={styles.vip}>VIP</span>
              ) : null}
              {isDone ? <span className={styles.statusDone}>בוצע</span> : null}
              {stop.status === "skipped" ? (
                <span className={styles.statusSkip}>דולג</span>
              ) : null}
              {constraintText ? (
                <span className={`${styles.twBadge} num`}>{constraintText}</span>
              ) : null}
            </div>
            <div className={styles.addr}>{stop.address}</div>
            <div className={styles.meta}>
              {stop.learned_badge}
              {stop.parking_badge ? ` · ${stop.parking_badge}` : ""}
              {stop.notes ? ` · ${stop.notes}` : ""}
            </div>

            <div className={styles.quickActions}>
              <button
                type="button"
                className={
                  vip || stop.priority === "vip" ? styles.chipOn : styles.chip
                }
                onClick={() => {
                  const next = !(stop.priority === "vip");
                  setVip(next);
                  onUpdateConstraints(stop.id, {
                    priority: next ? "vip" : "normal",
                    tw_type:
                      (stop.tw_type as StopConstraintsPatch["tw_type"]) ||
                      "none",
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
                className={panel === "edit" ? styles.chipOn : styles.chip}
                aria-expanded={panel === "edit"}
                onClick={() =>
                  setPanel((p) => (p === "edit" ? "none" : "edit"))
                }
              >
                {panel === "edit" ? "סגור עריכה" : "ערוך"}
              </button>
              <button
                type="button"
                className={panel === "tw" ? styles.chipOn : styles.chip}
                aria-expanded={panel === "tw"}
                onClick={() => setPanel((p) => (p === "tw" ? "none" : "tw"))}
              >
                {panel === "tw" ? "סגור זמן" : "דרישת זמן"}
              </button>
            </div>

            {panel === "edit" ? (
              <div className={styles.constraints}>
                <p className={styles.constraintsHint}>
                  עריכת שם, כתובת, דקות שירות והערות — נשמר מיד ללא חישוב מחדש.
                </p>
                <label className={styles.fieldLabel}>
                  שם לקוח
                  <input
                    className={styles.fieldInput}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  כתובת
                  <input
                    className={styles.fieldInput}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  דקות שירות
                  <input
                    className={styles.fieldInput}
                    type="number"
                    min={1}
                    value={serviceMin}
                    onChange={(e) => setServiceMin(e.target.value)}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  הערות
                  <input
                    className={styles.fieldInput}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="אופציונלי"
                  />
                </label>
                <Button
                  type="button"
                  size="lg"
                  loading={savingDetails}
                  disabled={!name.trim() || !address.trim()}
                  onClick={saveDetails}
                >
                  שמור פרטי יעד
                </Button>
              </div>
            ) : null}

            {panel === "tw" ? (
              <div className={styles.constraints}>
                <p className={styles.constraintsHint}>
                  האילוץ נכנס לחישוב המסלול — המטרה היא חזרה מהירה לסניף ברינקס.
                </p>
                <div className={styles.segments} role="group" aria-label="דרישת זמן">
                  {TW_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={
                        twType === opt.value ? styles.segActive : styles.seg
                      }
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
                  עדיפות VIP
                </label>
                <Button
                  type="button"
                  size="lg"
                  loading={savingConstraints}
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
                        (
                          document.getElementById(
                            `lat-${stop.id}`,
                          ) as HTMLInputElement
                        ).value,
                      );
                      const lng = Number(
                        (
                          document.getElementById(
                            `lng-${stop.id}`,
                          ) as HTMLInputElement
                        ).value,
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
          <div className={styles.delCol}>
            {!canRemove ? (
              <span className={styles.delHint}>לא ניתן להסיר</span>
            ) : confirmDel ? (
              <>
                <Button
                  variant="danger"
                  type="button"
                  onClick={() => onDelete(stop.id)}
                >
                  כן, הסר
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setConfirmDel(false)}
                >
                  ביטול
                </Button>
              </>
            ) : (
              <Button
                variant="danger"
                type="button"
                onClick={() => setConfirmDel(true)}
                aria-label={`הסר את ${stop.customer_name}`}
              >
                הסר
              </Button>
            )}
          </div>
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
  onUpdateDetails,
  constraintsSavingId = null,
  detailsSavingId = null,
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
    onReorder(arrayMove(ids, oldIndex, newIndex));
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className={styles.list}>
            {stops.map((s) => (
              <SortableStop
                key={`${s.id}-${s.priority}-${s.tw_type}-${s.customer_name}-${s.address}`}
                stop={s}
                onDelete={onDelete}
                onFixCoords={onFixCoords}
                onUpdateConstraints={onUpdateConstraints}
                onUpdateDetails={onUpdateDetails}
                savingConstraints={constraintsSavingId === s.id}
                savingDetails={detailsSavingId === s.id}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
