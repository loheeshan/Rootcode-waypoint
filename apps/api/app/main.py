from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.auth.router import router as auth_router
from app.core.config import get_settings
from app.delivery.limits import PodBodyLimitMiddleware
from app.delivery.router import router as delivery_router
from app.fleet.operations_router import router as fleet_inputs_router
from app.fleet.router import router as fleet_router
from app.health import router as health_router
from app.loading.router import router as loading_router
from app.orders.dispatcher_router import router as dispatcher_orders_router
from app.orders.router import router as store_orders_router
from app.planning.router import router as plans_router


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(title="Waypoint API", version="0.1.0")
    application.add_middleware(PodBodyLimitMiddleware)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Idempotency-Key",
            "If-Match",
            "If-None-Match",
        ],
        expose_headers=["Location", "ETag"],
    )
    application.include_router(health_router)
    application.include_router(health_router, prefix="/api/v1")
    application.include_router(auth_router, prefix="/api/v1")
    application.include_router(store_orders_router, prefix="/api/v1")
    application.include_router(dispatcher_orders_router, prefix="/api/v1")
    application.include_router(fleet_router, prefix="/api/v1")
    application.include_router(fleet_inputs_router, prefix="/api/v1")
    application.include_router(plans_router, prefix="/api/v1")
    application.include_router(loading_router, prefix="/api/v1")
    application.include_router(delivery_router, prefix="/api/v1")

    @application.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # FastAPI's default payload includes raw input; never echo passwords/tokens.
        return JSONResponse(
            status_code=422,
            content={
                "detail": [
                    {"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]}
                    for error in exc.errors()
                ]
            },
        )

    return application


app = create_app()
