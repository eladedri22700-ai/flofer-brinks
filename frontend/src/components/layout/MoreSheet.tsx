import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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

type IconName =
  | "map"
  | "list"
  | "order"
  | "add"
  | "clock"
  | "history"
  | "summary"
  | "settings"
  | "help"
  | "legal"
  | "install"
  | "logout"
  | "note";

const ICON_PATHS: Record<IconName, ReactNode> = {
  map: (
    <>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </>
  ),
  order: <path d="M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3" />,
  add: (
    <>
      <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
      <path d="M12 8v6M9 11h6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 8v4l3 2" />
    </>
  ),
  summary: (
    <>
      <path d="M5 4h14v16H5z" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01" />
    </>
  ),
  legal: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5a3.5 3.5 0 1 0 0 5" />
    </>
  ),
  install: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  note: (
    <>
      <path d="M4 5h16v11H8l-4 4V5z" />
      <path d="M8 9h8M8 12.5h5" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4h4v16h-4" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </>
  ),
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

type Entry =
  | { kind: "link"; to: string; title: string; desc?: string; icon: IconName }
  | { kind: "fullList"; title: string; desc?: string; icon: IconName }
  | { kind: "feedback"; title: string; desc?: string; icon: IconName };

const GROUPS: { title: string; items: Entry[] }[] = [
  {
    title: "הסבב של היום",
    items: [
      { kind: "feedback", title: "הערה מהשטח", desc: "המערכת לומדת ומתעדכנת מיד", icon: "note" },
      { kind: "fullList", title: "כל הסבב", desc: "כל העצירות והזמנים", icon: "list" },
      { kind: "link", to: "/app/board", title: "מפת הסבב", desc: "המסלול והנקודות על המפה", icon: "map" },
      { kind: "link", to: "/app/route", title: "סדר הנקודות", desc: "שינוי ידני והסרה", icon: "order" },
      { kind: "link", to: "/app/add-stop", title: "הוספת עצירה", desc: "רואים השפעה לפני אישור", icon: "add" },
    ],
  },
  {
    title: "דוחות",
    items: [
      { kind: "link", to: "/app/hours", title: "שעות עבודה", desc: "דיווח שבועי", icon: "clock" },
      { kind: "link", to: "/app/history", title: "היסטוריה ותובנות", desc: "סבבים קודמים ושכפול", icon: "history" },
      { kind: "link", to: "/app/summary", title: "סיכום אחרון", icon: "summary" },
    ],
  },
  {
    title: "מערכת",
    items: [
      { kind: "link", to: "/app/settings", title: "הגדרות", desc: "סניף, תצוגה, התראות", icon: "settings" },
      { kind: "link", to: "/app/help", title: "עזרה", desc: "איך עובדים · שאלות נפוצות", icon: "help" },
      { kind: "link", to: "/app/legal", title: "תנאי שימוש וזכויות", icon: "legal" },
    ],
  },
];

export function MoreSheet({ open, onClose, userName }: Props) {
  const clearSession = useAuthStore((s) => s.clearSession);
  const username = useAuthStore((s) => s.user?.username);
  const openFullList = useOverlayStore((s) => s.openFullList);
  const openFeedback = useOverlayStore((s) => s.openFeedback);
  const qc = useQueryClient();
  const { canPrompt, promptInstall } = usePwaInstall();
  const standalone = isStandaloneDisplay();
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  function logout() {
    clearSavedLogin();
    markSandbox(false);
    clearSession();
    qc.clear();
    onClose();
  }

  function rowContent(e: { title: string; desc?: string; icon: IconName }) {
    return (
      <>
        <span className={styles.icon}>
          <Icon name={e.icon} />
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{e.title}</span>
          {e.desc ? <span className={styles.rowDesc}>{e.desc}</span> : null}
        </span>
        <svg className={styles.chev} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M14 6l-6 6 6 6" />
        </svg>
      </>
    );
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="תפריט נוסף"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden />
        <div className={styles.head}>
          <div>
            <p className={styles.hello}>שלום, {userName}</p>
            {username ? <p className={styles.account}>{username}</p> : null}
          </div>
          <button type="button" className={styles.closeX} onClick={onClose} aria-label="סגירת התפריט">
            ×
          </button>
        </div>

        <div className={styles.scroll}>
          {!standalone ? (
            <button
              type="button"
              className={styles.install}
              onClick={() => {
                void promptInstall();
                onClose();
              }}
            >
              <Icon name="install" />
              {canPrompt ? "התקנה למסך הבית" : "איך מתקינים למסך הבית"}
            </button>
          ) : null}

          {GROUPS.map((g) => (
            <section key={g.title} className={styles.group} aria-label={g.title}>
              <h2 className={styles.groupTitle}>{g.title}</h2>
              <ul className={styles.list}>
                {g.items.map((e) => (
                  <li key={e.title}>
                    {e.kind === "link" ? (
                      <Link to={e.to} className={styles.row} onClick={onClose}>
                        {rowContent(e)}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={styles.row}
                        onClick={() => {
                          if (e.kind === "feedback") openFeedback(null);
                          else openFullList();
                          onClose();
                        }}
                      >
                        {rowContent(e)}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <button type="button" className={styles.logout} onClick={logout}>
            <Icon name="logout" />
            התנתקות
          </button>
          <p className={styles.copyright} title={copyrightLine()}>
            {copyrightShort()}
          </p>
        </div>
      </div>
    </div>
  );
}
