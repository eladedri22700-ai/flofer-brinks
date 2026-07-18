import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

type Props = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: Props) {
  return (
    <div className={styles.wrap} role="status">
      <div className={styles.orb} aria-hidden />
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.desc}>{description}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
