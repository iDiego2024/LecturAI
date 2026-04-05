create index if not exists external_resources_source_idx
on external_resources (source_id);

create index if not exists external_resources_source_key_idx
on external_resources (source_id, external_resource_key);

create index if not exists book_imports_source_idx
on book_imports (source_id);

create index if not exists book_imports_status_idx
on book_imports (import_status);

do $$
begin
  if exists (
    select 1 from external_sources
    where key = 'curriculum_cra'
  ) and not exists (
    select 1 from external_sources
    where key = 'curriculum_cra_catalog'
  ) then
    update external_sources
    set
      key = 'curriculum_cra_catalog',
      name = 'Catálogo Currículum / CRA (MINEDUC)',
      base_url = 'https://www.curriculumnacional.cl'
    where key = 'curriculum_cra';
  else
    insert into external_sources (key, name, base_url, is_enabled)
    values (
      'curriculum_cra_catalog',
      'Catálogo Currículum / CRA (MINEDUC)',
      'https://www.curriculumnacional.cl',
      true
    )
    on conflict (key) do update
    set
      name = excluded.name,
      base_url = excluded.base_url;

    update external_sources
    set is_enabled = false
    where key = 'curriculum_cra';
  end if;
end $$;

insert into external_sources (key, name, base_url, is_enabled)
values
  ('memoria_chilena', 'Memoria Chilena', 'https://www.memoriachilena.gob.cl', true),
  ('project_gutenberg', 'Project Gutenberg', 'https://www.gutenberg.org', true)
on conflict (key) do update
set
  name = excluded.name,
  base_url = excluded.base_url;
