import { useMemo, useState, type FormEvent } from "react";
import { loginRequest, type ApiError } from "../api/client";
import { BrandLockup } from "../components/ui/BrandLockup";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useToast } from "../components/ui/ToastProvider";
import { useAuthStore } from "../store/authStore";
import styles from "./LoginPage.module.css";

function prefillsUsername(): string {
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
  const initialUser = useMemo(() => prefillsUsername(), []);
  const [username, setUsername] = useState(initialUser);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginRequest(username.trim(), password);
      setSession(res.access_token, res.user);
    } catch (err) {
      const apiErr = err as ApiError;
      show(apiErr.message_he ?? "שם משתמש או סיסמה שגויים", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.aurora} aria-hidden />
      <Card className={styles.card}>
        <div className={styles.brandBlock}>
          <BrandLockup size="hero" stacked to={null} titleAs="h1" />
        </div>
        <p className={styles.subtitle}>ניהול סבב חכם לראשי צוות</p>
        <p className={styles.isoNote}>
          לכל ראש צוות חשבון נפרד — הסבבים, ההגדרות והדמו לא מסונכרנים עם טלפון
          אחר. היכנסו עם הפרטים שקיבלתם בלבד.
        </p>
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
            כניסה למערכת
          </Button>
        </form>
        <p className={styles.footnote}>גישה מאובטחת · חשבון אישי לכל משתמש</p>
      </Card>
    </main>
  );
}
