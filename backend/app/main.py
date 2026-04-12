from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from app.config import settings
from app.errors import http_exception_handler, validation_exception_handler
from app.routers import analyze, protocol, progress, health, symptoms, stripe_router, admin
from app.routers import (
    analyze, protocol, progress, health, symptoms, stripe_router, admin,
    profile, complaints, checkins, timeline, insights, red_flags, notifications,
)

app = FastAPI(
    title="VITALOOP API",
    version="1.0.0",
    description="Biohacking-as-a-Service backend",
)

app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
app.include_router(protocol.router, prefix="/protocol", tags=["protocol"])
app.include_router(progress.router, prefix="/progress", tags=["progress"])
app.include_router(symptoms.router, prefix="/symptoms", tags=["symptoms"])
app.include_router(stripe_router.router, prefix="/stripe", tags=["stripe"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(profile.router, prefix="/profile", tags=["profile"])
app.include_router(complaints.router, prefix="/complaints", tags=["complaints"])
app.include_router(checkins.router, prefix="/checkins", tags=["checkins"])
app.include_router(timeline.router, prefix="/timeline", tags=["timeline"])
app.include_router(insights.router, prefix="/insights", tags=["insights"])
app.include_router(red_flags.router, prefix="/red-flags", tags=["red-flags"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
