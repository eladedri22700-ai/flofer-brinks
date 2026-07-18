import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error", error, info);
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (dsn) {
      // Optional Sentry — no-op without DSN
      void fetch(`${String(dsn).replace(/\/$/, "")}/api/envelope/`, {
        method: "POST",
        body: JSON.stringify({ message: error.message }),
      }).catch(() => undefined);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div dir="rtl" style={{ padding: 32, color: "#0d1c33", background: "#eef2f8", minHeight: "100vh" }}>
          <h1 style={{ fontFamily: '"Secular One", "Varela Round", sans-serif' }}>משהו השתבש</h1>
          <p>אירעה תקלה בממשק. רעננו את הדף או חזרו לתכנון.</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null });
              window.location.href = "/app/dashboard";
            }}
            style={{
              minHeight: 48,
              padding: "0 16px",
              background: "linear-gradient(135deg,#c9a84c,#a8862f)",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            חזרה לתכנון
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
