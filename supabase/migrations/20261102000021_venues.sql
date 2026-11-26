-- Výběr místa konání: porovnání variant (cena, kapacita, termíny, plusy a minusy).
create table public.venue_options (
  id           uuid primary key default gen_random_uuid(),
  wedding_id   uuid not null references public.weddings (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  location     text,
  url          text,
  contact      text,
  price        numeric(12, 2) check (price is null or price >= 0),
  price_note   text,
  capacity     int check (capacity is null or capacity between 1 and 5000),
  dates        text,             -- volné termíny, jak je místo nabízí
  pros         text,
  cons         text,
  notes        text,
  rating       int check (rating is null or rating between 1 and 5),
  status       text not null default 'considering' check (status in ('considering', 'visited', 'booked', 'rejected')),
  visit_at     timestamptz,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
create index on public.venue_options (wedding_id, sort);
alter table public.venue_options enable row level security;
create policy venue_options_read on public.venue_options for select using (app.can_read(wedding_id, 'checklist'));
create policy venue_options_write on public.venue_options for all using (app.can_write(wedding_id, 'checklist')) with check (app.can_write(wedding_id, 'checklist'));
