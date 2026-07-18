import type { ReactNode } from "react";
import styles from "./StatusBanner.module.css";

type Tone = "info" | "warning" | "danger" | "success" | "brass";

type Props = {
  children: ReactNode;
  tone?: Tone;
  role?: "status" | "alert";
};

export function StatusBanner({ children, tone = "info", role = "status" }: Props) {
  return (
    <div className={`${styles.banner} ${styles[tone]}`} role={role}>
      {children}
    </div>
  );
}
