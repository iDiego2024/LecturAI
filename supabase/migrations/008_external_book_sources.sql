-- External official sources + imports (initial production-ready schema)

create table if not exists external_sources (
  id uuid default gen_random_uuid() primary key,
  key text not null unique,
  name text not null,
  base_url text not null,
  is_enabled boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists external_resources (
  id uuid default gen_random_uuid() primary key,
  source_id uuid references external_sources(id) on delete cascade not null,
  external_resource_key text not null,
  title text not null,
  author text,
  description text,
  source_url text not null,
  download_url text,
  file_type text default 'unknown' not null, -- pdf | epub | unknown
  downloadable boolean default false not null,
  license_label text,
  license_url text,
  metadata_json jsonb,
  fetched_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (source_id, external_resource_key)
);

create table if not exists book_imports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  book_id uuid references books(id) on delete set null,
  source_id uuid references external_sources(id) on delete restrict not null,
  external_resource_id uuid references external_resources(id) on delete set null,
  import_status text not null, -- queued | downloading | validating | storing | ingesting | completed | failed
  original_url text,
  resolved_download_url text,
  storage_path text,
  mime_type text,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table external_sources enable row level security;
alter table external_resources enable row level security;
alter table book_imports enable row level security;

create policy "External sources are viewable by everyone." on external_sources
for select using (true);

create policy "External resources are viewable by everyone." on external_resources
for select using (true);

create policy "Users can view own book imports." on book_imports
for select using (auth.uid() = user_id);

create policy "Users can insert own book imports." on book_imports
for insert with check (auth.uid() = user_id);

create policy "Users can update own book imports." on book_imports
for update using (auth.uid() = user_id);

create index if not exists external_resources_title_idx on external_resources (title);
create index if not exists book_imports_user_created_idx on book_imports (user_id, created_at desc);

create trigger update_book_imports_updated_at
before update on book_imports
for each row execute procedure update_updated_at_column();

alter table books
add column if not exists source_type text default 'upload' not null,
add column if not exists source_reference jsonb;

-- Seed initial sources (safe defaults; can be toggled via is_enabled)
insert into external_sources (key, name, base_url, is_enabled)
values
  ('mineduc_biblioteca_digital', 'Biblioteca Digital MINEDUC', 'https://bibliotecadigital.mineduc.cl', true),
  ('curriculum_cra', 'Lecturas sugeridas / CRA (MINEDUC)', 'https://www.curriculumnacional.cl', true),
  ('bde', 'Biblioteca Digital Escolar (BDE)', 'https://bdescolar.mineduc.cl', false)
on conflict (key) do update
set name = excluded.name,
    base_url = excluded.base_url;
