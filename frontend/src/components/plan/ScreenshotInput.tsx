import { useRef, useState } from "react";
import { DraftTable } from "./DraftTable";
import { Skeleton } from "../ui/Skeleton";
import { Button } from "../ui/Button";
import type { DraftStop } from "../../api/client";
import { DEMO_PHOTO_PATH } from "../../lib/demoAddresses";
import { IMAGE_ACCEPT, newDraftKey, prepareImageForUpload } from "../../lib/imagePrep";
import { emitTourEvent } from "../../lib/tourEvents";
import { useTourStore } from "../../store/tourStore";
import styles from "./ScreenshotInput.module.css";

type Props = {
  onExtract: (file: File) => Promise<DraftStop[]>;
  onCommit: (drafts: DraftStop[]) => void;
  loading?: boolean;
};

type PreviewItem = { url: string; name: string };

function withKeys(rows: DraftStop[]): DraftStop[] {
  return rows.map((r) => ({
    ...r,
    draft_key: r.draft_key ?? newDraftKey(),
    priority: r.priority ?? "normal",
  }));
}

export function ScreenshotInputTab({ onExtract, onCommit, loading }: Props) {
  const tourActive = useTourStore((s) => s.active);
  const [drafts, setDrafts] = useState<DraftStop[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function handleFiles(list: FileList | File[] | null) {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    setBusy(true);
    let added = 0;
    try {
      for (let i = 0; i < files.length; i += 1) {
        const raw = files[i];
        setProgress(
          files.length > 1
            ? `סורק תמונה ${i + 1} מתוך ${files.length}…`
            : "מזהה כתובות מהצילום…",
        );
        const prepared = await prepareImageForUpload(raw);
        const url = URL.createObjectURL(prepared);
        setPreviews((prev) => [
          ...prev.slice(-5),
          { url, name: prepared.name || raw.name || "תמונה" },
        ]);
        const rows = withKeys(await onExtract(prepared));
        if (rows.length > 0) {
          added += rows.length;
          setDrafts((prev) => [...prev, ...rows]);
        }
      }
      if (added > 0) emitTourEvent("tour:ocr-ready");
    } finally {
      setBusy(false);
      setProgress(null);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  async function useDemoPhoto() {
    setBusy(true);
    try {
      const res = await fetch(DEMO_PHOTO_PATH);
      const blob = await res.blob();
      const file = new File([blob], "zebra-demo.svg", {
        type: blob.type || "image/svg+xml",
      });
      await handleFiles([file]);
    } catch {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className={styles.wrap} data-tour="plan-shot">
      <p className={styles.lead}>
        אפשר לצלם או לבחור כמה תמונות מהגלריה — כל צילום נוסף מצטרף לטיוטה (לא
        מוחק את הקודם). כתובות שנזהו נשמרות גם ב«שמורים».
      </p>
      {tourActive ? (
        <Button
          type="button"
          size="lg"
          variant="secondary"
          loading={busy}
          onClick={() => void useDemoPhoto()}
          data-tour="plan-demo-photo"
        >
          השתמש בצילום דמה
        </Button>
      ) : null}

      <input
        ref={cameraRef}
        type="file"
        accept={IMAGE_ACCEPT}
        capture="environment"
        className={styles.hiddenInput}
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className={styles.hiddenInput}
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void handleFiles(e.target.files)}
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
          <span className={styles.actionHint}>מצלמה · תמונה אחת</span>
        </button>

        <button
          type="button"
          className={styles.actionSecondary}
          disabled={busy || loading}
          onClick={() => galleryRef.current?.click()}
        >
          <span className={styles.actionIcon} aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
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
          <span className={styles.actionHint}>בחירה מרובה · מוסיף לטיוטה</span>
        </button>
      </div>

      {previews.length > 0 ? (
        <ul className={styles.previewStrip} aria-label="תמונות שנסרקו">
          {previews.map((p) => (
            <li key={p.url} className={styles.preview}>
              <img src={p.url} alt="" className={styles.previewImg} />
              <span className={styles.previewName}>{p.name}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {busy ? (
        <div>
          <p className={styles.scan}>{progress ?? "מזהה כתובות…"}</p>
          <Skeleton height={72} />
        </div>
      ) : null}

      {drafts.length > 0 && !busy ? (
        <p className={styles.moreHint}>
          אפשר להוסיף עוד צילומים — הם יצטרפו לטיוטה למטה.
        </p>
      ) : null}

      <DraftTable
        drafts={drafts}
        onChange={setDrafts}
        loading={loading || busy}
        onCommit={(rows) => {
          onCommit(rows);
          const keep = new Set(rows.map((r) => r.draft_key));
          setDrafts((prev) => prev.filter((d) => !keep.has(d.draft_key)));
        }}
      />
    </div>
  );
}
