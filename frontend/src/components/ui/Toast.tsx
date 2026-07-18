import styles from "./Toast.module.css";

export type ToastItem = {
  id: string;
  message: string;
  tone?: "error" | "success" | "info";
};

type Props = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

export function ToastList({ toasts, onDismiss }: Props) {
  return (
    <div className={styles.stack} aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${styles[t.tone ?? "info"]}`}
          role="status"
        >
          <span>{t.message}</span>
          <button
            type="button"
            className={styles.close}
            onClick={() => onDismiss(t.id)}
            aria-label="סגור"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function createToastId(): string {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
