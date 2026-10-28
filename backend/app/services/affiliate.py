from urllib.parse import urlencode
from app.config import settings


def build_iherb_url(search_query: str) -> str:
    params = {"kw": search_query, "rcode": settings.iherb_rcode}
    return f"{settings.iherb_base_url}?{urlencode(params)}"
