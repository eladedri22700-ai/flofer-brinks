import { useEffect, useMemo, useState } from "react";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import {
  isStandaloneDisplay,
  detectPlatform,
  readOnboarding,
} from "../../lib/onboarding";
import {
  installSheetShownToday,
  isInstallSnoozed,
  markInstallSheetDay,
  snoozeInstallPrompt,
} from "../../lib/installPrompt";
import { Button } from "../ui/Button";
import styles from "./InstallCoach.module.css";

export function InstallCoach() {
  const platform = useMemo(() => detectPlatform(), []);
  const { canPrompt, installed, promptInstall } = usePwaInstall();
  const standalone = installed || isStandaloneDisplay();
  const [sheet, setSheet] = useState(false);
  const [banner, setBanner] = useState(false);

  const onboardingDone = readOnboarding().done;

  useEffect(() => {
    if (standalone || !onboardingDone) {
      setBanner(false);
      setSheet(false);
      return;
    }
    if (!isInstallSnoozed()) setBanner(true);
    if (!installSheetShownToday()) {
      setSheet(true);
      markInstallSheetDay();
    }
  }, [standalone, onboardingDone]);

  if (standalone || !onboardingDone) return null;

  async function onInstallNow() {
    if (canPrompt) {
      const outcome = await promptInstall();
      if (outcome === "accepted") {
        setSheet(false);
        setBanner(false);
        return;
      }
    }
    setSheet(true);
  }

  function dismissAll() {
    snoozeInstallPrompt();
    setSheet(false);
    setBanner(false);
  }

  const howTo =
    platform === "ios"
      ? [
          "ליחצו על שיתוף □↑ בתחתית Safari",
          "גללו ובחרו «הוסף למסך הבית»",
          "ליחצו «הוסף» ופתחו את האייקון מהמסך הראשי",
        ]
      : platform === "android"
        ? [
            "בתפריט Chrome (⋮) בחרו «הוסף למסך הבית» / «התקן אפליקציה»",
            "אשרו «הוסף»",
            "פתחו את FLOFER BRINKS מהמסך הראשי — לא מהטאב בדפדפן",
          ]
        : [
            "בכרום: תפריט ⋮ → «התקן FLOFER BRINKS»",
            "או הוסיפו למסך הבית בטלפון לשימוש בשטח",
          ];

  return (
    <>
      {banner && !sheet ? (
        <div className={styles.banner} role="status">
          <p className={styles.bannerText}>
            התקינו למסך הבית — כמו אפליקציה, בלי שורת כתובת.
          </p>
          <div className={styles.bannerActions}>
            <button type="button" className={styles.bannerCta} onClick={() => void onInstallNow()}>
              התקן
            </button>
            <button type="button" className={styles.bannerDismiss} onClick={dismissAll}>
              אחר כך
            </button>
          </div>
        </div>
      ) : null}

      {sheet ? (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={() => setSheet(false)}
        >
          <div
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="install-title" className={styles.title}>
              התקנה למסך הבית
            </h2>
            <p className={styles.lead}>
              כך האפליקציה נפתחת במסך מלא, עם מיקום והתראות כמו אפליקציה רגילה —
              חובה לשימוש יומיומי בשטח.
            </p>
            <ol className={styles.steps}>
              {howTo.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
            <Button size="lg" onClick={() => void onInstallNow()}>
              {canPrompt ? "הוסף למסך הבית עכשיו" : "הצג הוראות שוב"}
            </Button>
            <Button variant="ghost" size="lg" onClick={dismissAll}>
              המשך בדפדפן (פחות מומלץ)
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
