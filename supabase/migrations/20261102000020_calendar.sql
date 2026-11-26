-- Odběr kalendáře (.ics): každý člen týmu má vlastní tajný odkaz.
alter table public.wedding_members add column calendar_token text not null unique default app.random_token(18);
