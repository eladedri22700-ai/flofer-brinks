import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { disableDemo, enableDemoPractice } from "../../api/phase5";
import { markOnboardingDone } from "../../lib/onboarding";
import { onTourEvent } from "../../lib/tourEvents";
import { TOUR_STEPS } from "../../lib/tourSteps";
import { useTourStore } from "../../store/tourStore";
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
  const pad = 10;
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
  const setTourActive = useTourStore((s) => s.setActive);
  const setStepId = useTourStore((s) => s.setStepId);
  const setPlanTab = useTourStore((s) => s.setPlanTab);
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoReady, setDemoReady] = useState(false);
  const [waitDone, setWaitDone] = useState(true);

  const step = TOUR_STEPS[index];
  const total = TOUR_STEPS.length;
  const needsAction = Boolean(step?.waitFor) && !waitDone;

  useEffect(() => {
    setTourActive(active);
    if (!active) {
      setStepId(null);
      setPlanTab(null);
    }
    return () => {
      setTourActive(false);
      setStepId(null);
      setPlanTab(null);
    };
  }, [active, setTourActive, setStepId, setPlanTab]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setBusy(true);
    void enableDemoPractice()
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
    setStepId(step.id);
    setPlanTab(step.planTab ?? null);
    nav(step.path, { replace: true });
  }, [active, step, demoReady, nav, setStepId, setPlanTab]);

  useEffect(() => {
    if (!active || !step) return;
    if (!step.waitFor) {
      setWaitDone(true);
      return;
    }
    setWaitDone(false);
    return onTourEvent(step.waitFor, () => setWaitDone(true));
  }, [active, step, index]);

  useLayoutEffect(() => {
    if (!active || !step || !demoReady) return;
    let tries = 0;
    let timer: number | undefined;
    const tick = () => {
      const rect = measureTarget(step.target);
      setHole(rect);
      if (!rect && step.target && tries < 28) {
        tries += 1;
        timer = window.setTimeout(tick, 140);
      }
    };
    timer = window.setTimeout(tick, 120);
    const onResize = () => setHole(measureTarget(step.target));
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    if (step.target) {
      document
        .querySelector(`[data-tour="${step.target}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, step, demoReady, index, waitDone]);

  async function finishTour() {
    setBusy(true);
    try {
      await disableDemo().catch(() => undefined);
      void qc.invalidateQueries();
      markOnboardingDone();
      setTourActive(false);
      setStepId(null);
      setPlanTab(null);
      onFinished();
      nav("/app/dashboard", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (needsAction) return;
    if (index >= total - 1) {
      void finishTour();
      return;
    }
    setIndex((i) => i + 1);
  }

  if (!active) return null;

  if (!demoReady || !step) {
    return createPortal(
      <div className={styles.boot} role="status" aria-live="polite">
        <div className={styles.bootCard}>
          <p className={styles.bootTitle}>מכינים תרגול מעשי…</p>
          <p className={styles.bootBody}>
            טוענים נתוני דמו ומנקים את רשימת היום — כדי שתוסיפו כתובות וצילום
            בעצמכם, צעד אחר צעד.
          </p>
        </div>
      </div>,
      document.body,
    );
  }

  const holeAtBottom =
    hole != null && hole.top + hole.height > window.innerHeight * 0.52;
  const cardClass = holeAtBottom
    ? `${styles.card} ${styles.cardTop}`
    : styles.card;

  return createPortal(
    <>
      <div className={styles.demoBanner} role="status">
        {needsAction
          ? "תרגול פעיל · בצעו את הצעד המודגש"
          : "מצב הדגמה · הדרכה חיה ביחד"}
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
        <div className={styles.meta}>
          <span className={styles.badge}>
            שלב {index + 1}/{total}
          </span>
          <span className={styles.screen}>{step.screen}</span>
          {step.waitFor ? (
            <span className={needsAction ? styles.waitBadge : styles.doneBadge}>
              {needsAction ? "ממתינים לפעולה שלכם" : "בוצע ✓"}
            </span>
          ) : null}
        </div>
        <h2 className={styles.title}>{step.title}</h2>
        <p className={styles.body}>{step.body}</p>
        {step.bullets?.length ? (
          <ul className={styles.bullets}>
            {step.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
        {step.clickHint ? (
          <p className={styles.hint}>{step.clickHint}</p>
        ) : null}
        <div className={styles.actions}>
          {index > 0 ? (
            <Button
              variant="ghost"
              size="md"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={busy}
            >
              חזרה
            </Button>
          ) : null}
          <Button
            size="lg"
            loading={busy}
            disabled={needsAction}
            onClick={next}
          >
            {index >= total - 1
              ? "סיים · עבור למצב אמת"
              : needsAction
                ? "השלימו את הצעד…"
                : "הבנתי · המשך"}
          </Button>
        </div>
        {needsAction ? (
          <Button
            variant="ghost"
            size="md"
            disabled={busy}
            onClick={() => setWaitDone(true)}
          >
            דלג על התרגיל הזה
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="md"
            disabled={busy}
            onClick={() => void finishTour()}
          >
            דלג וסיים הדרכה
          </Button>
        )}
      </div>
    </>,
    document.body,
  );
}
