-- Constellation: domains, stars (milestones) and prerequisite links.
-- Run this once in the Supabase SQL editor (or with `supabase db push`).

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.stars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  domain_id uuid not null,
  secondary_domain_id uuid,
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  tier text not null default 'minor' check (tier in ('major', 'minor')),
  achieved_at timestamptz,
  current_value double precision check (current_value >= 0),
  target_value double precision check (target_value > 0),
  unit text check (char_length(unit) <= 12),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (secondary_domain_id is distinct from domain_id),
  -- The composite keys guarantee a star only points to domains of the same user.
  foreign key (domain_id, user_id)
    references public.domains (id, user_id) on delete cascade,
  foreign key (secondary_domain_id, user_id)
    references public.domains (id, user_id) on delete set null (secondary_domain_id)
);

create table public.star_prerequisites (
  star_id uuid not null,
  prerequisite_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (star_id, prerequisite_id),
  check (star_id <> prerequisite_id),
  -- Both ends of a link must belong to the same user.
  foreign key (star_id, user_id)
    references public.stars (id, user_id) on delete cascade,
  foreign key (prerequisite_id, user_id)
    references public.stars (id, user_id) on delete cascade
);

create index domains_user_idx on public.domains (user_id, position);
create index stars_user_idx on public.stars (user_id, created_at);
create index stars_domain_idx on public.stars (domain_id);
create index star_prerequisites_user_idx on public.star_prerequisites (user_id);
create index star_prerequisites_prerequisite_idx on public.star_prerequisites (prerequisite_id);

-- Row level security: each user only sees and edits their own sky.
alter table public.domains enable row level security;
alter table public.stars enable row level security;
alter table public.star_prerequisites enable row level security;

create policy "own domains" on public.domains
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own stars" on public.stars
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own prerequisites" on public.star_prerequisites
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.domains to authenticated;
grant select, insert, update, delete on public.stars to authenticated;
grant select, insert, update, delete on public.star_prerequisites to authenticated;
