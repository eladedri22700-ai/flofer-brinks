import styles from "./Skeleton.module.css";

type Props = {
  width?: string | number;
  height?: string | number;
  radius?: string;
  className?: string;
};

export function Skeleton({
  width = "100%",
  height = 16,
  radius = "8px",
  className,
}: Props) {
  return (
    <div
      className={`${styles.skeleton} ${className ?? ""}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden
    />
  );
}
