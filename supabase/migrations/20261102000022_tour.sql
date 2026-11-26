-- Průvodce aplikací: kdy ho uživatel dokončil nebo přeskočil (zobrazí se jen poprvé).
alter table public.profiles add column tour_done_at timestamptz;
