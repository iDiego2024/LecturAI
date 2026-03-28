create type job_status as enum ('pending', 'extracting', 'chunking', 'processing', 'paused', 'failed', 'consolidating', 'completed');
create type chunk_job_status as enum ('pending', 'processing', 'retrying', 'completed', 'failed');

create table book_jobs (
  id uuid default gen_random_uuid() primary key,
  book_id uuid references books(id) on delete cascade not null,
  status job_status default 'pending',
  total_chunks integer default 0,
  processed_chunks integer default 0,
  failed_chunks integer default 0,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table book_chunk_jobs (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references book_jobs(id) on delete cascade not null,
  chunk_index integer not null,
  status chunk_job_status default 'pending',
  retry_count integer default 0,
  error_message text,
  chunk_data jsonb not null, -- contains { content, pageNumber }
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table book_jobs enable row level security;
alter table book_chunk_jobs enable row level security;

-- Policies
create policy "Users can view own book_jobs." on book_jobs for select using (exists (select 1 from books where books.id = book_jobs.book_id and books.user_id = auth.uid()));
create policy "Users can view own book_chunk_jobs." on book_chunk_jobs for select using (exists (select 1 from book_jobs join books on books.id = book_jobs.book_id where book_jobs.id = book_chunk_jobs.job_id and books.user_id = auth.uid()));

-- Triggers for updated_at
create trigger update_book_jobs_updated_at before update on book_jobs for each row execute procedure update_updated_at_column();
create trigger update_book_chunk_jobs_updated_at before update on book_chunk_jobs for each row execute procedure update_updated_at_column();
