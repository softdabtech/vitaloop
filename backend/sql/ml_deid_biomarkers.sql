-- SQL: Функция для получения обезличенных данных для ML
create or replace function get_biomarkers_with_profile()
returns table (
    name text,
    value float8,
    unit text,
    status text,
    ref_low float8,
    ref_high float8,
    category text,
    created_at timestamptz,
    age int,
    sex text
) as $$
    select b.name, b.value, b.unit, b.status, b.ref_low, b.ref_high, b.category, b.created_at,
           u.age, u.sex
    from biomarkers b
    join users u on u.id = b.user_id
    where b.value is not null and u.age is not null and u.sex is not null
$$ language sql stable;
