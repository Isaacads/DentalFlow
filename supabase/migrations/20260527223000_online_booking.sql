alter table public.clinics add column if not exists booking_enabled boolean not null default false;
alter table public.clinics add column if not exists booking_slug text;
alter table public.clinics add column if not exists booking_window_days int not null default 14;
alter table public.clinics add column if not exists booking_lead_time_hours int not null default 2;

update public.clinics
set booking_slug = substring(id::text, 1, 8)
where booking_slug is null;

create unique index if not exists clinics_booking_slug_uidx on public.clinics (booking_slug);

do $$
begin
  alter table public.clinics drop constraint if exists clinics_booking_window_days_check;
  alter table public.clinics add constraint clinics_booking_window_days_check check (booking_window_days between 1 and 60);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.clinics drop constraint if exists clinics_booking_lead_time_hours_check;
  alter table public.clinics add constraint clinics_booking_lead_time_hours_check check (booking_lead_time_hours between 0 and 168);
exception
  when duplicate_object then null;
end
$$;

create or replace function public.enforce_booking_settings_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.booking_enabled is distinct from old.booking_enabled)
    or (new.booking_slug is distinct from old.booking_slug)
    or (new.booking_window_days is distinct from old.booking_window_days)
    or (new.booking_lead_time_hours is distinct from old.booking_lead_time_hours)
  then
    if not public.current_is_owner() then
      raise exception 'Apenas o titular pode alterar as configurações de agendamento online.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists clinics_enforce_booking_settings on public.clinics;
create trigger clinics_enforce_booking_settings
before update on public.clinics
for each row execute function public.enforce_booking_settings_owner();

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_name text not null,
  patient_whatsapp text not null,
  patient_email text,
  procedure_id uuid references public.procedures (id) on delete set null,
  dentist_id uuid references public.profiles (id) on delete set null,
  preferred_times timestamptz[] not null,
  notes text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists booking_requests_clinic_created_at_idx on public.booking_requests (clinic_id, created_at desc);
create index if not exists booking_requests_status_idx on public.booking_requests (clinic_id, status);

alter table public.booking_requests enable row level security;

drop policy if exists booking_requests_select_same_clinic on public.booking_requests;
create policy booking_requests_select_same_clinic
on public.booking_requests
for select
to authenticated
using (clinic_id = public.current_clinic_id());

drop policy if exists booking_requests_update_admin_receptionist on public.booking_requests;
create policy booking_requests_update_admin_receptionist
on public.booking_requests
for update
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist'))
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist'));

drop policy if exists booking_requests_delete_admin on public.booking_requests;
create policy booking_requests_delete_admin
on public.booking_requests
for delete
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() = 'admin');

create or replace function public.get_booking_config(p_slug text)
returns table (
  clinic_id uuid,
  clinic_name text,
  booking_window_days int,
  booking_lead_time_hours int,
  dentists jsonb,
  procedures jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_name text;
  v_window int;
  v_lead int;
begin
  select c.id, c.name, c.booking_window_days, c.booking_lead_time_hours
  into v_clinic_id, v_name, v_window, v_lead
  from public.clinics c
  where c.booking_slug = p_slug and c.booking_enabled = true
  limit 1;

  if v_clinic_id is null then
    raise exception 'Agendamento online indisponível.';
  end if;

  dentists := (
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name) order by p.full_name), '[]'::jsonb)
    from public.profiles p
    where p.clinic_id = v_clinic_id and p.active = true and p.role in ('admin','dentist')
  );

  procedures := (
    select coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name, 'duration_minutes', pr.duration_minutes) order by pr.name), '[]'::jsonb)
    from public.procedures pr
    where pr.clinic_id = v_clinic_id and pr.active = true
  );

  clinic_id := v_clinic_id;
  clinic_name := v_name;
  booking_window_days := v_window;
  booking_lead_time_hours := v_lead;
  return next;
end;
$$;

revoke all on function public.get_booking_config(text) from public;
grant execute on function public.get_booking_config(text) to anon;
grant execute on function public.get_booking_config(text) to authenticated;

create or replace function public.get_booking_availability(
  p_slug text,
  p_dentist_id uuid default null,
  p_procedure_id uuid default null,
  p_days int default 7
)
returns table (start_time timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_window int;
  v_lead int;
  v_dur int;
begin
  select c.id, c.booking_window_days, c.booking_lead_time_hours
  into v_clinic_id, v_window, v_lead
  from public.clinics c
  where c.booking_slug = p_slug and c.booking_enabled = true
  limit 1;

  if v_clinic_id is null then
    raise exception 'Agendamento online indisponível.';
  end if;

  if p_days is null or p_days < 1 then p_days := 1; end if;
  if p_days > 14 then p_days := 14; end if;

  select coalesce(pr.duration_minutes, 30)
  into v_dur
  from public.procedures pr
  where pr.id = p_procedure_id and pr.clinic_id = v_clinic_id and pr.active = true;
  if v_dur is null or v_dur < 15 then v_dur := 30; end if;

  return query
  with clinic as (
    select v_clinic_id as clinic_id
  ),
  dentists as (
    select p.id
    from public.profiles p
    where p.clinic_id = v_clinic_id and p.active = true and p.role in ('admin','dentist')
  ),
  slots as (
    select (date_trunc('day', now()) + make_interval(days => d, hours => h, mins => m)) as st
    from generate_series(0, p_days - 1) as d
    cross join (values
      (8,0),(8,30),(9,0),(9,30),(10,0),(10,30),(11,0),(11,30),
      (13,0),(13,30),(14,0),(14,30),(15,0),(15,30),(16,0),(16,30),(17,0),(17,30)
    ) as hm(h,m)
  ),
  valid_slots as (
    select st,
           (st + make_interval(mins => v_dur)) as en
    from slots
    where st >= (now() + make_interval(hours => v_lead))
      and st < (now() + make_interval(days => v_window))
  )
  select vs.st
  from valid_slots vs
  where not exists (
    select 1
    from public.schedule_blocks b
    where b.clinic_id = v_clinic_id
      and b.dentist_id is null
      and b.start_time < vs.en
      and b.end_time > vs.st
  )
  and (
    (p_dentist_id is not null and exists (
      select 1
      from public.profiles p
      where p.id = p_dentist_id and p.clinic_id = v_clinic_id and p.active = true and p.role in ('admin','dentist')
    )
    and not exists (
      select 1
      from public.schedule_blocks b
      where b.clinic_id = v_clinic_id
        and b.dentist_id = p_dentist_id
        and b.start_time < vs.en
        and b.end_time > vs.st
    )
    and not exists (
      select 1
      from public.appointments a
      where a.clinic_id = v_clinic_id
        and a.dentist_id = p_dentist_id
        and a.status <> 'cancelled'
        and a.start_time < vs.en
        and a.end_time > vs.st
    ))
    or
    (p_dentist_id is null and exists (
      select 1
      from dentists d
      where not exists (
        select 1
        from public.schedule_blocks b
        where b.clinic_id = v_clinic_id
          and b.dentist_id = d.id
          and b.start_time < vs.en
          and b.end_time > vs.st
      )
      and not exists (
        select 1
        from public.appointments a
        where a.clinic_id = v_clinic_id
          and a.dentist_id = d.id
          and a.status <> 'cancelled'
          and a.start_time < vs.en
          and a.end_time > vs.st
      )
    ))
  )
  order by vs.st asc
  limit 160;
end;
$$;

revoke all on function public.get_booking_availability(text, uuid, uuid, int) from public;
grant execute on function public.get_booking_availability(text, uuid, uuid, int) to anon;
grant execute on function public.get_booking_availability(text, uuid, uuid, int) to authenticated;

create or replace function public.create_booking_request(
  p_slug text,
  p_patient_name text,
  p_patient_whatsapp text,
  p_preferred_times timestamptz[],
  p_patient_email text default null,
  p_dentist_id uuid default null,
  p_procedure_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_window int;
  v_lead int;
  v_count int;
  v_now timestamptz := now();
  v_times timestamptz[];
  v_id uuid;
begin
  select c.id, c.booking_window_days, c.booking_lead_time_hours
  into v_clinic_id, v_window, v_lead
  from public.clinics c
  where c.booking_slug = p_slug and c.booking_enabled = true
  limit 1;

  if v_clinic_id is null then
    raise exception 'Agendamento online indisponível.';
  end if;

  if p_patient_name is null or length(trim(p_patient_name)) < 2 then
    raise exception 'Nome inválido.';
  end if;

  if p_patient_whatsapp is null or length(regexp_replace(p_patient_whatsapp, '\D', '', 'g')) < 10 then
    raise exception 'WhatsApp inválido.';
  end if;

  v_times := p_preferred_times;
  if v_times is null or array_length(v_times, 1) is null or array_length(v_times, 1) < 1 or array_length(v_times, 1) > 3 then
    raise exception 'Selecione de 1 a 3 horários.';
  end if;

  select count(1)
  into v_count
  from public.booking_requests r
  where r.clinic_id = v_clinic_id
    and regexp_replace(r.patient_whatsapp, '\D', '', 'g') = regexp_replace(p_patient_whatsapp, '\D', '', 'g')
    and r.created_at >= (v_now - interval '60 minutes');

  if v_count >= 3 then
    raise exception 'Muitas tentativas. Tente novamente mais tarde.';
  end if;

  if p_dentist_id is not null then
    perform 1
    from public.profiles p
    where p.id = p_dentist_id and p.clinic_id = v_clinic_id and p.active = true and p.role in ('admin','dentist');
    if not found then
      raise exception 'Profissional inválido.';
    end if;
  end if;

  if p_procedure_id is not null then
    perform 1
    from public.procedures pr
    where pr.id = p_procedure_id and pr.clinic_id = v_clinic_id and pr.active = true;
    if not found then
      raise exception 'Procedimento inválido.';
    end if;
  end if;

  for v_count in 1..array_length(v_times, 1) loop
    if v_times[v_count] < (v_now + make_interval(hours => v_lead)) then
      raise exception 'Horário inválido.';
    end if;
    if v_times[v_count] >= (v_now + make_interval(days => v_window)) then
      raise exception 'Horário inválido.';
    end if;
  end loop;

  insert into public.booking_requests (
    clinic_id, patient_name, patient_whatsapp, patient_email, procedure_id, dentist_id, preferred_times, notes, status
  ) values (
    v_clinic_id,
    trim(p_patient_name),
    trim(p_patient_whatsapp),
    nullif(trim(coalesce(p_patient_email, '')), ''),
    p_procedure_id,
    p_dentist_id,
    v_times,
    nullif(trim(coalesce(p_notes, '')), ''),
    'new'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_booking_request(text, text, text, timestamptz[], text, uuid, uuid, text) from public;
grant execute on function public.create_booking_request(text, text, text, timestamptz[], text, uuid, uuid, text) to anon;
grant execute on function public.create_booking_request(text, text, text, timestamptz[], text, uuid, uuid, text) to authenticated;
