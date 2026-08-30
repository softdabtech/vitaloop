create table if not exists public.knowledge_domain_registry (
    id uuid primary key default gen_random_uuid(),
    key text not null unique,
    label text not null,
    marker_aliases text[] not null default '{}',
    symptom_aliases text[] not null default '{}',
    required_markers text[] not null default '{}',
    retest_markers text[] not null default '{}',
    protocol_sections text[] not null default '{}',
    expected_timeline text not null default '',
    evidence_level text not null default 'clinical_context',
    requires_doctor_if_flagged boolean not null default false,
    sort_order integer not null default 100,
    active boolean not null default true,
    governance_status text not null default 'draft',
    version text not null default 'managed_v1',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint knowledge_domain_registry_governance_status_check
        check (governance_status in ('draft', 'reviewed', 'active', 'deprecated'))
);

create index if not exists idx_knowledge_domain_registry_active
    on public.knowledge_domain_registry (active, governance_status, sort_order);

alter table public.knowledge_domain_registry enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'knowledge_domain_registry'
          and policyname = 'knowledge_domain_registry_service_role_all'
    ) then
        create policy knowledge_domain_registry_service_role_all
            on public.knowledge_domain_registry
            for all
            to service_role
            using (true)
            with check (true);
    end if;
end $$;

create or replace function public.set_knowledge_domain_registry_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_knowledge_domain_registry_updated_at on public.knowledge_domain_registry;
create trigger trg_knowledge_domain_registry_updated_at
    before update on public.knowledge_domain_registry
    for each row
    execute function public.set_knowledge_domain_registry_updated_at();
