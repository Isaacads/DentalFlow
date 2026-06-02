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

  v_digits := regexp_replace(coalesce(p_patient_whatsapp, ''), '\D', '', 'g');
  if length(v_digits) < 10 then
    raise exception 'WhatsApp inválido.';
  end if;

  v_email := nullif(trim(coalesce(p_patient_email, '')), '');

  select p.id
  into v_patient_id
  from public.patients p
  where p.clinic_id = public.current_clinic_id()
    and (
      regexp_replace(coalesce(p.whatsapp, ''), '\D', '', 'g') = v_digits
      or regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = v_digits
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
