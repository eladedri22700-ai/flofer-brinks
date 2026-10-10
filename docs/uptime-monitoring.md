# ניטור זמינות — למה לא GitHub Actions

## מה היה

`keep-render-awake.yml` שלח ping ל-`/api/health` כדי למנוע את ה-spin-down
של Render אחרי 15 דקות חוסר פעילות. הלו"ז ביקש כל 10 דקות.

## למה זה נמחק

מדדנו את המרווחים בפועל בין 15 ההרצות האחרונות, בדקות:

```
223  419  419  283  224  392  439  302  241  369  437  315  233  186
```

**חציון: 315 דקות.** הלו"ז ביקש 10.

GitHub Actions מפיל הרצות מתוזמנות תחת עומס — זה מתועד
([docs](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule)):
"the schedule event can be delayed during periods of high loads". בריפו
ציבורי עם `*/10` זה לא עיכוב קל, זה ביטול כמעט מוחלט.

כלומר ה-workflow שלח ping אחת ל-3–7 שעות כדי להילחם ב-spin-down של 15
דקות. **הוא מעולם לא עשה את העבודה שלו**, גם כשהשירות היה בריא לגמרי.
השארתו היא תחזוקה של משהו שנראה כמו ניטור ואינו ניטור — וזה גרוע מלא
לנטר בכלל, כי זה מייצר ביטחון שווא.

## מה מחליף אותו

**שום דבר, עד שמישהו יקים פינגר חיצוני.** נכון לעכשיו אין ניטור על
production. זה רשום ב-`PENDING_HUMAN_TASKS.md` בריפו FINANCEE.

### UptimeRobot (חינם, 5 דקות)

1. חשבון ב-<https://uptimerobot.com> (התוכנית החינמית נותנת 50 מוניטורים
   במרווח של 5 דקות).
2. **Add New Monitor**
   - Monitor Type: `HTTP(s)`
   - Friendly Name: `FLOFER BRINKS prod`
   - URL: `https://flofer-brinks.onrender.com/api/health`
   - Monitoring Interval: **5 minutes**
3. **Alert Contacts** — מייל, ואם רוצים גם טלגרם.

מרווח של 5 דקות גם מנטר וגם מחזיק את השירות ער, כי הוא קצר מחלון
ה-15 דקות של Render. זה פותר את שתי הבעיות בכלי אחד, וזה בדיוק מה
שה-workflow ניסה לעשות ולא הצליח.

### cron-job.org

חלופה חינמית עם מרווח של דקה. עדיף אם רוצים cold start נדיר יותר,
פחות נוח בהתראות.

## הדבר שבאמת פותר את זה

`keep-render-awake` נולד כדי לעקוף מגבלה של התוכנית החינמית. פינגר חיצוני
עוקף אותה טוב יותר, אבל עדיין עוקף. אם השירות הזה משרת משתמשים אמיתיים,
instance בתשלום ב-Render (ללא spin-down, עם מסד שלא פג כל 30 יום) מוחק גם
את הצורך בפינגר וגם את `renew-render-postgres` כולו.
