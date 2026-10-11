-- VITALOOP Stage 34: idempotent protocol-action completion.
-- Retest uniqueness is intentionally unchanged.

CREATE UNIQUE INDEX IF NOT EXISTS uq_intervention_events_protocol_action
  ON public.intervention_events(user_id, source_report_version_id, related_recommendation_id)
  WHERE action_type = 'protocol_action'
    AND source_report_version_id IS NOT NULL
    AND related_recommendation_id IS NOT NULL;