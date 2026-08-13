import { useMemo, useState } from "react";
import { Button } from "../ui/Button";
import type { DraftStop } from "../../api/client";
import styles from "./DraftTable.module.css";

type Props = {
  drafts: DraftStop[];
  onChange: (next: DraftStop[]) => void;
  onCommit: (selected: DraftStop[]) => void;
  loading?: boolean;
};

const TW_PRESETS: { label: string; note: string | null }[] = [
  { label: "ללא", note: null },
  { label: "עד 10:00", note: "עד 10:00" },
  { label: "עד 12:00", note: "עד 12:00" },
  { label: "משעה 14:00", note: "משעה 14:00" },
];

export function DraftTable({ drafts, onChange, onCommit, loading }: Props) {
  /** null = all selected */
  const [selected, setSelected] = useState<Set<string> | null>(null);

  const keys = useMemo(
    () => drafts.map((d, i) => d.draft_key ?? `i-${i}-${d.address}`),
    [drafts],
  );

  if (drafts.length === 0) return null;

  const effective = selected ?? new Set(keys);
  const commitCount = drafts.filter((_, i) => effective.has(keys[i])).length;

  function update(i: number, patch: Partial<DraftStop>) {
    onChange(drafts.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function remove(i: number) {
    const key = keys[i];
    onChange(drafts.filter((_, idx) => idx !== i));
    setSelected((prev) => {
      if (!prev) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const base = new Set(prev ?? keys);
      if (base.has(key)) base.delete(key);
      else base.add(key);
      return base;
    });
  }

  return (
    <div className={styles.wrap} data-tour="plan-draft-commit">
      <div className={styles.head}>
        <h3 className={styles.title}>טיוטה לאישור · {drafts.length}</h3>
        <div className={styles.headActions}>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => setSelected(null)}
          >
            בחר הכל
          </button>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => setSelected(new Set())}
          >
            נקה בחירה
          </button>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => {
              onChange([]);
              setSelected(null);
            }}
          >
            מחק טיוטה
          </button>
        </div>
      </div>

      <div className={styles.cards}>
        {drafts.map((d, i) => {
          const key = keys[i];
          const isOn = effective.has(key);
          const vip = d.priority === "vip";
          return (
            <article key={key} className={isOn ? styles.cardOn : styles.card}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(key)}
                />
                <span>להוספה</span>
              </label>
              <input
                className={styles.input}
                value={d.customer_name}
                onChange={(e) => update(i, { customer_name: e.target.value })}
                aria-label="שם לקוח"
                placeholder="שם לקוח"
              />
              <input
                className={styles.input}
                value={d.address}
                onChange={(e) => update(i, { address: e.target.value })}
                aria-label="כתובת"
                placeholder="כתובת"
              />
              <div className={styles.chips} role="group" aria-label="חלון זמן">
                {TW_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className={
                      (d.time_note ?? null) === p.note
                        ? styles.chipOn
                        : styles.chip
                    }
                    onClick={() => update(i, { time_note: p.note })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className={styles.rowActions}>
                <button
                  type="button"
                  className={vip ? styles.chipOn : styles.chip}
                  aria-pressed={vip}
                  onClick={() =>
                    update(i, { priority: vip ? "normal" : "vip" })
                  }
                >
                  VIP
                </button>
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => remove(i)}
                >
                  הסר
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <Button
        type="button"
        size="lg"
        loading={loading}
        disabled={commitCount === 0}
        onClick={() => {
          const rows = drafts.filter((_, i) => effective.has(keys[i]));
          onCommit(rows);
          setSelected(null);
        }}
      >
        {commitCount === drafts.length
          ? `הוסף הכל · ${commitCount}`
          : `הוסף נבחרים · ${commitCount}`}
      </Button>
    </div>
  );
}
