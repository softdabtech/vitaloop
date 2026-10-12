CREATE TABLE IF NOT EXISTS public.lab_plan_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    source_report_version_id uuid NOT NULL REFERENCES public.report_versions(id) ON DELETE CASCADE,
    test_name text NOT NULL,
    normalized_test_name text NOT NULL,
    test_type text NOT NULL CHECK (test_type IN ('retest', 'new_test')),
    reason text NOT NULL,
    priority text NOT NULL,
    timing_text text,
    status text NOT NULL DEFAULT 'planned' CHECK (status = 'planned'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_lab_plan_items_user_report_test
        UNIQUE (user_id, source_report_version_id, normalized_test_name, test_type)
);

CREATE INDEX IF NOT EXISTS idx_lab_plan_items_user_status
    ON public.lab_plan_items (user_id, status, created_at DESC);
