begin;

alter table if exists public.knowledge_rules
  add column if not exists copied_from_rule_id uuid references public.knowledge_rules(id) on delete set null,
  add column if not exists copied_from_version text;

create index if not exists idx_knowledge_rules_copied_from_rule_id
  on public.knowledge_rules(copied_from_rule_id);

commit;
