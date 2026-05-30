PARTNER_RESULT_STATUSES = {
    "received",
    "normalized",
    "processed",
    "failed",
    "duplicate",
}

PARTNER_EVENT_TYPES = {
    "result_received",
    "result_normalized",
    "insight_generated",
    "embedded_view_opened",
    "recommendation_clicked",
    "add_to_cart_clicked",
    "order_completed",
    "retest_completed",
}

PARTNER_API_SCOPES = {
    "results:write",
    "results:read",
    "embedded:create",
    "events:write",
}

# Embedded token policy for Smartlab MVP:
# token is short-lived and reusable until expiry (not one-time/consumable).
EMBEDDED_TOKEN_POLICY = "multi_use_short_session"
