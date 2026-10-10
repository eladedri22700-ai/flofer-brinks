import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RouteDto } from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { sendFeedback, type FeedbackCategory, type FeedbackResult } from "../../api/feedback";
import { useOverlayStore } from "../../store/overlayStore";
import shared from "./overlays.module.css";
import styles from "./FeedbackSheet.module.css";

type Props = { route: RouteDto | null | undefined };

const CATEGORIES: { id: FeedbackCategory; label: string; hint: string }[] = [
  {
    id: "field_data",
    label: "מידע מהשטח",
    hint: "לדוגמה: «החניה כאן לוקחת 20 דקות», «פותחים רק מ־8:30», «כניסה מרמפה 3»",
  },
  { id: "bug", label: "תקלה באפליקציה", hint: "מה קרה, באיזה מסך, ומה ציפיתם שיקרה" },
  { id: "idea", label: "רעיון לשיפור", hint: "מה היה עוזר לכם ביום עבודה" },
];

export function FeedbackSheet({ route }: Props) {
  const { open, stopId } = useOverlayStore((s) => s.feedback);
  const close = useOverlayStore((s) => s.closeFeedback);
  const location = useLocation();
  const qc = useQueryClient();
  const [category, setCategory] = useState<FeedbackCategory>("field_data");
  const [text, setText] = useState("");
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const stop = stopId != null ? route?.stops.find((s) => s.id === stopId) : undefined;

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setText("");
    setCategory("field_data");
    window.setTimeout(() => areaRef.current?.focus(), 50);
  }, [open]);

  const sendM = useMutation({
    mutationFn: () =>
      sendFeedback({
        text: text.trim(),
        category,
        route_id: route?.id ?? null,
        stop_id: stop?.id ?? null,
        screen: location.pathname,
        app_version: document.querySelector<HTMLMetaElement>('meta[name="flofer-build"]')?.content,
      }),
    onSuccess: (res) => {
      setResult(res);
      if (res.applied.length > 0) void qc.invalidateQueries({ queryKey: ["route-today"] });
    },
  });

  if (!open) return null;
  const active = CATEGORIES.find((c) => c.id === category)!;

  return (
    <>
      <button type="button" className={shared.scrim} onClick={close} aria-label="סגור" />
      <div
        className={shared.sheet}
        style={{ maxHeight: "88%" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fb-title"
      >
        <div className={shared.sheetHead}>
          <div>
            <div id="fb-title" className={shared.sheetTitleName}>
              הערה מהשטח
            </div>
            <div className={shared.sheetTitleSub}>
              {stop ? `על: ${stop.customer_name}` : "המערכת לומדת מההערות ומשתפרת"}
            </div>
          </div>
          <button type="button" className={`${shared.closeBtn} tap`} onClick={close} aria-label="סגור">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {result ? (
            <div className={styles.result} role="status">
              <p className={styles.resultTitle}>תודה — ההערה התקבלה</p>
              {result.summary_he ? <p className={styles.resultSummary}>{result.summary_he}</p> : null}
              {result.applied.length > 0 ? (
                <>
                  <p className={styles.resultLabel}>מה עודכן עכשיו:</p>
                  <ul className={styles.appliedList}>
                    {result.applied.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className={styles.resultSummary}>
                  נשמרה לבדיקה{result.forwarded ? " והועברה לצוות הפיתוח" : ""}.
                </p>
              )}
              <button type="button" className={`${styles.primary} tap`} onClick={close}>
                סגור
              </button>
            </div>
          ) : (
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim().length >= 2) sendM.mutate();
              }}
            >
              <div className={styles.segment} role="radiogroup" aria-label="סוג ההערה">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={category === c.id}
                    className={category === c.id ? styles.segOn : styles.seg}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <label className={styles.label} htmlFor="fb-text">
                מה כדאי שהמערכת תדע?
              </label>
              <textarea
                id="fb-text"
                ref={areaRef}
                className={styles.textarea}
                rows={5}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={active.hint}
              />
              <p className={styles.tip}>אפשר גם להכתיב — לחצו על המיקרופון במקלדת.</p>
              {sendM.isError ? (
                <p className={styles.error} role="alert">
                  {apiErrorMessage(sendM.error)}
                </p>
              ) : null}
              <button
                type="submit"
                className={`${styles.primary} tap`}
                disabled={sendM.isPending || text.trim().length < 2}
              >
                {sendM.isPending ? "שולח ומעבד…" : "שליחה"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
