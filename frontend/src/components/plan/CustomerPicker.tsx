import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../../api/errors";
import {
  autocomplete,
  createCustomer,
  listCustomers,
  placeDetails,
} from "../../api/planning";
import type { CustomerDto, PlaceSuggestion } from "../../api/client";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { useToast } from "../ui/ToastProvider";
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
  const { show } = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);

  const customersQ = useQuery({
    queryKey: ["customers", q],
    queryFn: () => listCustomers(q),
  });

  const excluded = useMemo(() => new Set(excludeCustomerIds), [excludeCustomerIds]);
  const rows = (customersQ.data ?? []).filter((c) => !excluded.has(c.id));

  useEffect(() => {
    if (address.trim().length < 2 || placeId) {
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      void autocomplete(address.trim())
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [address, placeId]);

  const createM = useMutation({
    mutationFn: () =>
      createCustomer({
        name: name.trim(),
        address: address.trim(),
        place_id: placeId,
      }),
    onSuccess: (c) => {
      show("הלקוח נשמר בספרייה", "success");
      setName("");
      setAddress("");
      setPlaceId(null);
      setFormOpen(false);
      void qc.invalidateQueries({ queryKey: ["customers"] });
      setSelected((prev) => new Set(prev).add(c.id));
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function pickSuggestion(s: PlaceSuggestion) {
    setAddress(s.description);
    setPlaceId(s.place_id);
    setSuggestions([]);
    try {
      const d = await placeDetails(s.place_id);
      setAddress(d.formatted_address || s.description);
    } catch {
      /* keep description */
    }
  }

  function submitSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    onAdd(ids);
    setSelected(new Set());
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.lead}>
        כל כתובת מצילום / קובץ / הזנה נשמרת כאן אוטומטית. אפשר גם להוסיף לקוח
        ידנית לספרייה, ואז לבחור לסבב.
      </p>

      <button
        type="button"
        className={styles.addToggle}
        onClick={() => setFormOpen((v) => !v)}
      >
        {formOpen ? "סגור טופס לקוח חדש" : "+ הוסף לקוח שמור ידנית"}
      </button>

      {formOpen ? (
        <div className={styles.form}>
          <label className={styles.field}>
            <span>שם לקוח</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: בנק לאומי דיזנגוף"
              autoComplete="organization"
            />
          </label>
          <label className={styles.field}>
            <span>כתובת</span>
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setPlaceId(null);
              }}
              placeholder="התחילו להקליד כתובת…"
              autoComplete="street-address"
            />
          </label>
          {suggestions.length > 0 ? (
            <ul className={styles.suggest}>
              {suggestions.map((s) => (
                <li key={s.place_id}>
                  <button type="button" onClick={() => void pickSuggestion(s)}>
                    {s.description}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Button
            size="lg"
            loading={createM.isPending}
            disabled={!name.trim() || address.trim().length < 2}
            onClick={() => createM.mutate()}
          >
            שמור בספרייה
          </Button>
        </div>
      ) : null}

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
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => setSelected(new Set(rows.map((c) => c.id)))}
        >
          בחר הכל ברשימה
        </button>
        {selected.size > 0 ? (
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => setSelected(new Set())}
          >
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
        </div>
      ) : null}

      {!customersQ.isLoading && rows.length === 0 ? (
        <p className={styles.empty}>
          {q.trim()
            ? "לא נמצאו לקוחות תואמים."
            : "הספרייה ריקה. הוסיפו לקוח ידנית למעלה, או העלו צילום/קובץ — הכתובות יישמרו כאן."}
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
          onClick={submitSelected}
        >
          {selected.size
            ? `הוסף ${selected.size} לסבב`
            : "בחרו לקוחות להוספה לסבב"}
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
