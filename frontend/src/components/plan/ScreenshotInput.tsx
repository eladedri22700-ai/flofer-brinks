import { useState } from "react";
import { DraftTable } from "./DraftTable";
import { Skeleton } from "../ui/Skeleton";
import type { DraftStop } from "../../api/client";
import styles from "./ScreenshotInput.module.css";

type Props = {
  onExtract: (file: File) => Promise<DraftStop[]>;
  onCommit: (drafts: DraftStop[]) => void;
  loading?: boolean;
};

export function ScreenshotInputTab({ onExtract, onCommit, loading }: Props) {
  const [drafts, setDrafts] = useState<DraftStop[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const rows = await onExtract(file);
      setDrafts(rows);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <label className={styles.drop}>
        <span>צלמו או העלו צילום מסך של רשימת יעדים</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {busy ? (
        <div>
          <p className={styles.scan}>סורק את הצילום…</p>
          <Skeleton height={72} />
        </div>
      ) : null}
      <DraftTable
        drafts={drafts}
        onChange={setDrafts}
        loading={loading || busy}
        onCommit={() => onCommit(drafts)}
      />
    </div>
  );
}
