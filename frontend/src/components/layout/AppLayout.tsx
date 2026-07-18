import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPrefs } from "../../api/live";
import { useAuthStore } from "../../store/authStore";
import { BrandLockup } from "../ui/BrandLockup";
import { BottomNav } from "./BottomNav";
import { MoreSheet } from "./MoreSheet";
import styles from "./AppLayout.module.css";

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const prefsQ = useQuery({ queryKey: ["prefs"], queryFn: getPrefs });
  const userName = user?.full_name ?? "ראש צוות";
  const demoMode = Boolean(prefsQ.data?.demo_mode);
  const theme = prefsQ.data?.theme;
  const boardMode = location.pathname.startsWith("/app/board");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.dataset.theme = "dark";
    } else {
      delete root.dataset.theme;
    }
  }, [theme]);

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        דלג לתוכן
      </a>
      {demoMode && !boardMode ? (
        <div className={styles.demoBanner} role="status">
          מצב הדגמה פעיל
        </div>
      ) : null}
      {boardMode ? null : (
        <header className={styles.brandBar}>
          <BrandLockup size="sm" markSize={30} />
        </header>
      )}
      <main
        id="main"
        className={boardMode ? styles.bodyBleed : styles.body}
        tabIndex={-1}
      >
        <Outlet />
      </main>
      {boardMode ? null : (
        <>
          <BottomNav moreOpen={moreOpen} onMore={() => setMoreOpen(true)} />
          <MoreSheet
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            userName={userName}
          />
        </>
      )}
    </div>
  );
}
