create or replace function public.transfer_clinic_ownership(p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_target_role text;
  v_target_clinic uuid;
begin
  if not public.current_is_owner() then
    raise exception 'Sem permissão.';
  end if;

  v_clinic_id := public.current_clinic_id();
  if v_clinic_id is null then
    raise exception 'Clínica não encontrada.';
  end if;

  select role, clinic_id into v_target_role, v_target_clinic
  from public.profiles
  where id = p_new_owner_id;

  if v_target_clinic is null or v_target_clinic <> v_clinic_id then
    raise exception 'Novo titular inválido.';
  end if;

  if v_target_role <> 'admin' then
    raise exception 'O novo titular deve ser um administrador.';
  end if;

  update public.clinics set owner_id = p_new_owner_id where id = v_clinic_id;
end;
$$;

revoke all on function public.transfer_clinic_ownership(uuid) from public;
grant execute on function public.transfer_clinic_ownership(uuid) to authenticated;

