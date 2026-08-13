import { useState } from "react";
import { Link } from "react-router-dom";
import { StatusBanner } from "../ui/StatusBanner";
import {
  notificationsGranted,
  requestLiveNotifications,
} from "../../lib/liveNotifications";
import styles from "./LockScreenHint.module.css";

type Props = {
  telegramOn: boolean;
};

export function LockScreenHint({ telegramOn }: Props) {
  const [granted, setGranted] = useState(notificationsGranted);
  const [busy, setBusy] = useState(false);

  if (granted && telegramOn) return null;

  async function onEnable() {
    setBusy(true);
    try {
      const ok = await requestLiveNotifications();
      setGranted(ok);
    } finally {
      setBusy(false);
    }
  }

  return (
    <StatusBanner tone="brass" role="status">
      {!granted ? (
        <span className={styles.row}>
          <span>
            מסך נעול: אשרו התראות כדי לראות את היעד הבא גם כשהטלפון סגור.
          </span>
          <button
            type="button"
            className={styles.btn}
            disabled={busy}
            onClick={() => void onEnable()}
          >
            אשר התראות
          </button>
        </span>
      ) : !telegramOn ? (
        <span>
          התראות מערכת פעילות. אם סוגרים את האפליקציה לגמרי — הפעילו גם{" "}
          <Link to="/app/settings">Telegram</Link> כגיבוי.
        </span>
      ) : null}
    </StatusBanner>
  );
}
