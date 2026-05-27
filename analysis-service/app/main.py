from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import analyze
import os


def _origins() -> list[str]:
    raw = os.getenv(
        "ANALYSIS_ALLOWED_ORIGINS",
        "https://vitaloop.today,https://www.vitaloop.today,https://crm.vitaloop.today,http://localhost:5173",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]

app = FastAPI(
    title="Analysis Service",
    description="Medical lab analysis microservice",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "analysis-service"}

# Include routers
app.include_router(
    analyze.router,
    prefix="/api/v1",
    tags=["analysis"]
)
