import type { InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, id, className, ...rest }: Props) {
  const inputId = id ?? rest.name ?? label;

  return (
    <div className={`${styles.field} ${className ?? ""}`}>
      <div className={`${styles.wrap} ${error ? styles.hasError : ""}`}>
        <input id={inputId} className={styles.input} placeholder=" " {...rest} />
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
