import { Link } from "react-router-dom";
import { HowItWorks } from "../components/ui/HowItWorks";
import { PageHeader } from "../components/ui/PageHeader";
import { HELP_DAY, HELP_DAY_STEPS, HELP_FAQ } from "../lib/helpCopy";
import styles from "./HelpPage.module.css";

export default function HelpPage() {
  return (
    <div className={`pageShell ${styles.page}`}>
      <PageHeader
        kicker="עזרה"
        title="איך עובדים היום"
        lead="ארבעה צעדים פשוטים. בלי מונחים מסובכים — רק מה שצריך בשטח."
      />

      <HowItWorks block={HELP_DAY} defaultOpen />

      <ol className={styles.steps}>
        {HELP_DAY_STEPS.map((s) => (
          <li key={s.n} className={styles.step}>
            <span className={`${styles.num} num`} aria-hidden>
              {s.n}
            </span>
            <div className={styles.body}>
              <h2 className={styles.h2}>{s.title}</h2>
              <p className={styles.text}>{s.text}</p>
              <Link to={s.to} className={styles.cta}>
                {s.cta}
              </Link>
            </div>
          </li>
        ))}
      </ol>

      <section className={styles.faq} aria-labelledby="faq-heading">
        <h2 id="faq-heading" className={styles.h2}>
          שאלות נפוצות
        </h2>
        {HELP_FAQ.map((item) => (
          <details key={item.q} className={styles.item}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>

      <p className={styles.foot}>
        תמיד אפשר לפתוח את המסך הזה מ«עוד» → «איך עובדים היום».
      </p>
    </div>
  );
}
