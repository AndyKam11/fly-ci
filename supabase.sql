-- Run once in the Supabase SQL editor.
create table if not exists ratings (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  post text not null,
  bait_score int not null,
  bait text[] not null default '{}',
  rate int not null,
  run int not null,
  mn9 int not null,
  fly_score int not null,
  ua text,
  country text
);
alter table ratings enable row level security;   -- no anon access; the API uses the service key
create index if not exists ratings_created_at on ratings (created_at desc);
create index if not exists ratings_fly_score on ratings (fly_score desc);
