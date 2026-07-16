from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from infyro_api.routes import agents, alerts, auth, catalog, settings as settings_routes
from infyro_db.settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Infyro", version="0.1.0", docs_url="/docs")

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(HTTPException)
    async def http_exc(_: Request, exc: HTTPException) -> JSONResponse:
        if isinstance(exc.detail, dict) and "error" in exc.detail:
            return JSONResponse(status_code=exc.status_code, content=exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": str(exc.detail), "code": "http_error"},
        )

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"error": "Something went wrong on our side. Try again.", "code": "internal"},
        )

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "service": "infyro-api"}

    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(agents.router, prefix="/agents", tags=["agents"])
    app.include_router(catalog.router, prefix="/catalog", tags=["catalog"])
    app.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
    app.include_router(settings_routes.router, prefix="/settings", tags=["settings"])
    return app


app = create_app()


def run() -> None:
    import uvicorn

    s = get_settings()
    uvicorn.run("infyro_api.main:app", host=s.api_host, port=s.api_port, reload=False)


if __name__ == "__main__":
    run()
