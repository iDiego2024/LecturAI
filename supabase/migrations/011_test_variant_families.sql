do $$
begin
  if to_regclass('public.tests') is null then
    raise exception
      using
        errcode = '42P01',
        message = 'La migracion 011_test_variant_families requiere que exista public.tests.',
        hint = 'Ejecuta primero las migraciones previas del proyecto, especialmente 001_initial_schema.sql y 007_evaluation_upgrades.sql.';
  end if;
end $$;

alter table public.tests
add column if not exists variant_family_id uuid;

update public.tests
set variant_family_id = gen_random_uuid()
where variant_family_id is null;

with base_candidates as (
  select
    variant.id as variant_id,
    base.variant_family_id,
    row_number() over (
      partition by variant.id
      order by base.created_at asc, base.id asc
    ) as candidate_rank
  from public.tests variant
  join public.tests base
    on base.user_id = variant.user_id
   and base.book_id = variant.book_id
   and base.variant_label is null
   and regexp_replace(base.title, '\s+-\s+Variante\s+[A-Z0-9-]+$', '', 'i') =
       regexp_replace(variant.title, '\s+-\s+Variante\s+[A-Z0-9-]+$', '', 'i')
  where variant.variant_label is not null
)
update public.tests t
set variant_family_id = base_candidates.variant_family_id
from base_candidates
where t.id = base_candidates.variant_id
  and base_candidates.candidate_rank = 1;

alter table public.tests
alter column variant_family_id set default gen_random_uuid(),
alter column variant_family_id set not null;

create index if not exists tests_variant_family_idx
on public.tests (variant_family_id, created_at asc);
