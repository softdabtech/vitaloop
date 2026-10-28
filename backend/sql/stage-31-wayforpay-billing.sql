-- ============================================================
-- VITALOOP Stage 31: WayForPay billing columns
-- ============================================================
--
-- The subscriptions table (stage-5-crm-tables.sql) was built around a
-- Stripe integration that was never wired up on the backend (no live
-- endpoint ever reads/writes stripe_subscription_id -- confirmed dead).
-- WayForPay is the UA cabinet's first real payment provider. Rather than
-- repurpose the stripe_* columns (wrong semantics, and
-- stripe_subscription_id has a UNIQUE constraint that shouldn't apply to
-- WayForPay order references), this adds provider-scoped columns and
-- leaves the stripe_* ones untouched for whatever eventually uses them.
--
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF
-- NOT EXISTS throughout, matching this repo's existing stage-N convention).

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_provider TEXT DEFAULT 'manual'
    CHECK (billing_provider IN ('manual', 'stripe', 'wayforpay')),
  ADD COLUMN IF NOT EXISTS wayforpay_order_reference TEXT,
  ADD COLUMN IF NOT EXISTS wayforpay_rec_token TEXT,
  ADD COLUMN IF NOT EXISTS wayforpay_regular_mode TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_wayforpay_order_ref
  ON public.subscriptions(wayforpay_order_reference)
  WHERE wayforpay_order_reference IS NOT NULL;

COMMENT ON COLUMN public.subscriptions.billing_provider IS
  'Which payment provider owns this subscription row: manual (email-activated, the only path before this stage), stripe (dead code path, never live), or wayforpay (UA cabinet checkout, stage 31).';
COMMENT ON COLUMN public.subscriptions.wayforpay_order_reference IS
  'orderReference from the WayForPay Purchase request that created/renewed this subscription -- encodes the user_id, see wayforpay_service.build_order_reference().';
COMMENT ON COLUMN public.subscriptions.wayforpay_rec_token IS
  'recToken WayForPay returns on approved payments -- the card token needed to manage (suspend/resume/cancel) the recurring charge later.';
COMMENT ON COLUMN public.subscriptions.wayforpay_regular_mode IS
  'regularMode sent on the originating Purchase request (monthly/yearly) -- which WayForPay recurring schedule this subscription is on.';
