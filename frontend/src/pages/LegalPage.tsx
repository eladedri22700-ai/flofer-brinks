import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { copyrightLine, PRODUCT_NAME } from "../lib/legal";
import styles from "./LegalPage.module.css";

export default function LegalPage() {
  return (
    <div className={`pageShell ${styles.page}`} dir="rtl">
      <PageHeader
        kicker="משפטי"
        title="זכויות יוצרים ותנאי שימוש"
        lead="שימוש באפליקציה מהווה הסכמה לתנאים הקצרים שלהלן."
      />

      <Card className={styles.notice} statusBar="gold">
        <p className={styles.copyright}>{copyrightLine()}</p>
        <p className={styles.meta}>
          {PRODUCT_NAME} הוא מוצר תוכנה מוגן. אין להעתיק, לשכפל, להפיץ או
          למכור את הקוד, העיצוב, המותג או הנתונים בלי אישור בכתב מבעלי הזכויות.
        </p>
      </Card>

      <Card>
        <h2 className={styles.h2}>1. בעלות</h2>
        <p className={styles.p}>
          כל הזכויות בקוד, בממשק, בלוגו, בשם המותג, באלגוריתמים לתכנון מסלול
          ובמסמכי המוצר שייכות לבעלי {PRODUCT_NAME}, אלא אם צוין אחרת במפורש.
        </p>
      </Card>

      <Card>
        <h2 className={styles.h2}>2. רישיון שימוש</h2>
        <p className={styles.p}>
          המשתמש מקבל רישיון מוגבל, אישי ולא בלעדי להפעיל את האפליקציה לצורכי
          עבודה מורשים (סבבי שטח). אין רישיון להעתיק את המוצר, לבנות מוצר מתחרה
          על בסיסו, או לחשוף קוד מקור / מפתחות API.
        </p>
      </Card>

      <Card>
        <h2 className={styles.h2}>3. איסור העתקה</h2>
        <ul className={styles.list}>
          <li>אין להעתיק מסכים, עיצוב או לוגו ללא אישור.</li>
          <li>אין להפיץ את האפליקציה או חלקים ממנה לצד שלישי.</li>
          <li>אין להסיר הודעות זכויות יוצרים מהממשק או מהקבצים.</li>
          <li>אין לבצע הנדסה לאחור לצורך גניבת קניין רוחני.</li>
        </ul>
      </Card>

      <Card>
        <h2 className={styles.h2}>4. נתונים ואחריות</h2>
        <p className={styles.p}>
          זמני הגעה, מסלולים והמלצות הם כלי עזר תפעוליים בלבד. האחריות לנהיגה
          בטוחה, לעמידה בנהלי ברינקס ולדיווח נכון נשארת בידי המשתמש והארגון.
          שעות עבודה באפליקציה אינן מחליפות מערכת שכר רשמית.
        </p>
      </Card>

      <Card>
        <h2 className={styles.h2}>5. פרטיות ומפתחות</h2>
        <p className={styles.p}>
          מפתחות שרת (מפות, OCR וכו׳) נשמרים בשרת בלבד. אין לשתף סיסמאות או
          מפתחות. מיקומי GPS משמשים לתפעול הסבב ולשיפור הערכות זמן.
        </p>
      </Card>

      <Card>
        <h2 className={styles.h2}>6. יצירת קשר</h2>
        <p className={styles.p}>
          לבקשות רישוי, דיווח על העתקה או שאלות משפטיות — פנו לבעלי המוצר דרך
          ערוץ הארגון שהנפיק את הגישה לאפליקציה.
        </p>
      </Card>

      <p className={styles.footer}>{copyrightLine()}</p>
      <Link to="/app/dashboard" className={styles.back}>
        חזרה לבית
      </Link>
    </div>
  );
}
