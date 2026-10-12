ALTER TABLE public.intervention_events
    DROP CONSTRAINT IF EXISTS intervention_events_action_type_check;

ALTER TABLE public.intervention_events
    ADD CONSTRAINT intervention_events_action_type_check
    CHECK (
        action_type IS NULL
        OR action_type IN ('retest', 'protocol_action')
    );
