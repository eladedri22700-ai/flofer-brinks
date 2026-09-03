import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPrefs } from "../../api/live";
import { getTodayRoute, reorderManual } from "../../api/planning";
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
import { StopDetailSheet } from "../overlays/StopDetailSheet";
import { FullRoundSheet } from "../overlays/FullRoundSheet";
import { isStandaloneDisplay } from "../../lib/onboarding";
import { syncThemeColor } from "../../lib/standalone";
import { useChromeStore } from "../../store/chromeStore";
import styles from "./AppLayout.module.css";

const IMMERSIVE_PREFIXES = ["/app/board", "/app/route", "/app/hours", "/app/add-stop", "/app/start"];

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [moreOpen, setMoreOpen] = useState(false);
  const prefsQ = useQuery({ queryKey: ["prefs"], queryFn: getPrefs });
  const routeQ = useQuery({ queryKey: ["route-today"], queryFn: getTodayRoute });
  const setAsNextM = useMutation({
    mutationFn: async (stopId: number) => {
      const route = routeQ.data;
      if (!route) return;
      const stops = sortedStops(route);
      const doneIds = stops.filter((s) => s.status === "done" || s.status === "skipped").map((s) => s.id);
      const restIds = stops
        .filter((s) => s.status !== "done" && s.status !== "skipped" && s.id !== stopId)
        .map((s) => s.id);
      await reorderManual(route.id, [...doneIds, stopId, ...restIds]);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["route-today"] });
      nav("/app/live");
    },
  });
  const drivingLocked = useChromeStore((s) => s.drivingLocked);
  const userName = user?.full_name ?? "ראש צוות";
  const demoMode = Boolean(prefsQ.data?.demo_mode);
  const sandbox = isSandboxUser(user?.username);
  const theme = prefsQ.data?.theme;
  const pathImmersive = IMMERSIVE_PREFIXES.some((p) => location.pathname.startsWith(p));
  const boardMode = pathImmersive || (location.pathname.startsWith("/app/live") && drivingLocked);
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
      <StopDetailSheet route={routeQ.data} onSetAsNext={(id) => setAsNextM.mutate(id)} />
      <FullRoundSheet route={routeQ.data} />
    </div>
  );
}
