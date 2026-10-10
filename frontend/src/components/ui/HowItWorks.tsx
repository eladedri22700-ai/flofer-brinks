import { useEffect, useId, useState } from "react";
import type { HelpBlock } from "../../lib/helpCopy";
import styles from "./HowItWorks.module.css";

type Props = {
  block: HelpBlock;
  /** Open on first view — use only when the screen is otherwise empty. */
  defaultOpen?: boolean;
  /** Collapse after the first view (default). The Help page keeps it open. */
  remember?: boolean;
};

const SEEN_PREFIX = "flofer_help_seen:";

function wasSeen(title: string): boolean {
  try {
    return localStorage.getItem(SEEN_PREFIX + title) === "1";
  } catch {
    return false;
  }
}

function markSeen(title: string): void {
  try {
    localStorage.setItem(SEEN_PREFIX + title, "1");
  } catch {
    /* ignore */
  }
}

export function HowItWorks({ block, defaultOpen = false, remember = true }: Props) {
  // Open by default only the first time — after that the screen leads with work, not help.
  const [open, setOpen] = useState(
    () => defaultOpen && !(remember && wasSeen(block.title)),
  );

  useEffect(() => {
    if (remember && open) markSeen(block.title);
  }, [remember, open, block.title]);
  const panelId = useId();

  return (
    <section className={styles.wrap} aria-label={block.title}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        <span className={styles.mark} aria-hidden>
          ?
        </span>
        <span className={styles.toggleText}>
          {open ? "הסתר הסבר" : block.title}
        </span>
      </button>
      {open ? (
        <div id={panelId} className={styles.panel}>
          {block.intro ? <p className={styles.intro}>{block.intro}</p> : null}
          <ul className={styles.list}>
            {block.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
