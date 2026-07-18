from pydantic import BaseModel, ConfigDict, Field


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: str
    lat: float
    lng: float
    category: str
    service_duration_min: int
    service_estimate_source: str
    service_sample_count: int
    geocode_confidence: float | None = None


class AddFromCustomersBody(BaseModel):
    customer_ids: list[int] = Field(min_length=1, max_length=40)
