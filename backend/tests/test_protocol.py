import pytest
from app.services.affiliate import build_iherb_url


def test_build_iherb_url():
    url = build_iherb_url("Vitamin D3 5000 IU")
    assert "iherb.com" in url
    assert "kw=" in url
    assert "rcode=" in url
