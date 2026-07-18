import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listCustomers } from "../../api/planning";
import type { CustomerDto } from "../../api/client";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import styles from "./CustomerPicker.module.css";

type Props = {
  excludeCustomerIds?: number[];
  onAdd: (customerIds: number[]) => void;
  loading?: boolean;
};

export function CustomerPickerTab({
  excludeCustomerIds = [],
  onAdd,
  loading,
}: Props) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const customersQ = useQuery({
    queryKey: ["customers", q],
    queryFn: () => listCustomers(q),
  });

  const excluded = useMemo(() => new Set(excludeCustomerIds), [excludeCustomerIds]);

  const rows = (customersQ.data ?? []).filter((c) => !excluded.has(c.id));

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(rows.map((c) => c.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function submit() {
    const ids = [...selected];
    if (!ids.length) return;
    onAdd(ids);
    setSelected(new Set());
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.lead}>
        בחרו לקוחות שמורים והוסיפו לסבב של היום — בלי להקליד כתובת מחדש.
      </p>

      <label className={styles.searchLabel}>
        <span className={styles.srOnly}>חיפוש לקוח</span>
        <input
          className={styles.search}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לפי שם או כתובת…"
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>

      <div className={styles.toolbar}>
        <button type="button" className={styles.linkBtn} onClick={selectAllVisible}>
          בחר הכל ברשימה
        </button>
        {selected.size > 0 ? (
          <button type="button" className={styles.linkBtn} onClick={clearSelection}>
            נקה בחירה ({selected.size})
          </button>
        ) : (
          <span className={styles.meta}>{rows.length} לקוחות</span>
        )}
      </div>

      {customersQ.isLoading ? (
        <div className={styles.list}>
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </div>
      ) : null}

      {customersQ.isError ? (
        <p className={styles.empty}>לא הצלחנו לטעון את רשימת הלקוחות. נסו שוב.</p>
      ) : null}

      {!customersQ.isLoading && rows.length === 0 ? (
        <p className={styles.empty}>
          {q.trim()
            ? "לא נמצאו לקוחות תואמים."
            : "עדיין אין לקוחות שמורים. הוסיפו יעד פעם אחת (צילום / ידני / קובץ) — והוא יישמר לסבבים הבאים."}
        </p>
      ) : null}

      <ul className={styles.list}>
        {rows.map((c) => (
          <CustomerRow
            key={c.id}
            customer={c}
            checked={selected.has(c.id)}
            onToggle={() => toggle(c.id)}
          />
        ))}
      </ul>

      <div className={styles.footer}>
        <Button
          size="lg"
          disabled={!selected.size || loading}
          loading={loading}
          onClick={submit}
        >
          {selected.size
            ? `הוסף ${selected.size} לסבב`
            : "בחרו לקוחות להוספה"}
        </Button>
      </div>
    </div>
  );
}

function CustomerRow({
  customer,
  checked,
  onToggle,
}: {
  customer: CustomerDto;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className={checked ? styles.rowOn : styles.row}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className={styles.check}
        />
        <span className={styles.rowBody}>
          <span className={styles.name}>{customer.name}</span>
          <span className={styles.address}>{customer.address}</span>
          <span className={styles.badge}>
            {customer.service_duration_min} דק׳
            {customer.service_estimate_source === "learned"
              ? ` · נלמד (${customer.service_sample_count})`
              : ""}
          </span>
        </span>
      </label>
    </li>
  );
}
