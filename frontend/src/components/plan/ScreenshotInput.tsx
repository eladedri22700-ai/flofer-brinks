import { useRef, useState } from "react";
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name || "תמונה");
    setBusy(true);
    try {
      const rows = await onExtract(file);
      setDrafts(rows);
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.lead}>
        צלמו את רשימת היעדים מ־Zebra, או בחרו צילום מסך מהגלריה. כל כתובת
        שנזהתה נשמרת אוטומטית בספריית «שמורים» לפעמים הבאות.
      </p>

      {/* Two inputs: capture forces camera; without capture opens gallery/photos */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.hiddenInput}
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />

      <div className={styles.actions} role="group" aria-label="בחירת תמונה">
        <button
          type="button"
          className={styles.actionPrimary}
          disabled={busy || loading}
          onClick={() => cameraRef.current?.click()}
        >
          <span className={styles.actionIcon} aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.1-1.6A1.5 1.5 0 0 1 10 3.5h4a1.5 1.5 0 0 1 1.2.9L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          <span className={styles.actionTitle}>צלם עכשיו</span>
          <span className={styles.actionHint}>פותח מצלמה</span>
        </button>

        <button
          type="button"
          className={styles.actionSecondary}
          disabled={busy || loading}
          onClick={() => galleryRef.current?.click()}
        >
          <span className={styles.actionIcon} aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect
                x="3.5"
                y="5"
                width="17"
                height="14"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle cx="9" cy="10.5" r="1.6" fill="currentColor" />
              <path
                d="M3.5 16.5 8.5 12l3.2 3.2L15 12.5l5.5 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className={styles.actionTitle}>מהגלריה</span>
          <span className={styles.actionHint}>תמונות / צילומי מסך</span>
        </button>
      </div>

      {previewUrl ? (
        <div className={styles.preview}>
          <img src={previewUrl} alt="תצוגה מקדימה של הצילום" className={styles.previewImg} />
          <div className={styles.previewMeta}>
            <span className={styles.previewName}>{fileName}</span>
            {busy ? <span className={styles.previewBusy}>סורק…</span> : null}
          </div>
        </div>
      ) : null}

      {busy ? (
        <div>
          <p className={styles.scan}>מזהה כתובות מהצילום…</p>
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
