import type { StopDto } from "../../api/client";
import { formatTimeHe, stopWindowHe } from "../../lib/roundBrief";
import styles from "../../pages/BoardPage.module.css";

type Props = {
  stop: StopDto;
  index: number;
  active: boolean;
  isNext: boolean;
  onSelect: (id: number) => void;
};

export function BoardStopRow({
  stop,
  index,
  active,
  isNext,
  onSelect,
}: Props) {
  const done = stop.status === "done" || stop.status === "skipped";
  const win = stopWindowHe(stop);

  return (
    <li>
      <button
        type="button"
        data-stop-id={stop.id}
        className={[
          styles.item,
          active ? styles.itemActive : "",
          isNext ? styles.itemNext : "",
          done ? styles.itemDone : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => onSelect(stop.id)}
        aria-current={active ? "true" : undefined}
      >
        <span className={`${styles.seq} num`}>{index + 1}</span>
        <span className={styles.itemBody}>
          <span className={styles.name}>
            {stop.customer_name}
            {isNext ? <span className={styles.nextTag}>הבא</span> : null}
            {stop.priority === "vip" ? (
              <span className={styles.vip}>VIP</span>
            ) : null}
          </span>
          <span className={styles.addr}>{stop.address}</span>
          {win || stop.learned_badge ? (
            <span className={styles.chips}>
              {win ? <span className={styles.winChip}>{win}</span> : null}
              {stop.learned_badge ? (
                <span className={styles.learnChip}>{stop.learned_badge}</span>
              ) : null}
            </span>
          ) : null}
        </span>
        <span className={styles.etaCol}>
          <span className={styles.etaLabel}>הגעה</span>
          <span className={`${styles.eta} num`}>{formatTimeHe(stop.eta)}</span>
        </span>
      </button>
    </li>
  );
}
