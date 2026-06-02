alter table public.clinics
  add column if not exists working_hours jsonb not null default '{}'::jsonb;

update public.clinics
set working_hours = jsonb_build_object(
  '1', jsonb_build_array(jsonb_build_object('start','08:00','end','12:00'), jsonb_build_object('start','13:00','end','18:00')),
  '2', jsonb_build_array(jsonb_build_object('start','08:00','end','12:00'), jsonb_build_object('start','13:00','end','18:00')),
  '3', jsonb_build_array(jsonb_build_object('start','08:00','end','12:00'), jsonb_build_object('start','13:00','end','18:00')),
  '4', jsonb_build_array(jsonb_build_object('start','08:00','end','12:00'), jsonb_build_object('start','13:00','end','18:00')),
  '5', jsonb_build_array(jsonb_build_object('start','08:00','end','12:00'), jsonb_build_object('start','13:00','end','18:00')),
  '6', jsonb_build_array(jsonb_build_object('start','08:00','end','12:00')),
  '0', '[]'::jsonb
)
where working_hours is null or working_hours = '{}'::jsonb;

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
  v_hours jsonb;
begin
  select c.id, c.booking_window_days, c.booking_lead_time_hours, coalesce(c.working_hours, '{}'::jsonb)
  into v_clinic_id, v_window, v_lead, v_hours
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
  periods as (
    select
      d.d,
      (b.day0::date + make_interval(days => d.d))::timestamp as local_day,
      jsonb_array_elements(
        coalesce(
          v_hours -> (extract(dow from (b.day0::date + make_interval(days => d.d)))::int)::text,
          '[]'::jsonb
        )
      ) as per
    from days d
    cross join base b
  ),
  slot_local as (
    select
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
    select st, en
    from slot_local
    where st >= (now() + make_interval(hours => v_lead))
      and st < (now() + make_interval(days => v_window))
  ),
  dentists as (
    select p.id
    from public.profiles p
    where p.clinic_id = v_clinic_id and p.active = true and p.role in ('admin','dentist')
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
  v_hours jsonb;
  v_dow int;
  v_local_start timestamp;
  v_local_end timestamp;
  d record;
begin
  select c.id, c.booking_window_days, c.booking_lead_time_hours, coalesce(c.working_hours, '{}'::jsonb)
  into v_clinic_id, v_window, v_lead, v_hours
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

  v_local_start := timezone('America/Sao_Paulo', p_start_time);
  v_local_end := timezone('America/Sao_Paulo', v_end);
  v_dow := extract(dow from v_local_start)::int;
  if (v_local_start::date <> v_local_end::date) or not exists (
    select 1
    from jsonb_array_elements(coalesce(v_hours -> v_dow::text, '[]'::jsonb)) as per
    where (v_local_start::time) >= (per->>'start')::time
      and (v_local_end::time) <= (per->>'end')::time
  ) then
    raise exception 'Horário indisponível.';
  end if;

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
