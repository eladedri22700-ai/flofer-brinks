import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { disableDemo, enableDemo } from "../../api/phase5";
import { markOnboardingDone } from "../../lib/onboarding";
import { TOUR_STEPS } from "../../lib/tourSteps";
import { Button } from "../ui/Button";
import styles from "./GuidedTour.module.css";

type Rect = { top: number; left: number; width: number; height: number };

type Props = {
  active: boolean;
  onFinished: () => void;
};

function measureTarget(attr: string | undefined): Rect | null {
  if (!attr) return null;
  const el = document.querySelector(`[data-tour="${attr}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const pad = 8;
  return {
    top: Math.max(4, r.top - pad),
    left: Math.max(4, r.left - pad),
    width: Math.min(window.innerWidth - 8, r.width + pad * 2),
    height: Math.min(window.innerHeight - 8, r.height + pad * 2),
  };
}

export function GuidedTour({ active, onFinished }: Props) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoReady, setDemoReady] = useState(false);

  const step = TOUR_STEPS[index];
  const total = TOUR_STEPS.length;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setBusy(true);
    void enableDemo()
      .then(() => {
        if (cancelled) return;
        setDemoReady(true);
        void qc.invalidateQueries();
      })
      .catch(() => {
        if (!cancelled) setDemoReady(true);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, qc]);

  useEffect(() => {
    if (!active || !step || !demoReady) return;
    nav(step.path, { replace: true });
  }, [active, step, demoReady, nav]);

  useLayoutEffect(() => {
    if (!active || !step || !demoReady) return;
    let tries = 0;
    let timer: number | undefined;

    const tick = () => {
      const rect = measureTarget(step.target);
      setHole(rect);
      if (!rect && step.target && tries < 20) {
        tries += 1;
        timer = window.setTimeout(tick, 120);
      }
    };

    timer = window.setTimeout(tick, 80);
    const onResize = () => setHole(measureTarget(step.target));
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    if (step.target) {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, step, demoReady, index]);

  async function finishTour() {
    setBusy(true);
    try {
      await disableDemo().catch(() => undefined);
      void qc.invalidateQueries();
      markOnboardingDone();
      onFinished();
      nav("/app/dashboard", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (index >= total - 1) {
      void finishTour();
      return;
    }
    setIndex((i) => i + 1);
  }

  function back() {
    setIndex((i) => Math.max(0, i - 1));
  }

  if (!active || !step) return null;

  const holeAtBottom = hole != null && hole.top + hole.height > window.innerHeight * 0.55;
  const cardClass = holeAtBottom
    ? `${styles.card} ${styles.cardTop}`
    : styles.card;

  return createPortal(
    <>
      <div className={styles.demoBanner} role="status">
        מצב הדגמה · הדרכה חיה
      </div>
      <div className={styles.overlay} aria-live="polite">
        {hole ? (
          <div
            className={styles.hole}
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
            }}
          />
        ) : (
          <div className={styles.dim} />
        )}
      </div>
      <div
        className={cardClass}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
      >
        <span className={styles.badge}>
          הדרכה {index + 1}/{total}
        </span>
        <h2 className={styles.title}>{step.title}</h2>
        <p className={styles.body}>{step.body}</p>
        {step.clickHint ? (
          <p className={styles.hint}>{step.clickHint}</p>
        ) : null}
        <p className={`${styles.progress} num`}>
          שלב {index + 1} מתוך {total}
        </p>
        <div className={styles.actions}>
          {index > 0 ? (
            <Button variant="ghost" size="md" onClick={back} disabled={busy}>
              חזרה
            </Button>
          ) : null}
          <Button size="lg" loading={busy} onClick={next}>
            {index >= total - 1 ? "סיים · עבור למצב אמת" : "המשך"}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="md"
          disabled={busy}
          onClick={() => void finishTour()}
        >
          דלג וסיים הדרכה
        </Button>
      </div>
    </>,
    document.body,
  );
}
