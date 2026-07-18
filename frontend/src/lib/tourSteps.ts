export type TourStep = {
  id: string;
  path: string;
  target?: string;
  title: string;
  body: string;
  clickHint?: string;
};

/** Live coach-mark tour — demo mode should be on while these run. */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    path: "/app/dashboard",
    title: "ברוכים הבאים להדרכה חיה",
    body: "נעבור יחד על המשמרת עם נתוני דמו (רק אצלך — לא משותף עם טלפון אחר). מה שמודגש בזהב חשוב עכשיו. בסיום חוזרים למצב אמת.",
  },
  {
    id: "home",
    path: "/app/dashboard",
    target: "home-round",
    title: "בית — מצב הסבב",
    body: "כאן רואים סטטוס היום, הכתובת הבאה, חזרה לברינקס, ואת כל סדר הנקודות.",
    clickHint: "שימו לב לכרטיס הסבב המודגש",
  },
  {
    id: "nav-plan",
    path: "/app/dashboard",
    target: "nav-plan",
    title: "תכנון",
    body: "בתחתית — «תכנון». שם מוסיפים כתובות (ידני, מצלמה, גלריה או לקוחות שמורים) ואז מחשבים מסלול.",
    clickHint: "המשך יעביר אתכם למסך התכנון",
  },
  {
    id: "plan",
    path: "/app/plan",
    target: "plan-optimize",
    title: "חישוב מסלול",
    body: "אחרי שיש יעדים — «חשב מסלול» בונה סדר אופטימלי (יציאה וחזרה לסניף). בדמו כבר יש יעדים.",
    clickHint: "הכפתור המודגש הוא לב החישוב",
  },
  {
    id: "route",
    path: "/app/route",
    target: "route-list",
    title: "סדר הנקודות",
    body: "כל הכתובות לפי הסדר עם ETA. גררו לשינוי ידני, נעלו יעד חשוב, ואז אשרו יציאה.",
  },
  {
    id: "board",
    path: "/app/board",
    target: "board-start",
    title: "מפת הסבב והתחלה",
    body: "מפה + רשימה. «התחל סבב» קובע יציאה לעכשיו ומעדכן זמנים.",
  },
  {
    id: "live",
    path: "/app/live",
    target: "live-primary",
    title: "מסך נסיעה",
    body: "בשטח: יעד נוכחי, וויז, סימון הגעה. GPS מזהה גם בלי סימון. חזרה לסניף סוגרת יום עם סיכום.",
  },
  {
    id: "settings-depot",
    path: "/app/settings",
    target: "settings-depot",
    title: "הגדרות — סניף ברינקס",
    body: "כאן מגדירים את נקודת היציאה והחזרה (כתובת המשרד). חשוב לפני משמרת אמת — אחרת המסלול עלול להתחיל מכתובת זמנית.",
    clickHint: "שמרו כתובת אמיתית לפני מחר",
  },
  {
    id: "settings-theme",
    path: "/app/settings",
    target: "settings-theme",
    title: "מצב יום / לילה",
    body: "בחרו תצוגה בהירה ליום, או כהה לנסיעה בלילה. אפשר להחליף בכל רגע — זה נשמר אצלך בלבד.",
    clickHint: "נסו ללחוץ «בהיר» או «כהה» עכשיו",
  },
  {
    id: "settings-drive",
    path: "/app/settings",
    target: "settings-drive",
    title: "העדפות נסיעה",
    body: "מספר SOS לראש צוות, ורדיוס גיאופנס (כמה מטרים נחשבים «הגעתי ליעד»). שמרו אחרי שינוי.",
  },
  {
    id: "ready",
    path: "/app/dashboard",
    title: "מוכנים למשמרת מחר",
    body: "מסיימים: הדמו נמחק מחשבונך, חוזרים למצב אמת. מחר — תכנון אמיתי, אישור במפה, וצאו לדרך. הנתונים שלך לא מתערבבים עם משתמש אחר.",
  },
];
