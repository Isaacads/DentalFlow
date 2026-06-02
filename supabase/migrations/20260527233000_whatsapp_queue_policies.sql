drop policy if exists whatsapp_messages_update_admin_receptionist on public.whatsapp_messages;

create policy whatsapp_messages_update_admin_receptionist
on public.whatsapp_messages
for update
to authenticated
using (
  clinic_id = public.current_clinic_id()
  and public.current_role() in ('admin','receptionist')
)
with check (
  clinic_id = public.current_clinic_id()
  and public.current_role() in ('admin','receptionist')
);

