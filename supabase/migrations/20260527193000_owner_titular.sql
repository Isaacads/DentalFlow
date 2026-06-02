alter table public.clinics add column if not exists owner_id uuid;

update public.clinics c
set owner_id = sub.id
from (
  select distinct on (clinic_id) id, clinic_id
  from public.profiles
  where role = 'admin'
  order by clinic_id, created_at asc
) as sub
where c.id = sub.clinic_id
  and c.owner_id is null;

alter table public.clinics alter column owner_id set not null;
alter table public.clinics
  add constraint clinics_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete restrict;

create or replace function public.current_clinic_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select owner_id from public.clinics where id = public.current_clinic_id();
$$;

revoke all on function public.current_clinic_owner_id() from public;
grant execute on function public.current_clinic_owner_id() to authenticated;

create or replace function public.current_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_clinic_owner_id() = auth.uid();
$$;

revoke all on function public.current_is_owner() from public;
grant execute on function public.current_is_owner() to authenticated;

create or replace function public.bootstrap_clinic(
  p_clinic_name text,
  p_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
begin
  insert into public.clinics (name, owner_id)
  values (p_clinic_name, auth.uid())
  returning id into v_clinic_id;

  insert into public.profiles (id, clinic_id, full_name, role, active)
  values (auth.uid(), v_clinic_id, p_full_name, 'admin', true)
  on conflict (id) do update
    set clinic_id = excluded.clinic_id,
        full_name = excluded.full_name,
        role = excluded.role,
        active = true;

  return v_clinic_id;
end;
$$;

revoke all on function public.bootstrap_clinic(text, text) from public;
grant execute on function public.bootstrap_clinic(text, text) to authenticated;

drop policy if exists clinics_update_own_admin on public.clinics;
create policy clinics_update_own_admin
on public.clinics
for update
to authenticated
using (id = public.current_clinic_id() and public.current_role() = 'admin' and owner_id = public.current_clinic_owner_id())
with check (id = public.current_clinic_id() and public.current_role() = 'admin' and owner_id = public.current_clinic_owner_id());

drop policy if exists profiles_admin_write on public.profiles;
drop policy if exists profiles_select_same_clinic on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_same_clinic
on public.profiles
for select
to authenticated
using (clinic_id = public.current_clinic_id());

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy profiles_admin_update_staff
on public.profiles
for update
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() = 'admin' and role <> 'admin')
with check (clinic_id = public.current_clinic_id() and public.current_role() = 'admin' and role <> 'admin');

create policy profiles_owner_update_any
on public.profiles
for update
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_is_owner())
with check (clinic_id = public.current_clinic_id() and public.current_is_owner());

