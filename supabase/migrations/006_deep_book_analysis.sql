create table book_source_texts (
  book_id uuid references books(id) on delete cascade not null primary key,
  extracted_text text not null,
  normalized_text text not null,
  extraction_metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table book_chapters (
  id uuid default gen_random_uuid() primary key,
  book_id uuid references books(id) on delete cascade not null,
  chapter_number integer not null,
  title text not null,
  start_page integer,
  end_page integer,
  summary text not null,
  key_events jsonb,
  key_characters jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (book_id, chapter_number)
);

create table book_character_relationships (
  id uuid default gen_random_uuid() primary key,
  book_id uuid references books(id) on delete cascade not null,
  source_character text not null,
  target_character text not null,
  relationship_type text,
  description text not null,
  evolution text,
  importance_score integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table book_source_texts enable row level security;
alter table book_chapters enable row level security;
alter table book_character_relationships enable row level security;

create policy "Users can view source texts of own books." on book_source_texts
for select using (
  exists (
    select 1 from books
    where books.id = book_source_texts.book_id and books.user_id = auth.uid()
  )
);

create policy "Users can view chapters of own books." on book_chapters
for select using (
  exists (
    select 1 from books
    where books.id = book_chapters.book_id and books.user_id = auth.uid()
  )
);

create policy "Users can view character relationships of own books." on book_character_relationships
for select using (
  exists (
    select 1 from books
    where books.id = book_character_relationships.book_id and books.user_id = auth.uid()
  )
);

create trigger update_book_source_texts_updated_at
before update on book_source_texts
for each row execute procedure update_updated_at_column();
