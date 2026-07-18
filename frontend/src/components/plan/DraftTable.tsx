import { Button } from "../ui/Button";
import type { DraftStop } from "../../api/client";
import styles from "./DraftTable.module.css";

type Props = {
  drafts: DraftStop[];
  onChange: (next: DraftStop[]) => void;
  onCommit: () => void;
  loading?: boolean;
};

export function DraftTable({ drafts, onChange, onCommit, loading }: Props) {
  if (drafts.length === 0) return null;

  function update(i: number, patch: Partial<DraftStop>) {
    onChange(drafts.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function remove(i: number) {
    onChange(drafts.filter((_, idx) => idx !== i));
  }

  return (
    <div className={styles.wrap} data-tour="plan-draft-commit">
      <h3 className={styles.title}>טיוטה לאישור</h3>
      <div className={styles.table}>
        {drafts.map((d, i) => (
          <div key={`${d.address}-${i}`} className={styles.row}>
            <input
              className={styles.input}
              value={d.customer_name}
              onChange={(e) => update(i, { customer_name: e.target.value })}
              aria-label="שם לקוח"
            />
            <input
              className={styles.input}
              value={d.address}
              onChange={(e) => update(i, { address: e.target.value })}
              aria-label="כתובת"
            />
            <input
              className={styles.input}
              value={d.time_note ?? ""}
              onChange={(e) => update(i, { time_note: e.target.value || null })}
              aria-label="הערת זמן"
              placeholder="הערת זמן"
            />
            <button type="button" className={styles.remove} onClick={() => remove(i)}>
              הסר
            </button>
          </div>
        ))}
      </div>
      <Button type="button" size="lg" loading={loading} onClick={onCommit}>
        הוסף הכל
      </Button>
    </div>
  );
}
