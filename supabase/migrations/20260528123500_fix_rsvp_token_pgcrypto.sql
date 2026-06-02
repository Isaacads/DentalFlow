create extension if not exists "pgcrypto";

create or replace function public.create_rsvp_token(
  p_appointment_id uuid,
  p_hours int default 48
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_clinic_id uuid;
  i int;
begin
  if public.current_role() not in ('admin','receptionist','dentist') then
    raise exception 'Sem permissão.';
  end if;

  select clinic_id into v_clinic_id from public.appointments where id = p_appointment_id;
  if v_clinic_id is null then
    raise exception 'Agendamento não encontrado.';
  end if;

  if v_clinic_id <> public.current_clinic_id() then
    raise exception 'Sem permissão.';
  end if;

  for i in 1..5 loop
    begin
      begin
        execute 'select encode(gen_random_bytes(16), ''hex'')' into v_token;
      exception
        when undefined_function then
          v_token := md5(random()::text || clock_timestamp()::text || p_appointment_id::text || v_clinic_id::text);
      end;

      insert into public.appointment_rsvp_tokens (clinic_id, appointment_id, token, expires_at)
      values (v_clinic_id, p_appointment_id, v_token, now() + make_interval(hours => p_hours));

      return v_token;
    exception
      when unique_violation then
        v_token := null;
    end;
  end loop;

  raise exception 'Não foi possível gerar token.';
end;
$$;

revoke all on function public.create_rsvp_token(uuid, int) from public;
grant execute on function public.create_rsvp_token(uuid, int) to authenticated;
