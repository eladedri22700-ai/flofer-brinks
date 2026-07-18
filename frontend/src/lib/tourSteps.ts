export type TourStep = {
  id: string;
  /** Navigate here before highlighting */
  path: string;
  /** data-tour="..." target; omit for centered card only */
  target?: string;
  title: string;
  body: string;
  /** Hint shown above the primary continue button */
  clickHint?: string;
};

/** Live coach-mark tour — demo mode should be on while these run. */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    path: "/app/dashboard",
    title: "ברוכים הבאים להדרכה חיה",
    body: "נעבור יחד על כל שלבי המשמרת עם נתוני דמו. מה שמודגש בזהב — זה מה שרלוונטי עכשיו. בסיום נחזור למצב אמת, מוכנים למחר.",
  },
  {
    id: "home",
    path: "/app/dashboard",
    target: "home-round",
    title: "בית — מצב הסבב",
    body: "כאן רואים את סטטוס היום, הכתובת הבאה, זמן חזרה לברינקס, ואת כל סדר הנקודות.",
    clickHint: "שימו לב לכרטיס הסבב המודגש",
  },
  {
    id: "nav-plan",
    path: "/app/dashboard",
    target: "nav-plan",
    title: "תכנון",
    body: "בתחתית המסך — לשונית «תכנון». שם מוסיפים כתובות (ידני, מצלמה, גלריה או לקוחות שמורים) ואז מחשבים מסלול.",
    clickHint: "לחצו «המשך» — ניקח אתכם למסך התכנון",
  },
  {
    id: "plan",
    path: "/app/plan",
    target: "plan-optimize",
    title: "חישוב מסלול",
    body: "אחרי שיש יעדים — «חשב מסלול» בונה סדר אופטימלי (יציאה וחזרה לסניף). בדמו כבר יש יעדים מוכנים.",
    clickHint: "הכפתור המודגש הוא לב החישוב",
  },
  {
    id: "nav-order",
    path: "/app/plan",
    target: "nav-more",
    title: "סדר ומפה",
    body: "אחרי החישוב בודקים את הסדר ב«עוד» → סדר הנקודות / מפת הסבב. אפשר לגרור ידנית לפני יציאה.",
    clickHint: "«עוד» פותח את הכלים הנוספים",
  },
  {
    id: "route",
    path: "/app/route",
    target: "route-list",
    title: "סדר הנקודות",
    body: "כאן רואים את כל הכתובות לפי הסדר עם ETA. גררו כדי לשנות, נעלו יעד חשוב, ואז אשרו יציאה.",
  },
  {
    id: "board",
    path: "/app/board",
    target: "board-start",
    title: "מפת הסבב והתחלה",
    body: "מפה + רשימה. כשהסדר מאושר — «התחל סבב» קובע יציאה לעכשיו ומעדכן זמנים.",
    clickHint: "בדמו אפשר ללחוץ התחל אחרי ההדרכה — או רק להמשיך",
  },
  {
    id: "live",
    path: "/app/live",
    target: "live-primary",
    title: "מסך נסיעה",
    body: "אחרי «התחל סבב» כאן מופיעים היעד הבא, ניווט בוויז וסימון הגעה. ה-GPS מזהה גם בלי סימון ידני. חזרה לסניף סוגרת יום עם סיכום.",
    clickHint: "בדמו הסבב מוכן לאישור — הכפתור המודגש מוביל להתחלה",
  },
  {
    id: "ready",
    path: "/app/dashboard",
    title: "מוכנים למשמרת מחר",
    body: "מסיימים את ההדרכה: הדמו נכבה, חוזרים למצב אמת. מחר — תכננו סבב אמיתי ב«תכנון», אשרו במפה, וצאו לדרך.",
  },
];
