begin;

alter table if exists public.knowledge_rules
  add column if not exists copied_from_rule_id uuid references public.knowledge_rules(id) on delete set null,
  add column if not exists copied_from_version text;

create index if not exists idx_knowledge_rules_copied_from_rule_id
  on public.knowledge_rules(copied_from_rule_id);

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'knowledge_rules'
      and constraint_name = 'knowledge_rules_key_key'
      and constraint_type = 'UNIQUE'
  ) then
    alter table public.knowledge_rules
      drop constraint knowledge_rules_key_key;
  end if;
end
$$;

create unique index if not exists idx_knowledge_rules_key_version_unique
  on public.knowledge_rules(key, version);

commit;
