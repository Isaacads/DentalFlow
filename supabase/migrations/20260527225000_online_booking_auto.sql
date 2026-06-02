alter table public.clinics add column if not exists booking_mode text not null default 'request';

do $$
begin
  alter table public.clinics drop constraint if exists clinics_booking_mode_check;
  alter table public.clinics add constraint clinics_booking_mode_check check (booking_mode in ('request','auto'));
exception
  when duplicate_object then null;
end
$$;

alter table public.appointments add column if not exists created_via text not null default 'internal';

do $$
begin
  alter table public.appointments drop constraint if exists appointments_created_via_check;
  alter table public.appointments add constraint appointments_created_via_check check (created_via in ('internal','online'));
exception
  when duplicate_object then null;
end
$$;

drop function if exists public.get_booking_config(text);

create or replace function public.get_booking_config(p_slug text)
returns table (
  clinic_id uuid,
  clinic_name text,
  booking_mode text,
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
  v_mode text;
  v_window int;
  v_lead int;
begin
  select c.id, c.name, c.booking_mode, c.booking_window_days, c.booking_lead_time_hours
  into v_clinic_id, v_name, v_mode, v_window, v_lead
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
  booking_mode := coalesce(v_mode, 'request');
  booking_window_days := v_window;
  booking_lead_time_hours := v_lead;
  return next;
end;
$$;

revoke all on function public.get_booking_config(text) from public;
grant execute on function public.get_booking_config(text) to anon;
grant execute on function public.get_booking_config(text) to authenticated;

create or replace function public.create_booking_appointment(
  p_slug text,
  p_patient_name text,
  p_patient_whatsapp text,
  p_start_time timestamptz,
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
  v_dur int;
  v_end timestamptz;
  v_patient_id uuid;
  v_dentist_id uuid;
  v_appt_id uuid;
  v_count int;
  v_now timestamptz := now();
  v_notes text;
  d record;
begin
  select c.id, c.booking_window_days, c.booking_lead_time_hours
  into v_clinic_id, v_window, v_lead
  from public.clinics c
  where c.booking_slug = p_slug and c.booking_enabled = true and c.booking_mode = 'auto'
  limit 1;

  if v_clinic_id is null then
    raise exception 'Agendamento online indisponível.';
  end if;

  if p_start_time is null then
    raise exception 'Horário inválido.';
  end if;

  if p_start_time < (v_now + make_interval(hours => v_lead)) then
    raise exception 'Horário inválido.';
  end if;

  if p_start_time >= (v_now + make_interval(days => v_window)) then
    raise exception 'Horário inválido.';
  end if;

  if p_patient_name is null or length(trim(p_patient_name)) < 2 then
    raise exception 'Nome inválido.';
  end if;

  if p_patient_whatsapp is null or length(regexp_replace(p_patient_whatsapp, '\D', '', 'g')) < 10 then
    raise exception 'WhatsApp inválido.';
  end if;

  select count(1)
  into v_count
  from public.booking_requests r
  where r.clinic_id = v_clinic_id
    and regexp_replace(r.patient_whatsapp, '\D', '', 'g') = regexp_replace(p_patient_whatsapp, '\D', '', 'g')
    and r.created_at >= (v_now - interval '60 minutes');

  if v_count >= 6 then
    raise exception 'Muitas tentativas. Tente novamente mais tarde.';
  end if;

  select coalesce(pr.duration_minutes, 30)
  into v_dur
  from public.procedures pr
  where pr.id = p_procedure_id and pr.clinic_id = v_clinic_id and pr.active = true;
  if v_dur is null or v_dur < 15 then v_dur := 30; end if;
  v_end := p_start_time + make_interval(mins => v_dur);

  if p_dentist_id is not null then
    perform 1
    from public.profiles p
    where p.id = p_dentist_id and p.clinic_id = v_clinic_id and p.active = true and p.role in ('admin','dentist');
    if not found then
      raise exception 'Profissional inválido.';
    end if;
    v_dentist_id := p_dentist_id;
  else
    v_dentist_id := null;
    for d in
      select p.id
      from public.profiles p
      where p.clinic_id = v_clinic_id and p.active = true and p.role in ('admin','dentist')
      order by p.full_name nulls last
    loop
      if not exists (
        select 1
        from public.schedule_blocks b
        where b.clinic_id = v_clinic_id
          and (b.dentist_id is null or b.dentist_id = d.id)
          and b.start_time < v_end
          and b.end_time > p_start_time
      ) and not exists (
        select 1
        from public.appointments a
        where a.clinic_id = v_clinic_id
          and a.dentist_id = d.id
          and a.status <> 'cancelled'
          and a.start_time < v_end
          and a.end_time > p_start_time
      ) then
        v_dentist_id := d.id;
        exit;
      end if;
    end loop;

    if v_dentist_id is null then
      raise exception 'Horário indisponível.';
    end if;
  end if;

  select p.id
  into v_patient_id
  from public.patients p
  where p.clinic_id = v_clinic_id
    and regexp_replace(coalesce(p.whatsapp, ''), '\D', '', 'g') = regexp_replace(p_patient_whatsapp, '\D', '', 'g')
  limit 1;

  if v_patient_id is null then
    insert into public.patients (clinic_id, name, whatsapp, email, active)
    values (v_clinic_id, trim(p_patient_name), trim(p_patient_whatsapp), nullif(trim(coalesce(p_patient_email, '')), ''), true)
    returning id into v_patient_id;
  end if;

  v_notes := 'Agendado online';
  if nullif(trim(coalesce(p_notes, '')), '') is not null then
    v_notes := v_notes || ' • ' || trim(p_notes);
  end if;

  insert into public.appointments (clinic_id, patient_id, dentist_id, procedure_id, start_time, end_time, status, notes, room, created_via)
  values (v_clinic_id, v_patient_id, v_dentist_id, p_procedure_id, p_start_time, v_end, 'scheduled', v_notes, null, 'online')
  returning id into v_appt_id;

  insert into public.booking_requests (
    clinic_id, patient_name, patient_whatsapp, patient_email, procedure_id, dentist_id, preferred_times, notes, status
  ) values (
    v_clinic_id,
    trim(p_patient_name),
    trim(p_patient_whatsapp),
    nullif(trim(coalesce(p_patient_email, '')), ''),
    p_procedure_id,
    v_dentist_id,
    array[p_start_time],
    nullif(trim(coalesce(p_notes, '')), ''),
    'scheduled'
  );

  return v_appt_id;
end;
$$;

revoke all on function public.create_booking_appointment(text, text, text, timestamptz, text, uuid, uuid, text) from public;
grant execute on function public.create_booking_appointment(text, text, text, timestamptz, text, uuid, uuid, text) to anon;
grant execute on function public.create_booking_appointment(text, text, text, timestamptz, text, uuid, uuid, text) to authenticated;
