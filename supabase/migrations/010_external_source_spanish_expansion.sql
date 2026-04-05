alter table external_sources
add column if not exists is_institutional boolean default true not null;

alter table external_resources
add column if not exists language text,
add column if not exists available_formats jsonb,
add column if not exists parser_version text,
add column if not exists last_checked_at timestamp with time zone;

update external_sources
set is_institutional = true
where key in (
  'mineduc_biblioteca_digital',
  'memoria_chilena',
  'bne_digital',
  'curriculum_cra_catalog'
);

update external_sources
set is_institutional = false
where key in (
  'project_gutenberg',
  'wikisource_es',
  'cervantes_virtual',
  'elejandria'
);

insert into external_sources (key, name, base_url, is_enabled, is_institutional)
values
  ('wikisource_es', 'Wikisource ES', 'https://es.wikisource.org', true, false),
  ('cervantes_virtual', 'Biblioteca Virtual Miguel de Cervantes', 'https://www.cervantesvirtual.com', true, false),
  ('bne_digital', 'Biblioteca Digital Hispánica / BNE Digital', 'https://bnedigital.bne.es', true, true),
  ('elejandria', 'Elejandría', 'https://www.elejandria.com', true, false)
on conflict (key) do update
set
  name = excluded.name,
  base_url = excluded.base_url,
  is_institutional = excluded.is_institutional;

create index if not exists external_resources_language_idx
on external_resources (language);

create index if not exists external_resources_last_checked_idx
on external_resources (last_checked_at desc);
