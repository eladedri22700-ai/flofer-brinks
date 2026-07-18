import { useMemo, useState } from "react";
import { BrandLockup } from "../components/ui/BrandLockup";
import { Button } from "../components/ui/Button";
import { usePwaInstall } from "../hooks/usePwaInstall";
import {
  detectPlatform,
  isStandaloneDisplay,
  markPermissionsDone,
  notificationsSupported,
  readOnboarding,
  writeOnboarding,
} from "../lib/onboarding";
import styles from "./OnboardingPage.module.css";

type Props = {
  /** Permissions done — start live demo tour inside the app */
  onStartTour: () => void;
};

type StepId = "install" | "location" | "notify" | "tour";

async function requestLocation(): Promise<boolean> {
  if (!("geolocation" in navigator)) return false;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  if (result === "granted") {
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg) {
        await reg.showNotification("FLOFER BRINKS", {
          body: "ההתראות מוכנות. תקבלו עדכונים חשובים בזמן הסבב.",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: "flofer-onboard",
        });
      } else {
        new Notification("FLOFER BRINKS", {
          body: "ההתראות מוכנות.",
          icon: "/icons/icon-192.png",
        });
      }
    } catch {
      /* permission granted even if demo notification fails */
    }
    return true;
  }
  return false;
}

export default function OnboardingPage({ onStartTour }: Props) {
  const platform = useMemo(() => detectPlatform(), []);
  const { canPrompt, installed, promptInstall } = usePwaInstall();
  const initial = readOnboarding();
  const standalone = installed || isStandaloneDisplay();

  const [step, setStep] = useState<StepId>(() => {
    if (!(initial.installSeen || standalone || installed)) return "install";
    if (initial.locationOk !== true) return "location";
    if (initial.notifyOk === null) return "notify";
    return "tour";
  });
  const [installSeen, setInstallSeen] = useState(
    initial.installSeen || standalone || installed,
  );
  const [locationOk, setLocationOk] = useState<boolean | null>(initial.locationOk);
  const [notifyOk, setNotifyOk] = useState<boolean | null>(initial.notifyOk);
  const [busy, setBusy] = useState<"install" | "loc" | "notify" | null>(null);
  const [iosSheet, setIosSheet] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  const steps: StepId[] = ["install", "location", "notify", "tour"];
  const stepIndex = steps.indexOf(step);

  function go(next: StepId) {
    setAnimKey((k) => k + 1);
    setStep(next);
  }

  async function onInstall() {
    setBusy("install");
    try {
      if (canPrompt) {
        const outcome = await promptInstall();
        if (outcome === "accepted" || standalone) {
          setInstallSeen(true);
          writeOnboarding({ installSeen: true });
          go("location");
          return;
        }
      }
      if (platform === "ios" || !canPrompt) {
        setIosSheet(true);
        setInstallSeen(true);
        writeOnboarding({ installSeen: true });
      } else {
        setInstallSeen(true);
        writeOnboarding({ installSeen: true });
        go("location");
      }
    } finally {
      setBusy(null);
    }
  }

  async function onLocation() {
    setBusy("loc");
    try {
      const ok = await requestLocation();
      setLocationOk(ok);
      writeOnboarding({ locationOk: ok });
      if (ok) go("notify");
    } finally {
      setBusy(null);
    }
  }

  async function onNotify() {
    setBusy("notify");
    try {
      const ok = await requestNotifications();
      setNotifyOk(ok);
      writeOnboarding({ notifyOk: ok });
      if (ok) go("tour");
    } finally {
      setBusy(null);
    }
  }

  function startLiveTour() {
    markPermissionsDone();
    onStartTour();
  }

  return (
    <div className={styles.page} dir="rtl">
      <div className={styles.aurora} aria-hidden />
      <div className={styles.inner}>
        <BrandLockup size="lg" stacked to={null} titleAs="h1" />

        <div className={styles.progress} aria-label="התקדמות הגדרה">
          {steps.map((id, i) => (
            <span
              key={id}
              className={i <= stepIndex ? styles.dotOn : styles.dot}
              aria-current={i === stepIndex ? "step" : undefined}
            />
          ))}
        </div>
        <p className={styles.stepMeta}>
          שלב {stepIndex + 1} מתוך {steps.length}
        </p>

        <div key={animKey} className={styles.panel}>
          {step === "install" ? (
            <>
              <h2 className={styles.panelTitle}>שמירה במסך הבית</h2>
              <p className={styles.panelDesc}>
                {platform === "ios"
                  ? "באייפון זה נפתח כמו אפליקציה אמיתית מ־Safari — בלי חנות."
                  : "הוסיפו את FLOFER BRINKS למסך הבית — אייקון מלא, בלי שורת דפדפן."}
              </p>
              {standalone || installSeen ? (
                <p className={`${styles.status} ${styles.statusOk}`}>
                  {standalone ? "כבר מותקן במסך הבית ✓" : "ההוראות נשמרו — אפשר להמשיך"}
                </p>
              ) : null}
              {!standalone ? (
                <Button size="lg" loading={busy === "install"} onClick={() => void onInstall()}>
                  {canPrompt ? "הוסף למסך הבית" : "הראה איך מוסיפים"}
                </Button>
              ) : null}
              {(installSeen || standalone) && (
                <Button
                  size="lg"
                  variant={standalone ? "primary" : "secondary"}
                  onClick={() => go("location")}
                >
                  המשך
                </Button>
              )}
            </>
          ) : null}

          {step === "location" ? (
            <>
              <h2 className={styles.panelTitle}>מיקום בזמן השימוש</h2>
              <p className={styles.panelDesc}>
                נדרש לניווט, התקרבות ליעד וצפי חזרה לסניף. בחרו «בעת שימוש באפליקציה».
              </p>
              {locationOk === true ? (
                <p className={`${styles.status} ${styles.statusOk}`}>מיקום אושר ✓</p>
              ) : (
                <>
                  <Button
                    size="lg"
                    variant={locationOk === false ? "secondary" : "primary"}
                    loading={busy === "loc"}
                    onClick={() => void onLocation()}
                  >
                    {locationOk === false ? "נסה שוב לאשר מיקום" : "אשר מיקום"}
                  </Button>
                  {locationOk === false ? (
                    <p className={`${styles.status} ${styles.statusWarn}`}>
                      המיקום נחסם. אפשר לאשר בהגדרות המכשיר → FLOFER BRINKS → מיקום.
                    </p>
                  ) : null}
                </>
              )}
              <div className={styles.row}>
                <Button size="md" variant="ghost" onClick={() => go("install")}>
                  חזרה
                </Button>
                <Button
                  size="md"
                  variant="secondary"
                  onClick={() => go("notify")}
                >
                  {locationOk === true ? "המשך" : "דלג לעת עתה"}
                </Button>
              </div>
            </>
          ) : null}

          {step === "notify" ? (
            <>
              <h2 className={styles.panelTitle}>התראות האפליקציה</h2>
              <p className={styles.panelDesc}>
                {notificationsSupported()
                  ? "באייפון עובד אחרי התקנה למסך הבית (iOS 16.4+). אפשר גם Telegram בהגדרות."
                  : "הדפדפן לא תומך בהתראות — השתמשו ב־Telegram מההגדרות."}
              </p>
              {!notificationsSupported() ? (
                <p className={`${styles.status} ${styles.statusMuted}`}>
                  התראות דפדפן לא זמינות כאן
                </p>
              ) : notifyOk === true ? (
                <p className={`${styles.status} ${styles.statusOk}`}>התראות אושרו ✓</p>
              ) : (
                <>
                  <Button
                    size="lg"
                    variant={notifyOk === false ? "secondary" : "primary"}
                    loading={busy === "notify"}
                    onClick={() => void onNotify()}
                  >
                    {notifyOk === false ? "נסה שוב לאשר התראות" : "אשר התראות"}
                  </Button>
                  {notifyOk === false ? (
                    <p className={`${styles.status} ${styles.statusWarn}`}>
                      ההתראות נחסמו. אפשר להפעיל בהגדרות המכשיר לאפליקציה.
                    </p>
                  ) : null}
                </>
              )}
              <div className={styles.row}>
                <Button size="md" variant="ghost" onClick={() => go("location")}>
                  חזרה
                </Button>
                <Button size="lg" onClick={() => go("tour")}>
                  המשך להדרכה חיה
                </Button>
              </div>
            </>
          ) : null}

          {step === "tour" ? (
            <>
              <h2 className={styles.panelTitle}>הדרכה חיה עם דמו</h2>
              <p className={styles.panelDesc}>
                נפעיל נתוני הדגמה ונעבור יחד על בית ← תכנון ← סדר ← מפה ← נסיעה.
                מה שמודגש בזהב — זה מה שחשוב בכל שלב. בסוף הדמו ייכבה ותהיו
                מוכנים למשמרת אמת מחר.
              </p>
              <Button size="lg" onClick={startLiveTour}>
                התחל הדרכה חיה
              </Button>
              <Button size="md" variant="ghost" onClick={() => go("notify")}>
                חזרה
              </Button>
            </>
          ) : null}
        </div>

        <p className={styles.hint}>
          ההגדרה וההדרכה מופיעות בהפעלה הראשונה. אחר כך תיכנסו ישר לאפליקציה.
        </p>
      </div>

      {iosSheet ? (
        <div
          className={styles.sheetOverlay}
          role="presentation"
          onClick={() => setIosSheet(false)}
        >
          <div
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label="הוספה למסך הבית"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.sheetTitle}>הוספה למסך הבית באייפון</h2>
            <ol className={styles.sheetList}>
              <li>
                ליחצו על כפתור השיתוף{" "}
                <span className={styles.shareIcon} aria-hidden>
                  □↑
                </span>{" "}
                בתחתית Safari
              </li>
              <li>
                גללו ובחרו <strong>«הוסף למסך הבית»</strong>
              </li>
              <li>
                ליחצו <strong>«הוסף»</strong> — ואז פתחו את האייקון מהמסך הראשי
              </li>
            </ol>
            <Button
              size="lg"
              onClick={() => {
                setIosSheet(false);
                go("location");
              }}
            >
              הבנתי — המשך
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
