-- Vlastní otázky v RSVP (např. „Pojedete autobusem?“, „Hlavní jídlo“).

create table public.rsvp_questions (
  id           uuid primary key default gen_random_uuid(),
  wedding_id   uuid not null references public.weddings (id) on delete cascade,
  label        jsonb not null,                       -- {"cs": "...", "en": "..."}
  help         jsonb not null default '{}'::jsonb,
  kind         text not null check (kind in ('text', 'choice', 'yesno')),
  options      jsonb not null default '[]'::jsonb,   -- [{"id": "a1", "cs": "...", "en": "..."}]
  scope        text not null default 'household' check (scope in ('household', 'guest')),
  required     boolean not null default false,
  only_coming  boolean not null default true,        -- ptát se jen těch, kdo přijdou
  event_id     uuid references public.events (id) on delete cascade, -- jen pozvaní na tuto událost
  sort         int not null default 0,
  created_at   timestamptz not null default now(),
  check (jsonb_typeof(options) = 'array'),
  check (kind <> 'choice' or jsonb_array_length(options) between 2 and 12)
);
create index on public.rsvp_questions (wedding_id, sort);

create table public.rsvp_answers (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  question_id   uuid not null references public.rsvp_questions (id) on delete cascade,
  household_id  uuid not null references public.households (id) on delete cascade,
  guest_id      uuid references public.guests (id) on delete cascade,
  value         text not null check (char_length(value) <= 500),
  updated_at    timestamptz not null default now()
);
create unique index rsvp_answers_household on public.rsvp_answers (question_id, household_id) where guest_id is null;
create unique index rsvp_answers_guest on public.rsvp_answers (question_id, guest_id) where guest_id is not null;
create index on public.rsvp_answers (household_id);

alter table public.rsvp_questions enable row level security;
alter table public.rsvp_answers enable row level security;
create policy rsvp_questions_read on public.rsvp_questions for select using (app.can_read(wedding_id, 'guests'));
create policy rsvp_questions_write on public.rsvp_questions for all using (app.can_write(wedding_id, 'guests')) with check (app.can_write(wedding_id, 'guests'));
create policy rsvp_answers_read on public.rsvp_answers for select using (app.can_read(wedding_id, 'guests'));
create policy rsvp_answers_write on public.rsvp_answers for all using (app.can_write(wedding_id, 'guests')) with check (app.can_write(wedding_id, 'guests'));
