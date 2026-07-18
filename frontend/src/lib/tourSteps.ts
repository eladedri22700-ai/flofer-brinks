import type { TourWaitEvent } from "./tourEvents";
import type { TourPlanTab } from "../store/tourStore";

export type TourStep = {
  id: string;
  path: string;
  target?: string;
  screen: string;
  title: string;
  body: string;
  bullets?: string[];
  clickHint?: string;
  /** Hands-on: wait until the user completes this action */
  waitFor?: TourWaitEvent;
  planTab?: TourPlanTab;
};

/** Interactive coach-mark tour with demo practice (empty today + dummy inputs). */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    path: "/app/dashboard",
    screen: "התחלה",
    title: "הדרכה מעשית — נעשה יחד",
    body: "מפעילים מצב הדגמה ומנקים את רשימת היום כדי שתוכלו להוסיף כתובות בעצמכם. כל מה שתעשו כאן הוא תרגול — לא משפיע על משמרת אמת.",
    bullets: [
      "באנר צהוב = מצב הדגמה / תרגול",
      "נעבור צעד־אחר־צעד: הוספה, VIP, צילום, חישוב, נעילה",
      "בסיום מוחקים את הדמו וחוזרים למצב אמת",
    ],
    clickHint: "לחצו «הבנתי · המשך» להתחיל",
  },
  {
    id: "plan-intro",
    path: "/app/plan",
    target: "plan-add",
    screen: "תכנון",
    title: "מסך התכנון — כאן מוסיפים יעדים",
    body: "רשימת היום כרגע ריקה בכוונה. עכשיו תוסיפו כתובת ידנית, ואחר כך מצילום דמה.",
    bullets: [
      "שמורים / צילום / ידני / קובץ — ארבע דרכים להוספה",
      "למטה תופיע «רשימת היום» אחרי שתוסיפו",
    ],
    clickHint: "המשך יפתח את לשונית «ידני»",
  },
  {
    id: "manual-add",
    path: "/app/plan",
    target: "plan-manual",
    screen: "תכנון · ידני",
    title: "תרגיל 1: הוסיפו כתובת דמה",
    body: "לחצו «מלא כתובת דמה», בדקו את השם והכתובת, ואז לחצו «הוסף יעד». ההדרכה תמשיך אחרי שהיעד יופיע ברשימה.",
    bullets: [
      "«מלא כתובת דמה» — ממלא אוטומטית פרטי דוגמה",
      "אפשר גם להקליד ידנית אם רוצים",
      "«הוסף יעד» — שומר לרשימת היום",
    ],
    waitFor: "tour:stop-added",
    planTab: "manual",
    clickHint: "אחרי «הוסף יעד» הכפתור «המשך» ייפתח",
  },
  {
    id: "set-vip",
    path: "/app/plan",
    target: "plan-vip",
    screen: "תכנון · עדיפות",
    title: "תרגיל 2: סמנו לקוח כ־VIP",
    body: "ברשימת היום — לחצו על הכפתור «VIP» המודגש ליד היעד שהוספתם. זה דוחף את הלקוח מוקדם יותר בחישוב, בלי להרוס את כל היום.",
    bullets: [
      "VIP = עדיפות גבוהה באופטימיזציה",
      "אפשר גם «עדיפות / דרישת זמן» לחלונות שעות",
    ],
    waitFor: "tour:vip-set",
    planTab: "manual",
    clickHint: "לחצו VIP על היעד — ואז ההמשך ייפתח",
  },
  {
    id: "ocr-photo",
    path: "/app/plan",
    target: "plan-shot",
    screen: "תכנון · צילום",
    title: "תרגיל 3: העלו צילום דמה",
    body: "בבוקר האמיתי מצלמים רשימה מ־Zebra. כאן לחצו «השתמש בצילום דמה» — תופיע תמונת דוגמה והמערכת תחלץ כתובות (מצב הדגמה).",
    bullets: [
      "«השתמש בצילום דמה» — בלי מצלמה אמיתית",
      "אפשר גם «צלם עכשיו» / «מהגלריה» כמו ביום אמת",
      "אחרי הסריקה תופיע טיוטה לאישור",
    ],
    waitFor: "tour:ocr-ready",
    planTab: "shot",
    clickHint: "המתינו עד שהטיוטה מופיעה",
  },
  {
    id: "ocr-commit",
    path: "/app/plan",
    target: "plan-draft-commit",
    screen: "תכנון · אישור",
    title: "תרגיל 4: אשרו את הכתובות מהצילום",
    body: "בדקו את הטיוטה (אפשר לערוך שורה). לחצו «הוסף הכל» כדי להכניס את הכתובות לרשימת היום.",
    bullets: [
      "אפשר לתקן שם/כתובת לפני האישור",
      "«הוסף הכל» — מוסיף את כל השורות לסבב",
    ],
    waitFor: "tour:ocr-committed",
    planTab: "shot",
    clickHint: "לחצו «הוסף הכל» בתחתית הטיוטה",
  },
  {
    id: "optimize",
    path: "/app/plan",
    target: "plan-optimize",
    screen: "תכנון · חישוב",
    title: "תרגיל 5: חשבו מסלול",
    body: "עכשיו יש מספיק יעדים. לחצו «חשב מסלול» — המערכת מסדרת סדר יעיל עם יציאה וחזרה לסניף.",
    bullets: [
      "החישוב מתחשב גם ב־VIP שסימנתם",
      "אחרי החישוב עוברים לאישור הסדר",
    ],
    waitFor: "tour:optimized",
    clickHint: "לחצו את הכפתור המודגש למטה",
  },
  {
    id: "route-lock",
    path: "/app/route",
    target: "route-lock-btn",
    screen: "סדר נקודות",
    title: "תרגיל 6: נעלו יעד חשוב",
    body: "גררו לשינוי סדר אם רוצים. לחצו על 🔒 ליד יעד אחד — נעילה שומרת אותו במקום גם בחישוב מחדש.",
    bullets: [
      "⋮⋮ — גרירה לשינוי ידני",
      "🔒 — נעילת מיקום בסדר",
      "VIP מוצג ליד השם אם סומן",
    ],
    waitFor: "tour:locked",
    clickHint: "נעלו יעד אחד (🔒) כדי להמשיך",
  },
  {
    id: "board",
    path: "/app/board",
    target: "board-start",
    screen: "מפת הסבב",
    title: "מפה ואישור יציאה",
    body: "לפני שטח: מפה + רשימה. ביום אמת לוחצים «התחל סבב» כשיוצאים מהסניף.",
    bullets: [
      "רואים את כל הנקודות על המפה",
      "«התחל סבב» מעדכן זמנים לפי השעה האמיתית",
    ],
    clickHint: "בהדרכה רק מבינים — לא חובה להתחיל סבב",
  },
  {
    id: "live",
    path: "/app/live",
    target: "live-primary",
    screen: "נסיעה",
    title: "מסך הנסיעה בשטח",
    body: "כאן עובדים ביום אמת: ניווט, סימון הגעה, ו־GPS שמזהה גם לבד.",
    bullets: [
      "וויז / ניווט ליעד",
      "הגעתי / סיימתי",
      "חזרה לסניף סוגרת יום עם סיכום",
    ],
  },
  {
    id: "settings-api",
    path: "/app/settings",
    target: "settings-api",
    screen: "הגדרות",
    title: "איפה מזינים מפתחות API",
    body: "כאן מדביקים מפתחות Google / Anthropic / Telegram. בלי מפתחות — מפות וחילוץ צילום במצב הדגמה (כמו עכשיו).",
    bullets: [
      "Google Server + Browser — מפות ומסלולים",
      "Anthropic — OCR מצילום אמיתי",
      "«שמור מפתחות» אחרי ההדבקה",
    ],
  },
  {
    id: "settings-theme",
    path: "/app/settings",
    target: "settings-theme",
    screen: "הגדרות",
    title: "מצב יום / לילה",
    body: "נסו ללחוץ «יום · בהיר» או «לילה · כהה» על האזור המודגש — זה נשמר אצלכם.",
    bullets: ["בהיר ליום", "כהה לנסיעת לילה"],
    clickHint: "אפשר לנסות עכשיו ואז להמשיך",
  },
  {
    id: "settings-depot",
    path: "/app/settings",
    target: "settings-depot",
    screen: "הגדרות",
    title: "סניף ברינקס",
    body: "לפני משמרת אמת שמרו כאן את כתובת המשרד האמיתית — כל מסלול יוצא וחוזר משם.",
    bullets: ["אתר כתובת על המפה", "שמור נקודת התחלה וסיום"],
  },
  {
    id: "ready",
    path: "/app/dashboard",
    screen: "סיום",
    title: "סיימתם תרגול — עוברים למצב אמת",
    body: "בלחיצה על הסיום: הדמו והתרגול נמחקים מהחשבון, וחוזרים למסך הבית למשמרת אמיתית.",
    bullets: [
      "מחר: תכנון אמיתי → חשב מסלול → מפה → התחל סבב",
      "אפשר להפעיל הדרכה מחדש מההגדרות",
    ],
    clickHint: "לחצו «סיים · עבור למצב אמת»",
  },
];
