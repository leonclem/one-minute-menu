-- Log table for per-user upload counting (monthlyUploads enforcement)
create table if not exists uploads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  menu_id uuid references public.menus(id) on delete cascade,
  file_url text not null,
  created_at timestamp with time zone default now()
);

alter table uploads enable row level security;
create policy "Users can view own uploads" on uploads
  for select using (auth.uid() = user_id);
create policy "Users can insert own uploads" on uploads
  for insert with check (auth.uid() = user_id);


