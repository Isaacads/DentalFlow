alter table public.profiles
  add column if not exists working_hours jsonb;

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
  v_clinic_hours jsonb;
begin
  select c.id, c.booking_window_days, c.booking_lead_time_hours, coalesce(c.working_hours, '{}'::jsonb)
  into v_clinic_id, v_window, v_lead, v_clinic_hours
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
  with base as (
    select date_trunc('day', timezone('America/Sao_Paulo', now())) as day0
  ),
  days as (
    select generate_series(0, p_days - 1) as d
  ),
  dentists as (
    select p.id as dentist_id, coalesce(p.working_hours, v_clinic_hours) as hours
    from public.profiles p
    where p.clinic_id = v_clinic_id
      and p.active = true
      and p.role in ('admin','dentist')
      and (p_dentist_id is null or p.id = p_dentist_id)
  ),
  periods as (
    select
      den.dentist_id,
      (b.day0::date + make_interval(days => d.d))::timestamp as local_day,
      jsonb_array_elements(
        coalesce(
          den.hours -> (extract(dow from (b.day0::date + make_interval(days => d.d)))::int)::text,
          '[]'::jsonb
        )
      ) as per
    from dentists den
    cross join days d
    cross join base b
  ),
  slot_local as (
    select
      p.dentist_id,
      timezone('America/Sao_Paulo', gs) as st,
      (timezone('America/Sao_Paulo', gs) + make_interval(mins => v_dur)) as en
    from periods p,
    lateral generate_series(
      (p.local_day::date + (p.per->>'start')::time),
      (p.local_day::date + (p.per->>'end')::time) - make_interval(mins => v_dur),
      interval '30 minutes'
    ) gs
  ),
  valid_slots as (
    select dentist_id, st, en
    from slot_local
    where st >= (now() + make_interval(hours => v_lead))
      and st < (now() + make_interval(days => v_window))
  ),
  free_slots as (
    select vs.dentist_id, vs.st, vs.en
    from valid_slots vs
    where not exists (
      select 1
      from public.schedule_blocks b
      where b.clinic_id = v_clinic_id
        and b.dentist_id is null
        and b.start_time < vs.en
        and b.end_time > vs.st
    )
    and not exists (
      select 1
      from public.schedule_blocks b
      where b.clinic_id = v_clinic_id
        and b.dentist_id = vs.dentist_id
        and b.start_time < vs.en
        and b.end_time > vs.st
    )
    and not exists (
      select 1
      from public.appointments a
      where a.clinic_id = v_clinic_id
        and a.dentist_id = vs.dentist_id
        and a.status <> 'cancelled'
        and a.start_time < vs.en
        and a.end_time > vs.st
    )
  )
  select distinct fs.st
  from free_slots fs
  order by fs.st asc
  limit 160;
end;
$$;

revoke all on function public.get_booking_availability(text, uuid, uuid, int) from public;
grant execute on function public.get_booking_availability(text, uuid, uuid, int) to anon;
grant execute on function public.get_booking_availability(text, uuid, uuid, int) to authenticated;

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
  v_template text;
  v_msg text;
  v_clinic_hours jsonb;
  v_dentist_hours jsonb;
  v_dow int;
  v_local_start timestamp;
  v_local_end timestamp;
  v_digits text;
  d record;
begin
  select c.id, c.booking_window_days, c.booking_lead_time_hours, coalesce(c.working_hours, '{}'::jsonb)
  into v_clinic_id, v_window, v_lead, v_clinic_hours
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

  v_digits := nullif(regexp_replace(coalesce(p_patient_whatsapp, ''), '\D', '', 'g'), '');
  if v_digits is null or length(v_digits) < 10 then
    raise exception 'WhatsApp inválido.';
  end if;

  select count(1)
  into v_count
  from public.booking_requests r
  where r.clinic_id = v_clinic_id
    and r.patient_whatsapp_digits = v_digits
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
    select coalesce(p.working_hours, v_clinic_hours)
    into v_dentist_hours
    from public.profiles p
    where p.id = p_dentist_id and p.clinic_id = v_clinic_id and p.active = true and p.role in ('admin','dentist');
    if v_dentist_hours is null then
      raise exception 'Profissional inválido.';
    end if;
    v_dentist_id := p_dentist_id;
  else
    v_dentist_id := null;
    for d in
      select p.id, coalesce(p.working_hours, v_clinic_hours) as hours
      from public.profiles p
      where p.clinic_id = v_clinic_id and p.active = true and p.role in ('admin','dentist')
      order by p.full_name nulls last
    loop
      v_local_start := timezone('America/Sao_Paulo', p_start_time);
      v_local_end := timezone('America/Sao_Paulo', v_end);
      v_dow := extract(dow from v_local_start)::int;
      if (v_local_start::date <> v_local_end::date) or not exists (
        select 1
        from jsonb_array_elements(coalesce(d.hours -> v_dow::text, '[]'::jsonb)) as per
        where (v_local_start::time) >= (per->>'start')::time
          and (v_local_end::time) <= (per->>'end')::time
      ) then
        continue;
      end if;

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
        v_dentist_hours := d.hours;
        exit;
      end if;
    end loop;

    if v_dentist_id is null then
      raise exception 'Horário indisponível.';
    end if;
  end if;

  if v_dentist_hours is null then
    select coalesce(p.working_hours, v_clinic_hours)
    into v_dentist_hours
    from public.profiles p
    where p.id = v_dentist_id and p.clinic_id = v_clinic_id;
  end if;

  v_local_start := timezone('America/Sao_Paulo', p_start_time);
  v_local_end := timezone('America/Sao_Paulo', v_end);
  v_dow := extract(dow from v_local_start)::int;
  if (v_local_start::date <> v_local_end::date) or not exists (
    select 1
    from jsonb_array_elements(coalesce(v_dentist_hours -> v_dow::text, '[]'::jsonb)) as per
    where (v_local_start::time) >= (per->>'start')::time
      and (v_local_end::time) <= (per->>'end')::time
  ) then
    raise exception 'Horário indisponível.';
  end if;

  select p.id
  into v_patient_id
  from public.patients p
  where p.clinic_id = v_clinic_id
    and p.whatsapp_digits = v_digits
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

  select coalesce(c.whatsapp_confirmation_template, 'Olá, {nome}! Confirmamos sua consulta em {data} às {hora}.')
  into v_template
  from public.clinics c
  where c.id = v_clinic_id;

  v_msg := v_template;
  v_msg := replace(v_msg, '{nome}', trim(p_patient_name));
  v_msg := replace(v_msg, '{data}', to_char(p_start_time at time zone 'America/Sao_Paulo', 'DD/MM'));
  v_msg := replace(v_msg, '{hora}', to_char(p_start_time at time zone 'America/Sao_Paulo', 'HH24:MI'));

  insert into public.whatsapp_messages (clinic_id, appointment_id, patient_id, kind, to_phone, message, status)
  values (v_clinic_id, v_appt_id, v_patient_id, 'confirm', trim(p_patient_whatsapp), v_msg, 'queued');

  return v_appt_id;
end;
$$;

revoke all on function public.create_booking_appointment(text, text, text, timestamptz, text, uuid, uuid, text) from public;
grant execute on function public.create_booking_appointment(text, text, text, timestamptz, text, uuid, uuid, text) to anon;
grant execute on function public.create_booking_appointment(text, text, text, timestamptz, text, uuid, uuid, text) to authenticated;
