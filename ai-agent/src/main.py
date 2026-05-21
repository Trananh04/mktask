import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .schemas import AnalyzeRequest, AnalyzeResponse
from .tools import analyze_workload


def create_app() -> FastAPI:
    app = FastAPI(title="GenAI Project Manager Agent", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/analyze", response_model=AnalyzeResponse)
    def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
        return analyze_workload(request)

    return app


def _cors_origins() -> list[str]:
    configured = os.getenv("CORS_ORIGIN") or os.getenv("FRONTEND_URL")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return ["http://localhost:3000", "http://localhost:3001"]


app = create_app()
