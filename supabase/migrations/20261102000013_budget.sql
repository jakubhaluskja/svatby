-- Rozpočet: noci u pokojů, platby jako úkoly v checklistu, soubory dodavatelů.

-- Počet nocí pokoje (cena je za noc); pokoje placené párem jdou do rozpočtu.
alter table public.rooms add column nights int not null default 1 check (nights between 1 and 14);

-- Kategorie úkolů: platby.
alter table public.tasks drop constraint if exists tasks_category_check;
alter table public.tasks add constraint tasks_category_check
  check (category in ('planning', 'guests', 'vendors', 'attire', 'ceremony', 'web', 'day', 'payments'));

-- Platba s termínem = úkol v checklistu. Zaplacení odškrtne úkol a naopak.
create or replace function app.sync_payment_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  item_name text;
  v_title text;
begin
  if tg_op = 'DELETE' then
    delete from public.tasks where budget_payment_id = old.id;
    return old;
  end if;

  select name into item_name from public.budget_items where id = new.item_id;
  v_title := 'Zaplatit: ' || coalesce(nullif(new.label, ''), 'platba') || ' – ' || coalesce(item_name, 'položka rozpočtu');

  if new.due_date is null then
    delete from public.tasks where budget_payment_id = new.id;
    return new;
  end if;

  if exists (select 1 from public.tasks where budget_payment_id = new.id) then
    update public.tasks
       set title = v_title,
           due_date = new.due_date,
           done_at = case when new.paid_at is null then null else coalesce(done_at, now()) end
     where budget_payment_id = new.id
       and (tasks.title is distinct from v_title
            or due_date is distinct from new.due_date
            or (done_at is null) <> (new.paid_at is null));
  else
    insert into public.tasks (wedding_id, title, due_date, done_at, budget_payment_id, source, category, sort)
    values (new.wedding_id, v_title, new.due_date, case when new.paid_at is null then null else now() end, new.id, 'system', 'payments', 500);
  end if;
  return new;
end;
$$;

create trigger budget_payments_task after insert or update or delete on public.budget_payments
  for each row execute function app.sync_payment_task();

-- Odškrtnutí úkolu platby v checklistu označí platbu jako zaplacenou (a zrušení naopak).
create or replace function app.sync_task_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.budget_payment_id is not null and (new.done_at is null) <> (old.done_at is null) then
    update public.budget_payments
       set paid_at = case when new.done_at is null then null else coalesce(paid_at, (new.done_at at time zone 'Europe/Prague')::date) end
     where id = new.budget_payment_id
       and (paid_at is null) <> (new.done_at is null);
  end if;
  return new;
end;
$$;

create trigger tasks_payment_sync after update of done_at on public.tasks
  for each row execute function app.sync_task_payment();

-- Název položky se propíše do úkolů jejích plateb.
create or replace function app.sync_item_tasks()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.name is distinct from old.name then
    update public.budget_payments set label = label where item_id = new.id;
  end if;
  return new;
end;
$$;

create trigger budget_items_task_titles after update of name on public.budget_items
  for each row execute function app.sync_item_tasks();

-- Smlouvy a faktury dodavatelů: soukromé úložiště, cesta <wedding_id>/<vendor_id>/<soubor>.
insert into storage.buckets (id, name, public, file_size_limit)
values ('vendor-files', 'vendor-files', false, 20971520)
on conflict (id) do nothing;

create policy vendor_files_read on storage.objects for select to authenticated
  using (bucket_id = 'vendor-files' and app.can_read(app.storage_wedding(name), 'budget'));
create policy vendor_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'vendor-files' and app.can_write(app.storage_wedding(name), 'budget'));
create policy vendor_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'vendor-files' and app.can_write(app.storage_wedding(name), 'budget'));
