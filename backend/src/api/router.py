from fastapi import APIRouter

from src.api import auth, customers, feedback, health, live, phase5, places, push, routes, settings

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(settings.router)
api_router.include_router(push.router)
api_router.include_router(feedback.router)
api_router.include_router(places.router)
api_router.include_router(customers.router)
api_router.include_router(routes.router)
api_router.include_router(live.router)
api_router.include_router(phase5.router)
