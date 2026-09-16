-- Existing rows have no consent and remain private. Apply before deploying the API.
alter table ratings add column if not exists is_public boolean not null default false;
alter table ratings add column if not exists publish_token_hash text;
create index if not exists ratings_public_rank on ratings (votes desc, fly_score desc, created_at desc) where is_public;

-- Private results cannot be voted on, even if someone guesses their ID.
create or replace function increment_votes(rid bigint) returns int language sql security definer set search_path = public as $$
  update ratings set votes = votes + 1 where id = rid and is_public = true returning votes;
$$;
