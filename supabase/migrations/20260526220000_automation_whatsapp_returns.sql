-- DentalFlow - automações (WhatsApp + Retornos)

alter table public.clinics
  add column if not exists whatsapp_enabled boolean not null default false,
  add column if not exists whatsapp_auto_confirm boolean not null default false,
  add column if not exists whatsapp_auto_cancel boolean not null default false,
  add column if not exists whatsapp_cancel_template text not null default 'Olá, {nome}! Sua consulta em {data} às {hora} foi cancelada. Se precisar reagendar, responda esta mensagem.',
  add column if not exists whatsapp_return_template text not null default 'Olá, {nome}! Seu retorno está previsto para {data}. Se quiser agendar, responda esta mensagem.',
  add column if not exists return_enabled boolean not null default true,
  add column if not exists return_default_days int not null default 180,
  add column if not exists return_reminder_enabled boolean not null default false,
  add column if not exists return_reminder_days_before int not null default 3;

alter table public.procedures
  add column if not exists create_return_on_complete boolean not null default true,
  add column if not exists return_days int;

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  patient_id uuid references public.patients (id) on delete set null,
  kind text not null check (kind in ('confirm','cancel','manual','return_reminder')),
  to_phone text not null,
  message text not null,
  status text not null check (status in ('queued','sent','failed')) default 'queued',
  provider_response jsonb,
  error text,
  created_at timestamptz not null default now()
);

alter table public.whatsapp_messages enable row level security;

drop policy if exists whatsapp_messages_select_same_clinic on public.whatsapp_messages;

create policy whatsapp_messages_select_same_clinic
on public.whatsapp_messages
for select
to authenticated
using (clinic_id = public.current_clinic_id());

create unique index if not exists return_controls_unique
on public.return_controls (clinic_id, patient_id, procedure_id);

create or replace function public.compute_next_return_date(
  p_clinic_id uuid,
  p_procedure_id uuid,
  p_completed_on date
)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select
    (p_completed_on + make_interval(days => coalesce(pr.return_days, c.return_default_days)))::date
  from public.clinics c
  left join public.procedures pr on pr.id = p_procedure_id
  where c.id = p_clinic_id
$$;

revoke all on function public.compute_next_return_date(uuid, uuid, date) from public;
grant execute on function public.compute_next_return_date(uuid, uuid, date) to authenticated;

create or replace function public.handle_appointment_completed_return()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_proc_enabled boolean;
  v_next date;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  if new.procedure_id is null then
    return new;
  end if;

  select c.return_enabled into v_enabled
  from public.clinics c
  where c.id = new.clinic_id;

  if coalesce(v_enabled, true) is not true then
    return new;
  end if;

  select pr.create_return_on_complete into v_proc_enabled
  from public.procedures pr
  where pr.id = new.procedure_id;

  if coalesce(v_proc_enabled, true) is not true then
    return new;
  end if;

  v_next := public.compute_next_return_date(new.clinic_id, new.procedure_id, (new.start_time at time zone 'utc')::date);

  insert into public.return_controls (clinic_id, patient_id, procedure_id, last_visit, next_return_date, reminder_sent, notes)
  values (new.clinic_id, new.patient_id, new.procedure_id, (new.start_time at time zone 'utc')::date, v_next, false, null)
  on conflict (clinic_id, patient_id, procedure_id) do update
    set last_visit = excluded.last_visit,
        next_return_date = excluded.next_return_date,
        reminder_sent = false,
        notes = excluded.notes;

  return new;
end;
$$;

drop trigger if exists appointments_generate_return on public.appointments;
create trigger appointments_generate_return
after update of status on public.appointments
for each row
execute function public.handle_appointment_completed_return();

create or replace function public.backfill_return_controls(p_since date default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count int := 0;
  v_next date;
begin
  for r in
    select a.clinic_id, a.patient_id, a.procedure_id, a.start_time::date as completed_on
    from public.appointments a
    join public.clinics c on c.id = a.clinic_id
    join public.procedures pr on pr.id = a.procedure_id
    where a.status = 'completed'
      and a.procedure_id is not null
      and c.return_enabled = true
      and pr.create_return_on_complete = true
      and (p_since is null or a.start_time::date >= p_since)
  loop
    v_next := public.compute_next_return_date(r.clinic_id, r.procedure_id, r.completed_on);
    insert into public.return_controls (clinic_id, patient_id, procedure_id, last_visit, next_return_date, reminder_sent, notes)
    values (r.clinic_id, r.patient_id, r.procedure_id, r.completed_on, v_next, false, null)
    on conflict (clinic_id, patient_id, procedure_id) do update
      set last_visit = excluded.last_visit,
          next_return_date = excluded.next_return_date;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.backfill_return_controls(date) from public;
grant execute on function public.backfill_return_controls(date) to authenticated;
