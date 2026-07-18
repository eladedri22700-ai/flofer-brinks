import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "./components/layout/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingScreen } from "./components/ui/LoadingScreen";
import { ToastProvider } from "./components/ui/ToastProvider";
import { readOnboarding } from "./lib/onboarding";
import { useAuthStore } from "./store/authStore";

const PlanPage = lazy(() => import("./pages/PlanPage"));
const RoutePage = lazy(() => import("./pages/RoutePage"));
const LivePage = lazy(() => import("./pages/LivePage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const SummaryPage = lazy(() => import("./pages/SummaryPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const BoardPage = lazy(() => import("./pages/BoardPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const [onboardingDone, setOnboardingDone] = useState(
    () => readOnboarding().done,
  );

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!onboardingDone) {
    return (
      <Suspense fallback={<LoadingScreen full label="טוען הדרכה" />}>
        <OnboardingPage onComplete={() => setOnboardingDone(true)} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen full label="טוען את FLOFER BRINKS" />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/app/plan" element={<PlanPage />} />
          <Route path="/app/route" element={<RoutePage />} />
          <Route path="/app/live" element={<LivePage />} />
          <Route path="/app/dashboard" element={<DashboardPage />} />
          <Route path="/app/history" element={<HistoryPage />} />
          <Route path="/app/summary/:routeId?" element={<SummaryPage />} />
          <Route path="/app/settings" element={<SettingsPage />} />
          <Route path="/app/board" element={<BoardPage />} />
        </Route>
        <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
