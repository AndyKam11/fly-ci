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

alter table ratings add column if not exists levels jsonb, add column if not exists n_active int not null default 0;

-- hall of rot upvotes
alter table ratings add column if not exists votes int not null default 0;
create index if not exists ratings_votes on ratings (votes desc, fly_score desc);
create or replace function increment_votes(rid bigint) returns int language sql security definer as $$
  update ratings set votes = votes + 1 where id = rid returning votes;
$$;
-- Existing rows have no consent and remain private. Apply before deploying the API.
alter table ratings add column if not exists is_public boolean not null default false;
alter table ratings add column if not exists publish_token_hash text;
create index if not exists ratings_public_rank on ratings (votes desc, fly_score desc, created_at desc) where is_public;

-- Private results cannot be voted on, even if someone guesses their ID.
create or replace function increment_votes(rid bigint) returns int language sql security definer set search_path = public as $$
  update ratings set votes = votes + 1 where id = rid and is_public = true returning votes;
$$;

-- Explicitly shared result images only. Original post text and Hall consent stay in ratings.
create table if not exists result_shares (
  id uuid primary key,
  rating_id bigint not null unique references ratings(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  image_base64 text not null check (length(image_base64) <= 2000000),
  created_at timestamptz not null default now()
);
alter table result_shares enable row level security;
revoke all on result_shares from anon, authenticated;
grant select, insert on result_shares to service_role;
