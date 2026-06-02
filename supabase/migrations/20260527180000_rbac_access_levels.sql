-- RBAC - níveis de acesso por função (admin > receptionist/dentist > assistant)

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

  v_token := encode(gen_random_bytes(16), 'hex');

  insert into public.appointment_rsvp_tokens (clinic_id, appointment_id, token, expires_at)
  values (v_clinic_id, p_appointment_id, v_token, now() + make_interval(hours => p_hours));

  return v_token;
end;
$$;

revoke all on function public.create_rsvp_token(uuid, int) from public;
grant execute on function public.create_rsvp_token(uuid, int) to authenticated;

drop policy if exists patients_crud_same_clinic on public.patients;
drop policy if exists procedures_crud_same_clinic on public.procedures;
drop policy if exists appointments_crud_same_clinic on public.appointments;
drop policy if exists medical_records_crud_same_clinic on public.medical_records;
drop policy if exists financial_transactions_crud_same_clinic on public.financial_transactions;
drop policy if exists anamnesis_crud_same_clinic on public.anamnesis;
drop policy if exists return_controls_crud_same_clinic on public.return_controls;

drop policy if exists patients_select_same_clinic on public.patients;
drop policy if exists patients_insert_staff on public.patients;
drop policy if exists patients_update_staff on public.patients;
drop policy if exists patients_delete_admin on public.patients;

create policy patients_select_same_clinic
on public.patients
for select
to authenticated
using (clinic_id = public.current_clinic_id());

create policy patients_insert_staff
on public.patients
for insert
to authenticated
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist'));

create policy patients_update_staff
on public.patients
for update
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist'))
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist'));

create policy patients_delete_admin
on public.patients
for delete
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() = 'admin');

drop policy if exists procedures_select_same_clinic on public.procedures;
drop policy if exists procedures_insert_admin_dentist on public.procedures;
drop policy if exists procedures_update_admin_dentist on public.procedures;
drop policy if exists procedures_delete_admin_dentist on public.procedures;

create policy procedures_select_same_clinic
on public.procedures
for select
to authenticated
using (clinic_id = public.current_clinic_id());

create policy procedures_insert_admin_dentist
on public.procedures
for insert
to authenticated
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','dentist'));

create policy procedures_update_admin_dentist
on public.procedures
for update
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','dentist'))
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','dentist'));

create policy procedures_delete_admin_dentist
on public.procedures
for delete
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','dentist'));

drop policy if exists appointments_select_same_clinic on public.appointments;
drop policy if exists appointments_insert_staff on public.appointments;
drop policy if exists appointments_update_staff on public.appointments;
drop policy if exists appointments_delete_admin_receptionist on public.appointments;

create policy appointments_select_same_clinic
on public.appointments
for select
to authenticated
using (clinic_id = public.current_clinic_id());

create policy appointments_insert_staff
on public.appointments
for insert
to authenticated
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist','assistant'));

create policy appointments_update_staff
on public.appointments
for update
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist','assistant'))
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist','assistant'));

create policy appointments_delete_admin_receptionist
on public.appointments
for delete
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist'));

drop policy if exists medical_records_select_admin_dentist on public.medical_records;
drop policy if exists medical_records_insert_admin_dentist on public.medical_records;
drop policy if exists medical_records_update_admin_dentist on public.medical_records;
drop policy if exists medical_records_delete_admin on public.medical_records;

create policy medical_records_select_admin_dentist
on public.medical_records
for select
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','dentist'));

create policy medical_records_insert_admin_dentist
on public.medical_records
for insert
to authenticated
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','dentist'));

create policy medical_records_update_admin_dentist
on public.medical_records
for update
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','dentist'))
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','dentist'));

create policy medical_records_delete_admin
on public.medical_records
for delete
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() = 'admin');

drop policy if exists financial_select_admin_receptionist on public.financial_transactions;
drop policy if exists financial_insert_admin_receptionist on public.financial_transactions;
drop policy if exists financial_update_admin_receptionist on public.financial_transactions;
drop policy if exists financial_delete_admin_receptionist on public.financial_transactions;

create policy financial_select_admin_receptionist
on public.financial_transactions
for select
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist'));

create policy financial_insert_admin_receptionist
on public.financial_transactions
for insert
to authenticated
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist'));

create policy financial_update_admin_receptionist
on public.financial_transactions
for update
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist'))
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist'));

create policy financial_delete_admin_receptionist
on public.financial_transactions
for delete
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist'));

drop policy if exists anamnesis_select_same_clinic on public.anamnesis;
drop policy if exists anamnesis_insert_staff on public.anamnesis;
drop policy if exists anamnesis_update_staff on public.anamnesis;
drop policy if exists anamnesis_delete_admin on public.anamnesis;

create policy anamnesis_select_same_clinic
on public.anamnesis
for select
to authenticated
using (clinic_id = public.current_clinic_id());

create policy anamnesis_insert_staff
on public.anamnesis
for insert
to authenticated
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist','assistant'));

create policy anamnesis_update_staff
on public.anamnesis
for update
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist','assistant'))
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist','assistant'));

create policy anamnesis_delete_admin
on public.anamnesis
for delete
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() = 'admin');

drop policy if exists return_controls_select_staff on public.return_controls;
drop policy if exists return_controls_insert_staff on public.return_controls;
drop policy if exists return_controls_update_staff on public.return_controls;
drop policy if exists return_controls_delete_admin on public.return_controls;

create policy return_controls_select_staff
on public.return_controls
for select
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist'));

create policy return_controls_insert_staff
on public.return_controls
for insert
to authenticated
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist'));

create policy return_controls_update_staff
on public.return_controls
for update
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist'))
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist'));

create policy return_controls_delete_admin
on public.return_controls
for delete
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() = 'admin');

