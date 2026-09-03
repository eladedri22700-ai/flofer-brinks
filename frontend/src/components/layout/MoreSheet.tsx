import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BrandLockup } from "../ui/BrandLockup";
import { copyrightLine, copyrightShort } from "../../lib/legal";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { isStandaloneDisplay } from "../../lib/onboarding";
import { clearSavedLogin } from "../../lib/savedLogin";
import { markSandbox } from "../../lib/sandbox";
import { useAuthStore } from "../../store/authStore";
import { useOverlayStore } from "../../store/overlayStore";
import styles from "./MoreSheet.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  userName: string;
};

const links = [
  {
    to: "/app/help",
    title: "איך עובדים היום",
    desc: "הסבר קצר · 4 צעדים · שאלות נפוצות",
  },
  {
    to: "/app/board",
    title: "מפת הסבב",
    desc: "כל הנקודות והמסלול",
  },
  {
    to: "/app/route",
    title: "סדר הנקודות",
    desc: "שינוי ידני וחישוב מחדש",
  },
  {
    to: "/app/add-stop",
    title: "הוספת עצירה",
    desc: "בדיקת השפעה לפני אישור",
  },
  {
    to: "/app/hours",
    title: "שעות עבודה",
    desc: "דיווח שבועי",
  },
  { to: "/app/history", title: "היסטוריה ותובנות", desc: "סבבים קודמים · דיוק ETA · שכפול" },
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
  const openFullList = useOverlayStore((s) => s.openFullList);
  const qc = useQueryClient();
  const { canPrompt, promptInstall } = usePwaInstall();
  const standalone = isStandaloneDisplay();

  if (!open) return null;

  function logout() {
    clearSavedLogin();
    markSandbox(false);
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
        {!standalone ? (
          <button
            type="button"
            className={styles.install}
            onClick={() => {
              void promptInstall();
              onClose();
            }}
          >
            {canPrompt ? "הוסף למסך הבית" : "איך מתקינים למסך הבית"}
          </button>
        ) : null}
        <ul className={styles.list}>
          {links.map((l) => (
            <li key={l.to}>
              <Link to={l.to} className={styles.link} onClick={onClose}>
                <span className={styles.linkTitle}>{l.title}</span>
                <span className={styles.linkDesc}>{l.desc}</span>
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={styles.link}
              onClick={() => {
                openFullList();
                onClose();
              }}
            >
              <span className={styles.linkTitle}>כל הסבב</span>
              <span className={styles.linkDesc}>רשימת כל העצירות והזמנים</span>
            </button>
          </li>
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
