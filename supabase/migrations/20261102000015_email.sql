-- E-maily: upozornění na úkoly (jen jednou na úkol), rychlé dohledání odeslaných e-mailů domácnosti.

alter table public.tasks add column reminded_at timestamptz;

-- Změna termínu nebo přiřazení úkolu → upozornění se pošle znovu.
create or replace function app.reset_task_reminder()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.due_date is distinct from old.due_date
     or new.assignee_member_id is distinct from old.assignee_member_id
     or new.assignee_email is distinct from old.assignee_email then
    new.reminded_at := null;
  end if;
  return new;
end;
$$;
create trigger tasks_reset_reminder before update on public.tasks
  for each row execute function app.reset_task_reminder();

create index email_log_household_template on public.email_log (household_id, template, created_at desc);
create index tasks_due_open on public.tasks (due_date) where done_at is null and reminded_at is null;
