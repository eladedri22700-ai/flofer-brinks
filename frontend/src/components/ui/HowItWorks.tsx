import { useId, useState } from "react";
import type { HelpBlock } from "../../lib/helpCopy";
import styles from "./HowItWorks.module.css";

type Props = {
  block: HelpBlock;
  /** Open on first view — use only when the screen is otherwise empty. */
  defaultOpen?: boolean;
};

export function HowItWorks({ block, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className={styles.wrap} aria-label={block.title}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
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
