import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from "react";
import styles from "./VaultDial.module.css";

export type VaultDialHandle = {
  completeStep: () => void;
};

type Props = {
  completed?: number;
  total?: number;
  size?: number;
};

export const VaultDial = forwardRef<VaultDialHandle, Props>(function VaultDial(
  { completed = 0, total = 0, size = 160 },
  ref,
) {
  const [displayCompleted, setDisplayCompleted] = useState(completed);
  const [displayTotal, setDisplayTotal] = useState(total);
  const [rotation, setRotation] = useState(0);
  const [snap, setSnap] = useState(false);

  const ratio =
    displayTotal > 0 ? Math.min(displayCompleted / displayTotal, 1) : 0;
  const circumference = 2 * Math.PI * 54;
  const dash = circumference * ratio;

  const completeStep = useCallback(() => {
    setDisplayTotal((t) => {
      const nextTotal = t === 0 ? 8 : t;
      setDisplayCompleted((c) => Math.min(c + 1, nextTotal));
      return nextTotal;
    });
    setSnap(true);
    setRotation((r) => r + 45);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
    window.setTimeout(() => setSnap(false), 240);
  }, []);

  useImperativeHandle(ref, () => ({ completeStep }), [completeStep]);

  const ticks = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div
      className={`${styles.wrap} ${snap ? styles.snap : ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`חוגת כספת ${displayCompleted} מתוך ${displayTotal}`}
    >
      <svg viewBox="0 0 140 140" className={styles.svg}>
        <circle cx="70" cy="70" r="62" className={styles.outer} />
        {ticks.map((i) => {
          const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
          const x1 = 70 + Math.cos(angle) * 58;
          const y1 = 70 + Math.sin(angle) * 58;
          const x2 = 70 + Math.cos(angle) * (i % 6 === 0 ? 50 : 54);
          const y2 = 70 + Math.sin(angle) * (i % 6 === 0 ? 50 : 54);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={styles.tick}
            />
          );
        })}
        <circle cx="70" cy="70" r="54" className={styles.track} />
        <circle
          cx="70"
          cy="70"
          r="54"
          className={styles.progress}
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 70 70)"
        />
        <g
          className={styles.needle}
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <line x1="70" y1="70" x2="70" y2="28" className={styles.needleLine} />
          <circle cx="70" cy="70" r="5" className={styles.hub} />
        </g>
      </svg>
      <div className={`${styles.center} num`}>
        {displayCompleted}/{displayTotal}
      </div>
    </div>
  );
});
