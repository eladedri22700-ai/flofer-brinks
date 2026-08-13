import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPrefs } from "../../api/live";
import { getTodayRoute } from "../../api/planning";
import { isSandboxUser } from "../../lib/sandbox";
import { isRoundLive, nextOpenStop, sortedStops } from "../../lib/roundBrief";
import { useAuthStore } from "../../store/authStore";
import { NextStopHud } from "../live/NextStopHud";
import { InstallCoach } from "../pwa/InstallCoach";
import { OfflineBanner } from "../pwa/OfflineBanner";
import { PwaUpdateBanner } from "../pwa/PwaUpdateBanner";
import { BrandLockup } from "../ui/BrandLockup";
import { BottomNav } from "./BottomNav";
import { MoreSheet } from "./MoreSheet";
import { isStandaloneDisplay } from "../../lib/onboarding";
import { syncThemeColor } from "../../lib/standalone";
import styles from "./AppLayout.module.css";

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const prefsQ = useQuery({ queryKey: ["prefs"], queryFn: getPrefs });
  const routeQ = useQuery({ queryKey: ["route-today"], queryFn: getTodayRoute });
  const userName = user?.full_name ?? "ראש צוות";
  const demoMode = Boolean(prefsQ.data?.demo_mode);
  const sandbox = isSandboxUser(user?.username);
  const theme = prefsQ.data?.theme;
  const boardMode = location.pathname.startsWith("/app/board");
  const roundLive = isRoundLive(routeQ.data?.status);
  const standalone = isStandaloneDisplay();
  const liveHud =
    roundLive &&
    Boolean(nextOpenStop(sortedStops(routeQ.data))) &&
    !location.pathname.startsWith("/app/live") &&
    !boardMode;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.dataset.theme = "dark";
    } else {
      delete root.dataset.theme;
    }
    syncThemeColor(theme);
  }, [theme]);

  return (
    <div
      className={`${styles.shell} ${liveHud ? styles.shellHud : ""}`}
      data-app-chrome={boardMode ? "board" : "app"}
    >
      <a href="#main" className={styles.skip}>
        דלג לתוכן
      </a>
      {sandbox ? (
        <div className={styles.sandboxBanner} role="status">
          סביבת בדיקה · לא משפיע על דניאל (FLOFER)
        </div>
      ) : null}
      {demoMode && !boardMode ? (
        <div className={styles.demoBanner} role="status">
          מצב הדגמה פעיל
        </div>
      ) : null}
      {boardMode ? null : <PwaUpdateBanner />}
      {boardMode ? null : <OfflineBanner />}
      {boardMode ? null : <InstallCoach />}
      {boardMode || standalone ? null : (
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
          <NextStopHud />
          <BottomNav
            moreOpen={moreOpen}
            live={roundLive}
            onMore={() => setMoreOpen(true)}
          />
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
