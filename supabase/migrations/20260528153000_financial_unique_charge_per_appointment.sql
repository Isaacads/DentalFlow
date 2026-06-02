create unique index if not exists financial_transactions_unique_income_per_appointment
on public.financial_transactions (clinic_id, appointment_id)
where appointment_id is not null and type = 'income' and status <> 'cancelled';

create index if not exists financial_transactions_clinic_appointment_id_idx
on public.financial_transactions (clinic_id, appointment_id)
where appointment_id is not null;
