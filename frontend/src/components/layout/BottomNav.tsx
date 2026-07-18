import { NavLink } from "react-router-dom";
import styles from "./BottomNav.module.css";

type Props = {
  onMore: () => void;
  moreOpen?: boolean;
};

const primary = [
  { to: "/app/dashboard", label: "בית", icon: "dash", tour: "nav-home" },
  { to: "/app/plan", label: "תכנון", icon: "plan", tour: "nav-plan" },
  { to: "/app/live", label: "נסיעה", icon: "live", tour: "nav-live" },
] as const;

function Icon({ name, active }: { name: string; active: boolean }) {
  const stroke = active ? "var(--brass-400)" : "currentColor";
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "plan") {
    return (
      <svg {...common}>
        <path d="M8 4h10a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2h2" />
        <path d="M9 9h8M9 13h6" />
      </svg>
    );
  }
  if (name === "dash") {
    return (
      <svg {...common}>
        <path d="M3 12l9-9 9 9" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
    </svg>
  );
}

export function BottomNav({ onMore, moreOpen }: Props) {
  return (
    <nav className={styles.nav} aria-label="ניווט ראשי">
      {primary.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/app/dashboard"}
          data-tour={item.tour}
          className={({ isActive }) =>
            isActive ? `${styles.item} ${styles.active}` : styles.item
          }
        >
          {({ isActive }) => (
            <>
              <Icon name={item.icon} active={isActive} />
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
      <button
        type="button"
        data-tour="nav-more"
        className={moreOpen ? `${styles.item} ${styles.active}` : styles.item}
        onClick={onMore}
        aria-expanded={moreOpen}
        aria-haspopup="dialog"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <circle cx="5" cy="12" r="1.6" fill="currentColor" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          <circle cx="19" cy="12" r="1.6" fill="currentColor" />
        </svg>
        <span>עוד</span>
      </button>
    </nav>
  );
}
