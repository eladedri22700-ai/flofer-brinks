import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getPrefs, putPrefs } from "../api/live";
import { disableDemo, enableDemo } from "../api/phase5";
import { resetTourForReplay, setOnboardingUser } from "../lib/onboarding";
import { useAuthStore } from "../store/authStore";
import {
  getDepot,
  getKeysStatus,
  putDepot,
  putKeys,
  testTelegram,
} from "../api/planning";
import { apiErrorMessage } from "../api/errors";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useToast } from "../components/ui/ToastProvider";
import { copyrightLine } from "../lib/legal";
import styles from "./SettingsPage.module.css";
import { useEffect, useState, type FormEvent } from "react";

export default function SettingsPage() {
  const { show } = useToast();
  const qc = useQueryClient();
  const statusQ = useQuery({ queryKey: ["keys-status"], queryFn: getKeysStatus });
  const prefsQ = useQuery({ queryKey: ["prefs"], queryFn: getPrefs });
  const depotQ = useQuery({ queryKey: ["depot"], queryFn: getDepot });
  const [serverKey, setServerKey] = useState("");
  const [browserKey, setBrowserKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [sosPhone, setSosPhone] = useState("");
  const [geofence, setGeofence] = useState("150");
  const [depotName, setDepotName] = useState("");
  const [depotAddress, setDepotAddress] = useState("");
  const [depotLat, setDepotLat] = useState("");
  const [depotLng, setDepotLng] = useState("");

  useEffect(() => {
    if (prefsQ.data) {
      setSosPhone(prefsQ.data.sos_phone ?? "");
      setGeofence(String(prefsQ.data.geofence_radius_m));
      setTelegramChatId(prefsQ.data.telegram_chat_id ?? "");
      setTelegramEnabled(Boolean(prefsQ.data.telegram_enabled));
    }
  }, [prefsQ.data]);

  useEffect(() => {
    if (depotQ.data) {
      setDepotName(depotQ.data.name);
      setDepotAddress(depotQ.data.address);
      setDepotLat(String(depotQ.data.lat));
      setDepotLng(String(depotQ.data.lng));
    }
  }, [depotQ.data]);

  const theme = prefsQ.data?.theme ?? "light";

  const saveM = useMutation({
    mutationFn: () =>
      putKeys({
        google_maps_server_key: serverKey || undefined,
        google_maps_browser_key: browserKey || undefined,
        anthropic_api_key: anthropicKey || undefined,
        telegram_bot_token: telegramToken || undefined,
      }),
    onSuccess: () => {
      show("המפתחות נשמרו בהצלחה", "success");
      setServerKey("");
      setBrowserKey("");
      setAnthropicKey("");
      setTelegramToken("");
      void qc.invalidateQueries({ queryKey: ["keys-status"] });
      void qc.invalidateQueries({ queryKey: ["public-config"] });
    },
    onError: (err) => {
      show(apiErrorMessage(err, "שמירה נכשלה"), "error");
    },
  });

  const prefsM = useMutation({
    mutationFn: () =>
      putPrefs({
        sos_phone: sosPhone || null,
        geofence_radius_m: Number(geofence) || 150,
        telegram_chat_id: telegramChatId.trim() || null,
        telegram_enabled: telegramEnabled,
      }),
    onSuccess: () => {
      show("ההעדפות נשמרו", "success");
      void qc.invalidateQueries({ queryKey: ["prefs"] });
    },
    onError: (err) => show(apiErrorMessage(err), "error"),
  });

  const telegramM = useMutation({
    mutationFn: () =>
      putPrefs({
        telegram_chat_id: telegramChatId.trim() || null,
        telegram_enabled: telegramEnabled,
      }),
    onSuccess: () => {
      show("הגדרות Telegram נשמרו", "success");
      void qc.invalidateQueries({ queryKey: ["prefs"] });
      void qc.invalidateQueries({ queryKey: ["keys-status"] });
    },
    onError: (err) => show(apiErrorMessage(err), "error"),
  });

  const telegramTestM = useMutation({
    mutationFn: async () => {
      await putPrefs({
        telegram_chat_id: telegramChatId.trim() || null,
        telegram_enabled: telegramEnabled,
      });
      return testTelegram();
    },
    onSuccess: (res) => {
      show(res.message_he, res.ok ? "success" : "error");
      void qc.invalidateQueries({ queryKey: ["prefs"] });
      void qc.invalidateQueries({ queryKey: ["keys-status"] });
    },
    onError: (err) => show(apiErrorMessage(err), "error"),
  });

  const geoM = useMutation({
    mutationFn: () =>
      putDepot({ name: depotName, address: depotAddress, lat: null, lng: null }),
    onSuccess: (d) => {
      setDepotLat(String(d.lat));
      setDepotLng(String(d.lng));
      show("הכתובת אותרה על המפה", "success");
      void qc.invalidateQueries({ queryKey: ["depot"] });
    },
    onError: (e) => show(apiErrorMessage(e, "לא הצלחנו לאתר את הכתובת"), "error"),
  });

  const depotM = useMutation({
    mutationFn: () =>
      putDepot({
        name: depotName,
        address: depotAddress,
        lat: depotLat.trim() ? Number(depotLat) : null,
        lng: depotLng.trim() ? Number(depotLng) : null,
      }),
    onSuccess: () => {
      show("נקודת ההתחלה והסיום נשמרה", "success");
      void qc.invalidateQueries({ queryKey: ["depot"] });
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const themeM = useMutation({
    mutationFn: (next: "light" | "dark") => putPrefs({ theme: next }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["prefs"] });
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  const demoOn = useMutation({
    mutationFn: enableDemo,
    onSuccess: () => {
      show("מצב הדגמה הופעל", "success");
      void qc.invalidateQueries();
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });
  const demoOff = useMutation({
    mutationFn: disableDemo,
    onSuccess: () => {
      show("מצב הדגמה כובה", "success");
      void qc.invalidateQueries();
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveM.mutate();
  }

  if (statusQ.isLoading) {
    return <LoadingScreen label="טוען הגדרות" />;
  }

  const status = statusQ.data;

  return (
    <div className={`pageShell ${styles.page}`}>
      <PageHeader
        kicker="מערכת"
        title="הגדרות"
        lead="מפתחות API, SOS, ומצב הדגמה — לא נדרש ביום-יום בשטח."
      />
      <p className={styles.lead}>
        בלי מפתחות האפליקציה רצה במצב הדגמה (כתובות מדומות וחילוץ OCR מדומה).
        כשתהיו מוכנים — הדביקו כאן מפתחות מ-Google Cloud ו-Anthropic. מפתחות השרת
        נשמרים רק בשרת ולא מוצגים שוב אחרי השמירה.
      </p>

      <Card data-tour="settings-depot">
        <h2 className={styles.h2}>נקודת התחלה וסיום (משרדי ברינקס)</h2>
        <p className={styles.lead}>
          כל סבב יוצא מהנקודה הזו וחוזר אליה. המערכת מתכננת את הסדר היעיל ביותר
          כך שהחזרה למשרד תהיה מוקדמת ככל האפשר. הזינו כתובת ולחצו «אתר», או הזינו
          קואורדינטות ידנית.
        </p>
        <Input
          label="שם הנקודה"
          value={depotName}
          onChange={(e) => setDepotName(e.target.value)}
          placeholder="משרדי ברינקס"
        />
        <Input
          label="כתובת המשרד"
          value={depotAddress}
          onChange={(e) => setDepotAddress(e.target.value)}
          placeholder="לדוגמה: המסגר 14, תל אביב"
        />
        <Button
          variant="secondary"
          loading={geoM.isPending}
          disabled={!depotAddress.trim()}
          onClick={() => geoM.mutate()}
        >
          אתר את הכתובת על המפה
        </Button>
        <div className={styles.coordRow}>
          <Input
            label="קו רוחב (lat)"
            type="number"
            value={depotLat}
            onChange={(e) => setDepotLat(e.target.value)}
          />
          <Input
            label="קו אורך (lng)"
            type="number"
            value={depotLng}
            onChange={(e) => setDepotLng(e.target.value)}
          />
        </div>
        <Button size="lg" loading={depotM.isPending} onClick={() => depotM.mutate()}>
          שמור נקודת התחלה וסיום
        </Button>
      </Card>

      <Card className={styles.statusCard}>
        <h2 className={styles.h2}>סטטוס נוכחי</h2>
        <ul className={styles.statusList}>
          <li className={styles.statusItem}>
            <span className={styles.statusKey}>Google Server</span>
            <span className={`${styles.chip} ${status?.google_server ? styles.ok : styles.warn}`}>
              {status?.google_server ? "מוגדר" : "חסר"}
            </span>
            <span className={`${styles.chip} ${status?.maps_mode === "live" ? styles.ok : styles.demo}`}>
              מפות: {status?.maps_mode === "live" ? "חי" : "הדגמה"}
            </span>
          </li>
          <li className={styles.statusItem}>
            <span className={styles.statusKey}>Google Browser</span>
            <span className={`${styles.chip} ${status?.google_browser ? styles.ok : styles.warn}`}>
              {status?.google_browser ? "מוגדר" : "חסר"}
            </span>
          </li>
          <li className={styles.statusItem}>
            <span className={styles.statusKey}>Anthropic OCR</span>
            <span className={`${styles.chip} ${status?.anthropic ? styles.ok : styles.warn}`}>
              {status?.anthropic ? "מוגדר" : "חסר"}
            </span>
            <span className={`${styles.chip} ${status?.ocr_mode === "live" ? styles.ok : styles.demo}`}>
              מצב: {status?.ocr_mode === "live" ? "חי" : "הדגמה"}
            </span>
          </li>
          <li className={styles.statusItem}>
            <span className={styles.statusKey}>Telegram</span>
            <span className={`${styles.chip} ${status?.telegram ? styles.ok : styles.warn}`}>
              {status?.telegram ? "בוט מוגדר" : "חסר"}
            </span>
            <span
              className={`${styles.chip} ${status?.telegram_mode === "live" ? styles.ok : styles.demo}`}
            >
              מצב: {status?.telegram_mode === "live" ? "חי" : "כבוי"}
            </span>
          </li>
        </ul>
      </Card>

      <Card>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.help}>
            <p>
              <strong>GOOGLE_MAPS_SERVER_KEY</strong> — ל-Routes/Geocoding/Places
              בשרת. ב-GCP: הפעילו APIs והגבילו ל-IP/API.
            </p>
            <p>
              <strong>GOOGLE_MAPS_BROWSER_KEY</strong> — למיני-מפה בדפדפן בלבד.
              חובה להגביל ל-HTTP referrer + Maps JavaScript API.
            </p>
            <p>
              <strong>ANTHROPIC_API_KEY</strong> — לחילוץ כתובות מצילום Zebra
              (Claude Vision).
            </p>
            <p>
              <strong>TELEGRAM_BOT_TOKEN</strong> — בוט להתראות שטח (התקרבות,
              הגעה, עיכוב, סיכום).
            </p>
          </div>
          <Input
            label="Google Server Key"
            type="password"
            autoComplete="off"
            value={serverKey}
            onChange={(e) => setServerKey(e.target.value)}
            placeholder={status?.google_server ? "•••••• (השאירו ריק כדי לא לשנות)" : ""}
          />
          <Input
            label="Google Browser Key"
            type="password"
            autoComplete="off"
            value={browserKey}
            onChange={(e) => setBrowserKey(e.target.value)}
          />
          <Input
            label="Anthropic API Key"
            type="password"
            autoComplete="off"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
          />
          <Input
            label="Telegram Bot Token"
            type="password"
            autoComplete="off"
            value={telegramToken}
            onChange={(e) => setTelegramToken(e.target.value)}
            placeholder={status?.telegram ? "•••••• (השאירו ריק כדי לא לשנות)" : ""}
          />
          <Button type="submit" size="lg" loading={saveM.isPending}>
            שמור מפתחות
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className={styles.h2}>התראות Telegram</h2>
        <ol className={styles.steps}>
          <li>בטלגרם פתחו את @BotFather וצרו בוט חדש — העתיקו את הטוקן לשדה למעלה ושמרו מפתחות.</li>
          <li>פתחו את הבוט החדש ולחצו Start.</li>
          <li>גלו את ה־Chat ID שלכם (למשל דרך @userinfobot) והדביקו למטה.</li>
          <li>שמרו, הפעילו התראות, ולחצו «שלח הודעת בדיקה».</li>
        </ol>
        <Input
          label="Telegram Chat ID"
          value={telegramChatId}
          onChange={(e) => setTelegramChatId(e.target.value)}
          placeholder="לדוגמה: 123456789"
        />
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={telegramEnabled}
            onChange={(e) => setTelegramEnabled(e.target.checked)}
          />
          הפעל התראות Telegram בנסיעה
        </label>
        <div className={styles.btnRow}>
          <Button size="lg" loading={telegramM.isPending} onClick={() => telegramM.mutate()}>
            שמור Telegram
          </Button>
          <Button
            size="lg"
            variant="secondary"
            loading={telegramTestM.isPending}
            onClick={() => telegramTestM.mutate()}
          >
            שלח הודעת בדיקה
          </Button>
        </div>
      </Card>

      <Card data-tour="settings-drive">
        <h2 className={styles.h2}>נסיעה ו־SOS</h2>
        <p className={styles.lead}>
          מספר מוקד לבקרת SOS (חיוג בלבד) ורדיוס גיאופנס במטרים. שעון העבודה הוא
          כלי מעקב ותצוגה — לא מערכת שכר רשמית.
        </p>
        <Input
          label="מספר SOS"
          type="tel"
          value={sosPhone}
          onChange={(e) => setSosPhone(e.target.value)}
          placeholder="050-0000000"
        />
        <Input
          label="רדיוס גיאופנס (מ')"
          type="number"
          value={geofence}
          onChange={(e) => setGeofence(e.target.value)}
        />
        <Button
          size="lg"
          loading={prefsM.isPending}
          onClick={() => prefsM.mutate()}
        >
          שמור העדפות נסיעה
        </Button>
      </Card>

      <Card data-tour="settings-theme">
        <h2 className={styles.h2}>מראה התצוגה · יום / לילה</h2>
        <p className={styles.lead}>
          ברירת המחדל בהירה. בחרו כהה לנסיעת לילה — נשמר בחשבון שלכם בלבד.
        </p>
        <div className={styles.themeRow}>
          <Button
            onClick={() => themeM.mutate("light")}
            variant={theme === "light" ? "primary" : "secondary"}
            loading={themeM.isPending && themeM.variables === "light"}
          >
            יום · בהיר
          </Button>
          <Button
            onClick={() => themeM.mutate("dark")}
            variant={theme === "dark" ? "primary" : "secondary"}
            loading={themeM.isPending && themeM.variables === "dark"}
          >
            לילה · כהה
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className={styles.h2}>מצב הדגמה</h2>
        <p className={styles.lead}>
          מזרים מסלול דמו מבודד (18 לקוחות, היסטוריה ותגיות נלמדות) — לא מתערבב
          עם נתוני אמת. כשפעיל מופיע באנר «מצב הדגמה» בראש המסך.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <Button
            loading={demoOn.isPending}
            onClick={() => demoOn.mutate()}
            disabled={prefsQ.data?.demo_mode}
          >
            הפעל הדגמה
          </Button>
          <Button
            variant="secondary"
            loading={demoOff.isPending}
            onClick={() => demoOff.mutate()}
            disabled={!prefsQ.data?.demo_mode}
          >
            כבה והסר דמו
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className={styles.h2}>הדרכה חיה</h2>
        <p className={styles.lead}>
          מפעילים שוב את מדריך ההפעלה הראשונה עם נתוני דמו. בסיום חוזרים למצב
          אמת.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            const u = useAuthStore.getState().user?.username;
            if (u) setOnboardingUser(u);
            resetTourForReplay();
            window.location.assign("/app/dashboard");
          }}
        >
          הפעל הדרכה מחדש
        </Button>
      </Card>

      <Card>
        <h2 className={styles.h2}>זכויות יוצרים</h2>
        <p className={styles.lead}>{copyrightLine()}</p>
        <p className={styles.lead}>
          אין להעתיק או להפיץ את המוצר בלי אישור. פירוט מלא בתנאי השימוש.
        </p>
        <Link to="/app/legal" className={styles.legalLink}>
          לתנאי שימוש וזכויות יוצרים
        </Link>
      </Card>
    </div>
  );
}
