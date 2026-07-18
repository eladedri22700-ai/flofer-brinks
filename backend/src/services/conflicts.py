"""Conflict detection when VRPTW is infeasible — Hebrew options for the user."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import time

from src.services.optimizer import StopInput, SolveResult, solve_vrptw, _tmin


@dataclass
class ConflictOption:
    id: str
    label_he: str


@dataclass
class ConflictReport:
    feasible: bool
    conflicts: list[dict]
    options: list[ConflictOption]
    dropped_names: list[str]
    partial: SolveResult | None = None


def build_conflict_report(
    *,
    matrices: dict[str, list[list[int]]],
    stops: list[StopInput],
    departure_time: time,
    break_duration_min: int,
    break_window_start: time,
    break_window_end: time,
    deadline_buffer_min: int,
    vip_weight: float,
    variance_mode: bool,
) -> ConflictReport:
    """Re-solve with AddDisjunction; identify dropped stops and propose options."""
    partial = solve_vrptw(
        matrices=matrices,
        stops=stops,
        departure_time=departure_time,
        break_duration_min=break_duration_min,
        break_window_start=break_window_start,
        break_window_end=break_window_end,
        deadline_buffer_min=deadline_buffer_min,
        vip_weight=vip_weight,
        variance_mode=variance_mode,
        allow_drop=True,
        drop_penalty=100_000,
    )

    by_id = {s.stop_id: s for s in stops}
    dropped = [by_id[i] for i in partial.dropped_stop_ids if i in by_id]
    names = [s.customer_name for s in dropped]

    conflicts: list[dict] = []
    tight = [s for s in stops if s.tw_type in ("before", "window")]
    if len(dropped) >= 2:
        a, b = dropped[0], dropped[1]
        conflicts.append(
            {
                "type": "pair",
                "stop_ids": [a.stop_id, b.stop_id],
                "message_he": (
                    f"לא ניתן להספיק את «{a.customer_name}» ואת «{b.customer_name}» "
                    f"באילוצי הזמן הנוכחיים — הם מתנגשים במסלול."
                ),
            }
        )
    elif len(dropped) == 1:
        s = dropped[0]
        deadline = _tmin(s.tw_end) if s.tw_end else None
        dl_txt = ""
        if deadline is not None:
            dl_txt = f" עד {deadline // 60:02d}:{deadline % 60:02d}"
        conflicts.append(
            {
                "type": "single",
                "stop_ids": [s.stop_id],
                "message_he": (
                    f"לא ניתן להספיק את «{s.customer_name}»{dl_txt} "
                    f"יחד עם שאר היעדים וההפסקה."
                ),
            }
        )
    else:
        # infeasible but nothing dropped — usually break/depot capacity
        conflicts.append(
            {
                "type": "general",
                "stop_ids": [s.stop_id for s in tight[:3]],
                "message_he": (
                    "לא נמצא מסלול חוקי עם כל האילוצים. "
                    "נסו להרחיב חלונות זמן או להקטין את חיץ הבטיחות."
                ),
            }
        )

    options = [
        ConflictOption(
            id="relax_buffer",
            label_he="לוותר על חיץ הבטיחות (buffer) ולהחשב מחדש",
        ),
        ConflictOption(
            id="widen_windows",
            label_he="להרחיב את חלונות הזמן של היעדים הבעייתיים ב־30 דק'",
        ),
        ConflictOption(
            id="drop_stop",
            label_he=(
                f"להעביר את «{names[0]}» למחר / להסיר מהסבב"
                if names
                else "להסיר יעד בעייתי מהסבב"
            ),
        ),
    ]
    if len(names) >= 2:
        options.insert(
            0,
            ConflictOption(
                id="delay_second",
                label_he=f"לדחות את «{names[1]}» (להרחיב דד-ליין)",
            ),
        )

    return ConflictReport(
        feasible=False,
        conflicts=conflicts,
        options=options,
        dropped_names=names,
        partial=partial,
    )
