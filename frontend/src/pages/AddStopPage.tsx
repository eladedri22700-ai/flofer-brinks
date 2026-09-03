import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTodayRoute } from "../api/planning";
import { autocomplete, placeDetails, addStop } from "../api/planning";
import { whatIfStop } from "../api/live";
import type { PlaceSuggestion } from "../api/client";
import { apiErrorMessage } from "../api/errors";
import { formatTimeHe } from "../lib/roundBrief";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/ToastProvider";
import styles from "./AddStopPage.module.css";

type WhatIf = {
  added_min: number;
  new_return_at: string | null;
  deadlines_ok: boolean;
  message_he: string;
};

export default function AddStopPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { show } = useToast();
  const routeQ = useQuery({ queryKey: ["route-today"], queryFn: getTodayRoute });

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [preview, setPreview] = useState<WhatIf | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const route = routeQ.data;
  const live = route?.status === "in_progress";

  useEffect(() => {
    if (address.trim().length < 3 || placeId) {
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      void autocomplete(address.trim()).then(setSuggestions).catch(() => setSuggestions([]));
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
      setLat(d.lat);
      setLng(d.lng);
    } catch {
      /* keep description, no coords yet */
    }
  }

  useEffect(() => {
    setPreview(null);
    if (!route || !live || !name.trim() || !address.trim()) return;
    const t = window.setTimeout(() => {
      setPreviewing(true);
      void whatIfStop(route.id, {
        customer_name: name.trim(),
        address: address.trim(),
        lat: lat ?? 32.08,
        lng: lng ?? 34.78,
        service_duration_min: 12,
        tw_type: "none",
        priority: "normal",
      })
        .then((res) => setPreview(res as WhatIf))
        .catch(() => setPreview(null))
        .finally(() => setPreviewing(false));
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, address, lat, lng, live, route?.id]);

  const addM = useMutation({
    mutationFn: () =>
      addStop(route!.id, {
        customer_name: name.trim(),
        address: address.trim(),
        lat: lat ?? 32.08,
        lng: lng ?? 34.78,
        service_duration_min: 12,
        tw_type: "none",
        priority: "normal",
      }),
    onSuccess: () => {
      show("היעד נוסף · הסבב עודכן", "success");
      void qc.invalidateQueries({ queryKey: ["route-today"] });
      nav("/app/live");
    },
    onError: (e) => show(apiErrorMessage(e), "error"),
  });

  if (routeQ.isLoading) return <LoadingScreen label="טוען" />;

  if (!route || !live) {
    return (
      <div className={styles.screen}>
        <div className={styles.topbar}>
          <div>
            <div className={styles.title}>הוספת עצירה</div>
          </div>
          <button type="button" className={`${styles.closeBtn} tap`} onClick={() => nav("/app/dashboard")} aria-label="סגור">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className={styles.body}>
          <EmptyState
            title="אין סבב פעיל"
            description="בדיקת השפעה לפני הוספה זמינה רק באמצע נסיעה. הוספת יעדים לפני היציאה נעשית במסך התכנון."
            action={
              <Link to="/app/plan" className={styles.dark} style={{ textDecoration: "none" }}>
                לתכנון הסבב
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const canConfirm = Boolean(name.trim() && address.trim() && (!previewing || preview));

  return (
    <div className={styles.screen}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.title}>הוספת עצירה</div>
          <div className={styles.sub}>באמצע הסבב · תשובה תוך שניות</div>
        </div>
        <button type="button" className={`${styles.closeBtn} tap`} onClick={() => nav("/app/live")} aria-label="סגור">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.card}>
          <div className={styles.label}>שם לקוח</div>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="לדוגמה: בנק מזרחי"
          />
        </div>
        <div className={styles.card} style={{ position: "relative" }}>
          <div className={styles.label}>כתובת</div>
          <input
            className={styles.input}
            value={address}
            onChange={(e) => {
              setPlaceId(null);
              setLat(null);
              setLng(null);
              setAddress(e.target.value);
            }}
            placeholder="חפשו כתובת…"
          />
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
        </div>

        {name.trim() && address.trim() ? (
          <div className={styles.impact}>
            <div className={styles.impactLabel}>אם נוסיף — הסבב ייראה כך</div>
            {previewing ? (
              <div className={styles.impactLoading}>מחשב השפעה…</div>
            ) : preview ? (
              <>
                <div className={styles.impactRow}>
                  <div>
                    <div className={styles.impactSmall}>שיבוץ מוצע</div>
                    <div className={styles.impactSlot}>+{preview.added_min} דק׳ להוספה</div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div className={styles.impactSmall}>חזרה לברינקס</div>
                    <div className={`${styles.impactEta} num`}>
                      {preview.new_return_at ? formatTimeHe(preview.new_return_at) : "—"}
                    </div>
                  </div>
                </div>
                <div className={styles.impactDivider}>
                  תוספת {preview.added_min} דקות
                </div>
              </>
            ) : (
              <div className={styles.impactLoading}>לא ניתן לחשב תצוגה מקדימה כרגע</div>
            )}
          </div>
        ) : null}

        {preview && !preview.deadlines_ok ? (
          <div className={styles.warn}>{preview.message_he}</div>
        ) : preview && preview.message_he ? (
          <div className={styles.warnOk}>{preview.message_he}</div>
        ) : null}
      </div>

      <div className={styles.bottomBar}>
        <button type="button" className={`${styles.outline} tap`} onClick={() => nav("/app/live")}>
          בטל
        </button>
        <button
          type="button"
          className={`${styles.dark} tap`}
          disabled={!canConfirm || addM.isPending}
          onClick={() => addM.mutate()}
        >
          {addM.isPending ? "מוסיף…" : "הוסף לסבב"}
        </button>
      </div>
    </div>
  );
}
