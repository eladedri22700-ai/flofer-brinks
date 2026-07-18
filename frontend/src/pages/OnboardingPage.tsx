import { useMemo, useState } from "react";
import { BrandLockup } from "../components/ui/BrandLockup";
import { Button } from "../components/ui/Button";
import { usePwaInstall } from "../hooks/usePwaInstall";
import {
  detectPlatform,
  isStandaloneDisplay,
  markPermissionsDone,
  readOnboarding,
  writeOnboarding,
} from "../lib/onboarding";
import {
  notificationsSupported,
  requestLocationAccess,
  requestNotificationAccess,
  requestWakeLockSample,
} from "../lib/permissions";
import styles from "./OnboardingPage.module.css";

type Props = {
  onStartTour: () => void;
};

type StepId = "install" | "location" | "background" | "notify" | "tour";

function backgroundBullets(platform: "ios" | "android" | "desktop"): string[] {
  if (platform === "ios") {
    return [
      "הגדרות → FLOFER BRINKS → מיקום → «תמיד» (או לפחות בזמן שימוש)",
      "הגדרות → כללי → רענון ברקע → הפעילו ל־FLOFER BRINKS",
      "אל תסגרו את האפליקציה מהחלון התחתון באמצע סבב",
      "בזמן נסיעה המסך יישאר דולק (Wake Lock) כדי שה־GPS לא ייעצר",
    ];
  }
  if (platform === "android") {
    return [
      "הגדרות → אפליקציות → FLOFER BRINKS → הרשאות → מיקום → «אפשר תמיד»",
      "באותו מסך: השתמשו במיקום מדויק (Precise)",
      "סוללה → ללא הגבלות / לא מייעלים את האפליקציה הזו",
      "בזמן נסיעה המסך יישאר דולק כדי לעדכן מיקום בזמן אמת",
    ];
  }
  return [
    "אשרו מיקום מדויק בדפדפן",
    "השאירו את החלון פתוח בזמן סבב",
    "בטלפון בשטח — התקינו למסך הבית לחוויית אפליקציה מלאה",
  ];
}

export default function OnboardingPage({ onStartTour }: Props) {
  const platform = useMemo(() => detectPlatform(), []);
  const { canPrompt, installed, promptInstall } = usePwaInstall();
  const initial = readOnboarding();
  const standalone = installed || isStandaloneDisplay();

  const [step, setStep] = useState<StepId>(() => {
    if (!(initial.installSeen || standalone || installed)) return "install";
    if (initial.locationOk !== true) return "location";
    if (initial.backgroundOk !== true) return "background";
    if (initial.notifyOk === null) return "notify";
    return "tour";
  });
  const [installSeen, setInstallSeen] = useState(
    initial.installSeen || standalone || installed,
  );
  const [locationOk, setLocationOk] = useState<boolean | null>(initial.locationOk);
  const [backgroundOk, setBackgroundOk] = useState<boolean | null>(
    initial.backgroundOk,
  );
  const [wakeLockOk, setWakeLockOk] = useState<boolean | null>(initial.wakeLockOk);
  const [notifyOk, setNotifyOk] = useState<boolean | null>(initial.notifyOk);
  const [busy, setBusy] = useState<"install" | "loc" | "bg" | "notify" | null>(
    null,
  );
  const [iosSheet, setIosSheet] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [locTried, setLocTried] = useState(initial.locationOk !== null);

  const steps: StepId[] = ["install", "location", "background", "notify", "tour"];
  const stepIndex = steps.indexOf(step);
  const bgTips = backgroundBullets(platform);

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
      const ok = await requestLocationAccess();
      setLocTried(true);
      setLocationOk(ok);
      writeOnboarding({ locationOk: ok });
      if (ok) go("background");
    } finally {
      setBusy(null);
    }
  }

  async function onBackground() {
    setBusy("bg");
    try {
      const wake = await requestWakeLockSample();
      setWakeLockOk(wake);
      setBackgroundOk(true);
      writeOnboarding({ backgroundOk: true, wakeLockOk: wake });
      go("notify");
    } finally {
      setBusy(null);
    }
  }

  async function onNotify() {
    setBusy("notify");
    try {
      const ok = await requestNotificationAccess();
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
          שלב {stepIndex + 1} מתוך {steps.length} · הרשאות לשטח
        </p>

        <div key={animKey} className={styles.panel}>
          {step === "install" ? (
            <>
              <h2 className={styles.panelTitle}>שמירה במסך הבית</h2>
              <p className={styles.panelDesc}>
                {platform === "ios"
                  ? "באייפון זה חייב להיות מהמסך הבית (לא מטאב Safari) — אחרת מיקום ברקע והתראות מוגבלים."
                  : "הוסיפו למסך הבית כאפליקציה — כך אפשר לאשר מיקום «תמיד» והתראות כמו באפליקציה רגילה."}
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
                  המשך לאישור מיקום
                </Button>
              )}
            </>
          ) : null}

          {step === "location" ? (
            <>
              <h2 className={styles.panelTitle}>מיקום מדויק בזמן אמת</h2>
              <p className={styles.panelDesc}>
                בלי זה אין ניווט, זיהוי הגעה ליעד, או עדכון חזרה לסניף. לחצו למטה
                ואשרו <strong>מיקום מדויק</strong> / «בעת השימוש באפליקציה».
              </p>
              <ul className={styles.tips}>
                <li>נדרש GPS פעיל (לא רק רשת)</li>
                <li>בחלון המערכת — בחרו לאפשר, לא «רק הפעם» אם אפשר</li>
                <li>נבדוק גם מעקב קצר כדי לוודא שהמיקום חי</li>
              </ul>
              {locationOk === true ? (
                <p className={`${styles.status} ${styles.statusOk}`}>
                  מיקום אושר ונבדק ✓
                </p>
              ) : (
                <>
                  <Button
                    size="lg"
                    variant={locationOk === false ? "secondary" : "primary"}
                    loading={busy === "loc"}
                    onClick={() => void onLocation()}
                  >
                    {locationOk === false
                      ? "נסה שוב — אשר מיקום מדויק"
                      : "אשר מיקום מדויק עכשיו"}
                  </Button>
                  {locationOk === false ? (
                    <p className={`${styles.status} ${styles.statusWarn}`}>
                      נחסם. פתחו הגדרות המכשיר → FLOFER BRINKS → מיקום → אפשר
                      (מדויק), ואז לחצו שוב כאן.
                    </p>
                  ) : null}
                </>
              )}
              <div className={styles.row}>
                <Button size="md" variant="ghost" onClick={() => go("install")}>
                  חזרה
                </Button>
                {locationOk === true ? (
                  <Button size="lg" onClick={() => go("background")}>
                    המשך
                  </Button>
                ) : (
                  <Button
                    size="md"
                    variant="secondary"
                    disabled={!locTried}
                    onClick={() => go("background")}
                  >
                    דלג (לא מומלץ)
                  </Button>
                )}
              </div>
            </>
          ) : null}

          {step === "background" ? (
            <>
              <h2 className={styles.panelTitle}>מיקום כשהמסך כבוי / ברקע</h2>
              <p className={styles.panelDesc}>
                בסבב אמיתי המיקום חייב להמשיך לרוץ גם כשהמסך נעול או כשעוברים
                לוויז. בדפדפן יש מגבלות — לכן חשוב להגדיר במכשיר:
              </p>
              <ul className={styles.tips}>
                {bgTips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              {wakeLockOk === true ? (
                <p className={`${styles.status} ${styles.statusOk}`}>
                  נעילת מסך (Wake Lock) זמינה ✓ — תופעל אוטומטית בנסיעה
                </p>
              ) : wakeLockOk === false ? (
                <p className={`${styles.status} ${styles.statusMuted}`}>
                  Wake Lock לא זמין כאן — השאירו את המסך דולק בזמן סבב
                </p>
              ) : null}
              <Button
                size="lg"
                loading={busy === "bg"}
                onClick={() => void onBackground()}
              >
                הפעל שמירת מסך דולק ואשר שהבנתי
              </Button>
              <div className={styles.row}>
                <Button size="md" variant="ghost" onClick={() => go("location")}>
                  חזרה
                </Button>
                {backgroundOk ? (
                  <Button size="md" variant="secondary" onClick={() => go("notify")}>
                    המשך להתראות
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}

          {step === "notify" ? (
            <>
              <h2 className={styles.panelTitle}>התראות (פושים)</h2>
              <p className={styles.panelDesc}>
                {notificationsSupported()
                  ? "אשרו התראות מהמערכת — תקבלו עדכונים על התקרבות ליעד, עיכובים וסיכום. באייפון זה עובד אחרי התקנה למסך הבית (iOS 16.4+)."
                  : "הדפדפן לא תומך בהתראות כאן — הגדירו Telegram בהגדרות כגיבוי."}
              </p>
              <ul className={styles.tips}>
                <li>אחרי האישור תישלח התראת בדיקה קצרה</li>
                <li>אל תחסמו את FLOFER BRINKS בהגדרות ההתראות של המכשיר</li>
                <li>אפשר גם Telegram מההגדרות כגיבוי בשטח</li>
              </ul>
              {!notificationsSupported() ? (
                <p className={`${styles.status} ${styles.statusMuted}`}>
                  התראות דפדפן לא זמינות — המשיכו ותגדירו Telegram אחר כך
                </p>
              ) : notifyOk === true ? (
                <p className={`${styles.status} ${styles.statusOk}`}>
                  התראות אושרו ✓ (נשלחה בדיקה)
                </p>
              ) : (
                <>
                  <Button
                    size="lg"
                    variant={notifyOk === false ? "secondary" : "primary"}
                    loading={busy === "notify"}
                    onClick={() => void onNotify()}
                  >
                    {notifyOk === false
                      ? "נסה שוב לאשר התראות"
                      : "אשר התראות פוש עכשיו"}
                  </Button>
                  {notifyOk === false ? (
                    <p className={`${styles.status} ${styles.statusWarn}`}>
                      נחסם. הגדרות המכשיר → FLOFER BRINKS → התראות → הפעלה.
                    </p>
                  ) : null}
                </>
              )}
              <div className={styles.row}>
                <Button size="md" variant="ghost" onClick={() => go("background")}>
                  חזרה
                </Button>
                <Button
                  size="lg"
                  onClick={() => go("tour")}
                  variant={notifyOk === true ? "primary" : "secondary"}
                >
                  {notifyOk === true ? "המשך להדרכה חיה" : "המשך בלי התראות"}
                </Button>
              </div>
            </>
          ) : null}

          {step === "tour" ? (
            <>
              <h2 className={styles.panelTitle}>מוכנים להדרכה חיה</h2>
              <p className={styles.panelDesc}>
                ההרשאות הוגדרו. עכשיו נתרגל יחד עם דמו: הוספת כתובות, VIP, צילום,
                חישוב מסלול ונעילה — ואז תעברו למצב אמת.
              </p>
              <ul className={styles.checklist}>
                <li className={locationOk ? styles.checkOk : styles.checkWarn}>
                  מיקום {locationOk ? "✓" : "— לא אושר"}
                </li>
                <li className={backgroundOk ? styles.checkOk : styles.checkWarn}>
                  רקע / מסך {backgroundOk ? "✓" : "—"}
                </li>
                <li className={notifyOk ? styles.checkOk : styles.checkWarn}>
                  התראות {notifyOk ? "✓" : "— לא אושרו"}
                </li>
              </ul>
              <Button size="lg" onClick={startLiveTour}>
                התחל הדרכה חיה עם דמו
              </Button>
              <Button size="md" variant="ghost" onClick={() => go("notify")}>
                חזרה
              </Button>
            </>
          ) : null}
        </div>

        <p className={styles.hint}>
          בלי מיקום והתראות החוויה בשטח חלקית. אפשר לתקן תמיד בהגדרות המכשיר.
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
                (משם מאשרים מיקום והתראות)
              </li>
            </ol>
            <Button
              size="lg"
              onClick={() => {
                setIosSheet(false);
                go("location");
              }}
            >
              הבנתי — המשך למיקום
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
