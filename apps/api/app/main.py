from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.health import router as health_router


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(title="Waypoint API", version="0.1.0")
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    )
    application.include_router(health_router)
    application.include_router(health_router, prefix="/api/v1")
    return application


app = create_app()
