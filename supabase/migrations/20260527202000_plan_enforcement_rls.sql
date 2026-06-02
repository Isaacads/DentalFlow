create or replace function public.current_plan_tier()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select plan_tier from public.clinics where id = public.current_clinic_id();
$$;

revoke all on function public.current_plan_tier() from public;
grant execute on function public.current_plan_tier() to authenticated;

drop policy if exists medical_records_select_admin_dentist on public.medical_records;
drop policy if exists medical_records_insert_admin_dentist on public.medical_records;
drop policy if exists medical_records_update_admin_dentist on public.medical_records;
drop policy if exists medical_records_delete_admin on public.medical_records;

create policy medical_records_select_admin_dentist
on public.medical_records
for select
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','dentist') and public.current_plan_tier() in ('clinic','management'));

create policy medical_records_insert_admin_dentist
on public.medical_records
for insert
to authenticated
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','dentist') and public.current_plan_tier() in ('clinic','management'));

create policy medical_records_update_admin_dentist
on public.medical_records
for update
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','dentist') and public.current_plan_tier() in ('clinic','management'))
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','dentist') and public.current_plan_tier() in ('clinic','management'));

create policy medical_records_delete_admin
on public.medical_records
for delete
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() = 'admin' and public.current_plan_tier() in ('clinic','management'));

drop policy if exists return_controls_select_staff on public.return_controls;
drop policy if exists return_controls_insert_staff on public.return_controls;
drop policy if exists return_controls_update_staff on public.return_controls;
drop policy if exists return_controls_delete_admin on public.return_controls;

create policy return_controls_select_staff
on public.return_controls
for select
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist') and public.current_plan_tier() in ('clinic','management'));

create policy return_controls_insert_staff
on public.return_controls
for insert
to authenticated
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist') and public.current_plan_tier() in ('clinic','management'));

create policy return_controls_update_staff
on public.return_controls
for update
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist') and public.current_plan_tier() in ('clinic','management'))
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist','dentist') and public.current_plan_tier() in ('clinic','management'));

create policy return_controls_delete_admin
on public.return_controls
for delete
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() = 'admin' and public.current_plan_tier() in ('clinic','management'));

drop policy if exists financial_select_admin_receptionist on public.financial_transactions;
drop policy if exists financial_insert_admin_receptionist on public.financial_transactions;
drop policy if exists financial_update_admin_receptionist on public.financial_transactions;
drop policy if exists financial_delete_admin_receptionist on public.financial_transactions;

create policy financial_select_admin_receptionist
on public.financial_transactions
for select
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist') and public.current_plan_tier() = 'management');

create policy financial_insert_admin_receptionist
on public.financial_transactions
for insert
to authenticated
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist') and public.current_plan_tier() = 'management');

create policy financial_update_admin_receptionist
on public.financial_transactions
for update
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist') and public.current_plan_tier() = 'management')
with check (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist') and public.current_plan_tier() = 'management');

create policy financial_delete_admin_receptionist
on public.financial_transactions
for delete
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() in ('admin','receptionist') and public.current_plan_tier() = 'management');

