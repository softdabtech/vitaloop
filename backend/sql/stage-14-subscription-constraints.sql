-- Stage 14: subscription constraints hardening
-- Run duplicate checks before applying unique indexes.

SELECT user_id, COUNT(*)
FROM public.subscriptions
WHERE status = 'active'
  AND plan_name IN ('core', 'personal')
  AND cancel_at_period_end = false
GROUP BY user_id
HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_paid_per_user
ON public.subscriptions(user_id)
WHERE status = 'active'
  AND plan_name IN ('core', 'personal')
  AND cancel_at_period_end = false;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_unique
ON public.subscriptions(stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;
