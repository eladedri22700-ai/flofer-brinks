import { useMemo, useState } from "react";
import { BrandLockup } from "../components/ui/BrandLockup";
import { Button } from "../components/ui/Button";
import { usePwaInstall } from "../hooks/usePwaInstall";
import {
  detectPlatform,
  isStandaloneDisplay,
  markOnboardingDone,
  notificationsSupported,
  readOnboarding,
  writeOnboarding,
} from "../lib/onboarding";
import styles from "./OnboardingPage.module.css";

type Props = {
  onComplete: () => void;
};

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

export default function OnboardingPage({ onComplete }: Props) {
  const platform = useMemo(() => detectPlatform(), []);
  const { canPrompt, installed, promptInstall } = usePwaInstall();
  const initial = readOnboarding();
  const [installSeen, setInstallSeen] = useState(
    initial.installSeen || isStandaloneDisplay() || installed,
  );
  const [locationOk, setLocationOk] = useState<boolean | null>(initial.locationOk);
  const [notifyOk, setNotifyOk] = useState<boolean | null>(initial.notifyOk);
  const [busy, setBusy] = useState<"install" | "loc" | "notify" | null>(null);
  const [iosSheet, setIosSheet] = useState(false);

  const standalone = installed || isStandaloneDisplay();

  async function onInstall() {
    setBusy("install");
    try {
      if (canPrompt) {
        const outcome = await promptInstall();
        if (outcome === "accepted" || standalone) {
          setInstallSeen(true);
          writeOnboarding({ installSeen: true });
          return;
        }
      }
      if (platform === "ios" || !canPrompt) {
        setIosSheet(true);
        setInstallSeen(true);
        writeOnboarding({ installSeen: true });
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
    } finally {
      setBusy(null);
    }
  }

  function finish() {
    markOnboardingDone();
    onComplete();
  }

  return (
    <div className={styles.page} dir="rtl">
      <div className={styles.aurora} aria-hidden />
      <div className={styles.inner}>
        <BrandLockup size="lg" stacked to={null} titleAs="h1" />
        <p className={styles.lead}>
          פעם אחת בלבד — התקינו למסך הבית, אשרו מיקום בזמן השימוש, והפעילו
          התראות. אחר כך תיכנסו ישר לאפליקציה.
        </p>

        <ol className={styles.steps}>
          <li className={styles.card}>
            <div className={styles.cardHead}>
              <span className={`${styles.num} ${installSeen || standalone ? styles.numDone : ""}`}>
                1
              </span>
              <div>
                <h2 className={styles.cardTitle}>שמירה במסך הבית</h2>
                <p className={styles.cardDesc}>
                  {platform === "ios"
                    ? "באייפון: הכפתור פותח הוראות קצרות להוספה למסך הבית (Safari)."
                    : "הוסיפו את FLOFER BRINKS כמו אפליקציה — בלי חנות."}
                </p>
              </div>
            </div>
            {standalone ? (
              <p className={`${styles.status} ${styles.statusOk}`}>כבר מותקן במסך הבית ✓</p>
            ) : (
              <Button
                size="lg"
                loading={busy === "install"}
                onClick={() => void onInstall()}
              >
                {canPrompt ? "הוסף למסך הבית" : "הוסף למסך הבית — הוראות"}
              </Button>
            )}
          </li>

          <li className={styles.card}>
            <div className={styles.cardHead}>
              <span
                className={`${styles.num} ${locationOk === true ? styles.numDone : ""}`}
              >
                2
              </span>
              <div>
                <h2 className={styles.cardTitle}>מיקום בזמן השימוש</h2>
                <p className={styles.cardDesc}>
                  נדרש לניווט, התקרבות ליעד וצפי חזרה לסניף. בחרו «בעת שימוש
                  באפליקציה».
                </p>
              </div>
            </div>
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
                    המיקום נחסם. אפשר לאשר בהגדרות האייפון → Safari / FLOFER BRINKS →
                    מיקום.
                  </p>
                ) : null}
              </>
            )}
          </li>

          <li className={styles.card}>
            <div className={styles.cardHead}>
              <span
                className={`${styles.num} ${notifyOk === true ? styles.numDone : ""}`}
              >
                3
              </span>
              <div>
                <h2 className={styles.cardTitle}>התראות האפליקציה</h2>
                <p className={styles.cardDesc}>
                  {notificationsSupported()
                    ? "באייפון עובד אחרי התקנה למסך הבית (iOS 16.4+). אפשר גם Telegram בהגדרות."
                    : "הדפדפן לא תומך בהתראות — השתמשו ב־Telegram מההגדרות."}
                </p>
              </div>
            </div>
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
          </li>
        </ol>

        <div className={styles.footer}>
          <Button size="lg" onClick={finish}>
            כניסה לאפליקציה
          </Button>
          <p className={styles.hint}>
            המסך הזה לא יופיע שוב במכשיר הזה. אפשר לשנות הרשאות בכל רגע בהגדרות
            האייפון.
          </p>
        </div>
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
            <Button size="lg" onClick={() => setIosSheet(false)}>
              הבנתי
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
