import { useState } from "react";
import { Button } from "../ui/Button";
import { DraftTable } from "./DraftTable";
import type { DraftStop } from "../../api/client";
import styles from "./FileInput.module.css";

type Props = {
  onImport: (file: File) => Promise<DraftStop[]>;
  onCommit: (drafts: DraftStop[]) => void;
  loading?: boolean;
};

export function FileInputTab({ onImport, onCommit, loading }: Props) {
  const [drafts, setDrafts] = useState<DraftStop[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const rows = await onImport(file);
      setDrafts(rows);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <label className={styles.drop}>
        <span>גררו קובץ Excel/CSV לכאן או לחצו לבחירה</span>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <DraftTable
        drafts={drafts}
        onChange={setDrafts}
        loading={loading || busy}
        onCommit={() => onCommit(drafts)}
      />
      {drafts.length === 0 && !busy ? (
        <p className={styles.hint}>הקובץ יוצג כטיוטה לפני הוספה לסבב.</p>
      ) : null}
      {busy ? <Button loading>קורא קובץ…</Button> : null}
    </div>
  );
}
