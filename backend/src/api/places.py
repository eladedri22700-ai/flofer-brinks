from fastapi import APIRouter, Depends

from src.api.deps import get_current_user
from src.models.user import User
from src.schemas.routes import (
    AutocompleteRequest,
    GeocodeRequest,
    PlaceDetailsRequest,
)
from src.services import maps

router = APIRouter(tags=["places"])


@router.post("/places/autocomplete")
async def places_autocomplete(
    body: AutocompleteRequest,
    _user: User = Depends(get_current_user),
) -> list[dict]:
    return await maps.autocomplete(body.query, lat=body.lat, lng=body.lng)


@router.post("/places/details")
async def places_details(
    body: PlaceDetailsRequest,
    _user: User = Depends(get_current_user),
) -> dict:
    return await maps.place_details(body.place_id)


@router.post("/geocode")
async def geocode_address(
    body: GeocodeRequest,
    _user: User = Depends(get_current_user),
) -> dict:
    return await maps.geocode(body.address)
