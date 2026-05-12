def is_stripe_price_configured(*price_ids: str | None) -> bool:
    """Return True when at least one non-empty Stripe price ID is configured."""
    return any((price_id or "").strip() for price_id in price_ids)