import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BrandLockup } from "../ui/BrandLockup";
import { copyrightLine, copyrightShort } from "../../lib/legal";
import { useAuthStore } from "../../store/authStore";
import styles from "./MoreSheet.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  userName: string;
};

const links = [
  {
    to: "/app/route",
    title: "סדר הנקודות",
    desc: "כל הכתובות · גרירה לשינוי ידני",
  },
  {
    to: "/app/board",
    title: "מפת הסבב",
    desc: "מפה · אישור יציאה · התחל סבב",
  },
  { to: "/app/history", title: "היסטוריה", desc: "סבבים קודמים ודיוק" },
  { to: "/app/summary", title: "סיכום אחרון", desc: "סיכום סבב שהסתיים" },
  { to: "/app/settings", title: "הגדרות", desc: "מפתחות, Telegram, SOS והדגמה" },
  {
    to: "/app/legal",
    title: "זכויות יוצרים ותנאי שימוש",
    desc: "© הגנה על המוצר · תנאי שימוש",
  },
];

export function MoreSheet({ open, onClose, userName }: Props) {
  const clearSession = useAuthStore((s) => s.clearSession);
  const username = useAuthStore((s) => s.user?.username);
  const qc = useQueryClient();

  if (!open) return null;

  function logout() {
    clearSession();
    qc.clear();
    onClose();
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="תפריט נוסף"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden />
        <div className={styles.brandRow}>
          <BrandLockup size="sm" markSize={28} to={null} />
        </div>
        <p className={styles.hello}>שלום, {userName}</p>
        {username ? (
          <p className={styles.account}>חשבון: {username}</p>
        ) : null}
        <p className={styles.hint}>כלים שאינם בשימוש יומיומי בשטח</p>
        <ul className={styles.list}>
          {links.map((l) => (
            <li key={l.to}>
              <Link to={l.to} className={styles.link} onClick={onClose}>
                <span className={styles.linkTitle}>{l.title}</span>
                <span className={styles.linkDesc}>{l.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className={styles.copyright} title={copyrightLine()}>
          {copyrightShort()}
        </p>
        <button type="button" className={styles.logout} onClick={logout}>
          התנתקות (חשבון אחר)
        </button>
        <button type="button" className={styles.close} onClick={onClose}>
          סגור
        </button>
      </div>
    </div>
  );
}
