from .embedded import router as partners_embedded_router
from .events import router as partners_events_router
from .gateway import router as partners_gateway_router
from .insights import router as partners_insights_router
from .results import router as partners_results_router

__all__ = [
    "partners_embedded_router",
    "partners_events_router",
    "partners_gateway_router",
    "partners_insights_router",
    "partners_results_router",
]
