import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

type StatusBar = "gold" | "info" | "success" | "danger" | "none";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  statusBar?: StatusBar;
};

export function Card({
  children,
  statusBar = "none",
  className,
  ...rest
}: Props) {
  return (
    <div
      className={`${styles.card} ${styles[`bar_${statusBar}`]} ${className ?? ""}`}
      {...rest}
    >
      {children}
    </div>
  );
}
