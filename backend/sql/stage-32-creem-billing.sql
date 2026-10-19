-- VITALOOP Stage 32: Creem as the single active billing provider.
-- This migration preserves legacy provider columns for historical records,
-- but all new checkout and webhook state is stored in Creem-specific fields.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS creem_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS creem_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS creem_product_id TEXT;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_billing_provider_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_billing_provider_check
  CHECK (billing_provider IN ('manual', 'stripe', 'wayforpay', 'creem'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_creem_subscription_id
  ON public.subscriptions(creem_subscription_id)
  WHERE creem_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_creem_customer_id
  ON public.subscriptions(creem_customer_id)
  WHERE creem_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.creem_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- This table is written only by the backend's service-role client.  Keep
-- webhook IDs and provider activity out of Supabase's public Data API.
ALTER TABLE public.creem_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.creem_webhook_events FROM anon, authenticated;

COMMENT ON TABLE public.creem_webhook_events IS
  'Processed Creem webhook IDs used for audit and idempotent delivery handling.';
