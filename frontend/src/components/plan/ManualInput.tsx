import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { autocomplete, placeDetails } from "../../api/planning";
import type { PlaceSuggestion } from "../../api/client";
import { DEMO_MANUAL_ADDRESS } from "../../lib/demoAddresses";
import { useTourStore } from "../../store/tourStore";
import styles from "./ManualInput.module.css";

type Props = {
  onSubmit: (payload: Record<string, unknown>) => void;
  loading?: boolean;
};

const CATEGORIES = [
  { value: "bank_branch", label: "סניף בנק" },
  { value: "atm", label: "כספומט" },
  { value: "retail_chain", label: "רשת קמעונאית" },
  { value: "private_business", label: "עסק פרטי" },
  { value: "other", label: "אחר" },
];

export function ManualInput({ onSubmit, loading }: Props) {
  const tourActive = useTourStore((s) => s.active);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [category, setCategory] = useState("other");
  const [twType, setTwType] = useState("none");
  const [twStart, setTwStart] = useState("");
  const [twEnd, setTwEnd] = useState("");
  const [vip, setVip] = useState(false);
  const [serviceMin, setServiceMin] = useState("");
  const [notes, setNotes] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  function fillDemoAddress() {
    setName(DEMO_MANUAL_ADDRESS.customer_name);
    setAddress(DEMO_MANUAL_ADDRESS.address);
    setPlaceId(DEMO_MANUAL_ADDRESS.place_id ?? null);
    setCategory(DEMO_MANUAL_ADDRESS.category);
    setSuggestions([]);
  }

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

  function submit() {
    if (!name.trim() || !address.trim()) return;
    onSubmit({
      customer_name: name.trim(),
      address: address.trim(),
      place_id: placeId,
      category,
      priority: vip ? "vip" : "normal",
      tw_type: twType,
      tw_start: twStart || null,
      tw_end: twEnd || null,
      service_duration_min: serviceMin ? Number(serviceMin) : null,
      notes: notes || null,
    });
    setName("");
    setAddress("");
    setPlaceId(null);
    setTwType("none");
    setTwStart("");
    setTwEnd("");
    setVip(false);
    setServiceMin("");
    setNotes("");
    setMoreOpen(false);
  }

  return (
    <div className={styles.wrap} data-tour="plan-manual">
      {tourActive ? (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={fillDemoAddress}
          data-tour="plan-fill-demo"
        >
          מלא כתובת דמה
        </Button>
      ) : null}
      <Input
        label="שם לקוח"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className={styles.addrWrap}>
        <Input
          label="כתובת"
          value={address}
          onChange={(e) => {
            setPlaceId(null);
            setAddress(e.target.value);
          }}
        />
        {suggestions.length > 0 ? (
          <ul className={styles.suggest} role="listbox">
            {suggestions.map((s) => (
              <li key={s.place_id}>
                <button type="button" onClick={() => void pickSuggestion(s)}>
                  {s.description}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <Button
        type="button"
        size="lg"
        loading={loading}
        disabled={!name.trim() || !address.trim()}
        onClick={submit}
        data-tour="plan-add-stop"
      >
        הוסף יעד
      </Button>

      <button
        type="button"
        className={styles.moreToggle}
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((v) => !v)}
      >
        {moreOpen ? "הסתר אפשרויות נוספות" : "זמן מוגבל, VIP, הערות…"}
      </button>

      {moreOpen ? (
        <div className={styles.more}>
          <label className={styles.label}>
            קטגוריה
            <select
              className={styles.select}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.segments} role="group" aria-label="אילוץ זמן">
            {[
              ["none", "ללא"],
              ["before", "עד שעה"],
              ["after", "משעה"],
              ["window", "בין"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={twType === value ? styles.segActive : styles.seg}
                onClick={() => setTwType(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {twType === "before" || twType === "window" ? (
            <Input
              label="עד שעה"
              type="time"
              value={twEnd}
              onChange={(e) => setTwEnd(e.target.value)}
            />
          ) : null}
          {twType === "after" || twType === "window" ? (
            <Input
              label="משעה"
              type="time"
              value={twStart}
              onChange={(e) => setTwStart(e.target.value)}
            />
          ) : null}

          <label className={styles.check}>
            <input
              type="checkbox"
              checked={vip}
              onChange={(e) => setVip(e.target.checked)}
            />
            עדיפות VIP
          </label>

          <Input
            label="דקות שירות (אופציונלי)"
            type="number"
            value={serviceMin}
            onChange={(e) => setServiceMin(e.target.value)}
          />
          <Input label="הערות" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      ) : null}
    </div>
  );
}
