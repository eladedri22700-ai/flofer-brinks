"""Live Mode API schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class GpsBody(BaseModel):
    lat: float | None = None
    lng: float | None = None
    source: str | None = None  # manual | geofence


class CompleteStopBody(BaseModel):
    exception_code: str = "none"
    exception_note: str | None = None
    lat: float | None = None
    lng: float | None = None
    departure_at: datetime | None = None
    source: str | None = None  # manual | geofence | next_stop


class SkipStopBody(BaseModel):
    note: str | None = None


class WorkDayPatch(BaseModel):
    start_at: datetime | None = None
    end_at: datetime | None = None
    note: str | None = None
    event: str | None = None  # exit | enter for geofence
    lat: float | None = None
    lng: float | None = None


class RouteEventBody(BaseModel):
    type: str = Field(min_length=1, max_length=64)
    payload: dict | None = None


class ReoptimizeProposeBody(BaseModel):
    lat: float
    lng: float
    reason: str | None = None


class WhatIfBody(BaseModel):
    customer_name: str
    address: str
    lat: float
    lng: float
    service_duration_min: int = 12
    tw_type: str = "none"
    tw_start: str | None = None
    tw_end: str | None = None
    priority: str = "normal"
    current_lat: float | None = None
    current_lng: float | None = None


class WhatIfOut(BaseModel):
    added_min: int
    new_return_at: str | None
    deadlines_ok: bool
    message_he: str
    binding_names: list[str] = []


class ReoptimizeProposalOut(BaseModel):
    delay_min: int
    savings_min: int
    message_he: str
    sequence_stop_ids: list[int]
    etas: dict[str, str | None] = {}
    return_at: str | None = None
    feasible: bool = True
