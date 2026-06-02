do $$
begin
  alter table public.patients drop constraint if exists patients_cpf_key;
exception
  when undefined_object then null;
end
$$;

alter table public.patients
  add column if not exists cpf_digits text generated always as (nullif(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), '')) stored,
  add column if not exists phone_digits text generated always as (nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')) stored,
  add column if not exists whatsapp_digits text generated always as (nullif(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), '')) stored;

create unique index if not exists patients_clinic_cpf_digits_uidx
on public.patients (clinic_id, cpf_digits)
where cpf_digits is not null;

create index if not exists patients_clinic_phone_digits_idx
on public.patients (clinic_id, phone_digits);

create index if not exists patients_clinic_whatsapp_digits_idx
on public.patients (clinic_id, whatsapp_digits);

alter table public.booking_requests
  add column if not exists patient_whatsapp_digits text generated always as (nullif(regexp_replace(coalesce(patient_whatsapp, ''), '\D', '', 'g'), '')) stored;

create index if not exists booking_requests_clinic_whatsapp_digits_created_at_idx
on public.booking_requests (clinic_id, patient_whatsapp_digits, created_at desc);

create or replace function public.find_or_create_patient_for_booking(
  p_patient_name text,
  p_patient_whatsapp text,
  p_patient_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text;
  v_patient_id uuid;
  v_name text;
  v_email text;
begin
  v_name := trim(coalesce(p_patient_name, ''));
  if length(v_name) < 2 then
    raise exception 'Nome inválido.';
  end if;

  v_digits := nullif(regexp_replace(coalesce(p_patient_whatsapp, ''), '\D', '', 'g'), '');
  if v_digits is null or length(v_digits) < 10 then
    raise exception 'WhatsApp inválido.';
  end if;

  v_email := nullif(trim(coalesce(p_patient_email, '')), '');

  select p.id
  into v_patient_id
  from public.patients p
  where p.clinic_id = public.current_clinic_id()
    and (
      p.whatsapp_digits = v_digits
      or p.phone_digits = v_digits
    )
  limit 1;

  if v_patient_id is not null then
    update public.patients
    set
      name = case when nullif(trim(coalesce(name, '')), '') is null then v_name else name end,
      whatsapp = case when nullif(trim(coalesce(whatsapp, '')), '') is null then p_patient_whatsapp else whatsapp end,
      email = case when email is null and v_email is not null then v_email else email end
    where id = v_patient_id;
    return v_patient_id;
  end if;

  insert into public.patients (clinic_id, name, whatsapp, email, active)
  values (public.current_clinic_id(), v_name, trim(p_patient_whatsapp), v_email, true)
  returning id into v_patient_id;

  return v_patient_id;
end;
$$;

revoke all on function public.find_or_create_patient_for_booking(text, text, text) from public;
grant execute on function public.find_or_create_patient_for_booking(text, text, text) to authenticated;
