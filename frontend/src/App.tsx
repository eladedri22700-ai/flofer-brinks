import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "./components/layout/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GuidedTour } from "./components/tour/GuidedTour";
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
const LegalPage = lazy(() => import("./pages/LegalPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));

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
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const [onboarding, setOnboarding] = useState(() => readOnboarding());

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <LoadingScreen full label="טוען" />;
  }

  if (!token) {
    return (
      <Suspense fallback={<LoadingScreen full label="טוען התחברות" />}>
        <LoginPage />
      </Suspense>
    );
  }

  const showPermissions = !onboarding.done && !onboarding.permissionsDone;
  const showTour = !onboarding.done && onboarding.permissionsDone;

  if (showPermissions) {
    return (
      <Suspense fallback={<LoadingScreen full label="טוען הדרכה" />}>
        <OnboardingPage
          onStartTour={() => setOnboarding(readOnboarding())}
        />
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
          <Route path="/app/legal" element={<LegalPage />} />
          <Route path="/app/board" element={<BoardPage />} />
        </Route>
        <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
      </Routes>
      {showTour ? (
        <GuidedTour
          active
          onFinished={() => setOnboarding(readOnboarding())}
        />
      ) : null}
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
