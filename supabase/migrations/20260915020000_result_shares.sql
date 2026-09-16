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
