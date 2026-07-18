from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field


class RouteCreate(BaseModel):
    departure_time: time = time(7, 0)
    break_duration_min: int = 30
    break_window_start: time = time(11, 30)
    break_window_end: time = time(14, 0)
    variance_mode: bool = False
    deadline_buffer_min: int = 10
    vip_weight: float = 1.0


class RouteUpdate(BaseModel):
    departure_time: time | None = None
    break_duration_min: int | None = None
    break_window_start: time | None = None
    break_window_end: time | None = None
    variance_mode: bool | None = None
    deadline_buffer_min: int | None = None


class StopCreate(BaseModel):
    customer_name: str
    address: str
    lat: float | None = None
    lng: float | None = None
    place_id: str | None = None
    category: str = "other"
    priority: str = "normal"
    tw_type: str = "none"
    tw_start: time | None = None
    tw_end: time | None = None
    service_duration_min: int | None = None
    notes: str | None = None
    geocode_confidence: float | None = None


class StopBulkCreate(BaseModel):
    stops: list[StopCreate]


class StopUpdate(BaseModel):
    customer_name: str | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    category: str | None = None
    priority: str | None = None
    tw_type: str | None = None
    tw_start: time | None = None
    tw_end: time | None = None
    service_duration_min: int | None = None
    notes: str | None = None
    locked: bool | None = None
    geocode_confidence: float | None = None


class StopReorder(BaseModel):
    stop_ids: list[int] = Field(min_length=1)


class StopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    route_id: int
    customer_id: int | None
    customer_name: str
    address: str
    lat: float
    lng: float
    sequence_order: int
    locked: bool
    priority: str
    tw_type: str
    tw_start: time | None
    tw_end: time | None
    service_duration_min: int
    service_estimate_source: str
    notes: str | None
    status: str
    eta: datetime | None = None
    actual_arrival: datetime | None = None
    actual_departure: datetime | None = None
    geocode_confidence: float | None = None
    learned_badge: str | None = None
    parking_badge: str | None = None
    parking_lat: float | None = None
    parking_lng: float | None = None
    phone: str | None = None
    exception_code: str | None = None


class RouteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    date: date
    status: str
    departure_time: time
    break_duration_min: int
    break_window_start: time
    break_window_end: time
    deadline_buffer_min: int
    vip_weight: float
    variance_mode: bool
    is_demo: bool = False
    created_at: datetime
    optimized_at: datetime | None = None
    naive_duration_min: int | None = None
    optimized_duration_min: int | None = None
    solver_explanation: dict | None = None
    variance_extra_min: int | None = None
    stops: list[StopOut] = []


class OptimizeRequest(BaseModel):
    resolve_option: str | None = None


class OptimizeOptionOut(BaseModel):
    id: str
    label_he: str


class OptimizeResultOut(BaseModel):
    feasible: bool
    route_id: int | None = None
    sequence_stop_ids: list[int] = []
    etas: dict[str, str | None] = {}
    break_after_stop_id: int | None = None
    break_start: str | None = None
    return_at: str | None = None
    naive_duration_min: int | None = None
    optimized_duration_min: int | None = None
    savings_min: int | None = None
    variance_extra_min: int | None = None
    solver_explanation: dict | None = None
    conflicts: list[dict] = []
    options: list[OptimizeOptionOut] = []
    dropped_names: list[str] = []
    warnings_he: list[str] = []
    duration_min: int | None = None


class ReorderManualRequest(BaseModel):
    stop_ids: list[int] = Field(min_length=1)


class DraftStop(BaseModel):
    customer_name: str
    address: str
    time_note: str | None = None
    lat: float | None = None
    lng: float | None = None
    geocode_confidence: float | None = None
    category: str = "other"


class AutocompleteRequest(BaseModel):
    query: str
    lat: float | None = None
    lng: float | None = None


class PlaceDetailsRequest(BaseModel):
    place_id: str


class GeocodeRequest(BaseModel):
    address: str
