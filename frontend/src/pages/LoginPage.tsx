import { useEffect, useRef, useState, type FormEvent } from "react";
import { loginRequest, type ApiError } from "../api/client";
import { BrandLockup } from "../components/ui/BrandLockup";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useToast } from "../components/ui/ToastProvider";
import { readOnboarding, setOnboardingUser } from "../lib/onboarding";
import { readSavedLogin, writeSavedLogin } from "../lib/savedLogin";
import {
  isSandboxActive,
  markSandbox,
  SANDBOX_PASSWORD,
  SANDBOX_USERNAME,
} from "../lib/sandbox";
import { useAuthStore } from "../store/authStore";
import styles from "./LoginPage.module.css";

function usernameFromQuery(): string {
  try {
    const u = new URLSearchParams(window.location.search).get("user");
    if (u && /^[a-zA-Z0-9_]{2,32}$/.test(u)) return u;
  } catch {
    /* ignore */
  }
  return "";
}

export default function LoginPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const { show } = useToast();
  const sandbox = isSandboxActive();
  const saved = readSavedLogin();
  const queryUser = usernameFromQuery();

  const [username, setUsername] = useState(() => {
    if (sandbox) return queryUser || SANDBOX_USERNAME;
    return queryUser || "FLOFER";
  });
  const [password, setPassword] = useState(() => {
    // Pilot must type the code at least for first guided run.
    if (sandbox) return saved?.password || SANDBOX_PASSWORD;
    return "";
  });
  const [loading, setLoading] = useState(false);
  const autoTried = useRef(false);

  async function doLogin(user: string, pass: string) {
    setLoading(true);
    try {
      const res = await loginRequest(user.trim(), pass);
      if (sandbox) markSandbox(true);
      else markSandbox(false);
      setOnboardingUser(res.user.username);
      writeSavedLogin(user.trim(), pass);
      setSession(res.access_token, res.user);
    } catch (err) {
      const apiErr = err as ApiError;
      show(apiErr.message_he ?? "שם משתמש או סיסמה שגויים", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;

    // Sandbox only: skip typing. Pilot (Daniel) always types password once
    // unless they already finished onboarding on this device.
    if (sandbox) {
      markSandbox(true);
      const remembered = readSavedLogin();
      const user = remembered?.username || SANDBOX_USERNAME;
      const pass = remembered?.password || SANDBOX_PASSWORD;
      void doLogin(user, pass);
      return;
    }

    const remembered = readSavedLogin();
    if (!remembered) return;
    setOnboardingUser(remembered.username);
    const ob = readOnboarding(remembered.username);
    // Auto-login only after the guided tour was completed once.
    if (!ob.done) return;
    if (
      queryUser &&
      remembered.username.toLowerCase() !== queryUser.toLowerCase()
    ) {
      return;
    }
    void doLogin(remembered.username, remembered.password);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await doLogin(username, password);
  }

  return (
    <main className={styles.page}>
      <div className={styles.aurora} aria-hidden />
      <Card className={styles.card}>
        <div className={styles.brandBlock}>
          <BrandLockup size="hero" stacked to={null} titleAs="h1" />
        </div>
        <p className={styles.subtitle}>ניהול סבב חכם לראשי צוות</p>
        {sandbox ? (
          <p className={styles.sandboxNote}>
            סביבת בדיקה נפרדת — הסבבים וההגדרות כאן לא נוגעים בחשבון של דניאל
            (FLOFER).
          </p>
        ) : (
          <p className={styles.isoNote}>
            הזינו שם משתמש וסיסמה. בפעם הראשונה תעברו הדרכה מלאה. אחרי סיום
            ההדרכה הכניסה נשמרת במכשיר.
          </p>
        )}
        <form className={styles.form} onSubmit={onSubmit}>
          <Input
            label="שם משתמש"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <Input
            label="סיסמה"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" size="lg" loading={loading} className={styles.submit}>
            {sandbox ? "כניסה לבדיקות" : "כניסה למערכת"}
          </Button>
        </form>
        <p className={styles.footnote}>
          {sandbox
            ? "חשבון TEST · מבודד מ־FLOFER"
            : "כניסה אישית · הדרכה מלאה בפעם הראשונה"}
        </p>
      </Card>
    </main>
  );
}
