-- DentalFlow - schema + RLS (multi-clínica)

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text unique,
  address jsonb,
  logo_url text,
  whatsapp_confirmation_template text not null default 'Olá, {nome}! Confirmamos sua consulta em {data} às {hora}. Responda CONFIRMO para confirmar.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clinics_set_updated_at
before update on public.clinics
for each row execute function public.set_updated_at();

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  full_name text,
  role text not null check (role in ('admin','dentist','receptionist','assistant')),
  cro text,
  specialty text,
  phone text,
  color text,
  active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select clinic_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_clinic_id() from public;
revoke all on function public.current_role() from public;
grant execute on function public.current_clinic_id() to authenticated;
grant execute on function public.current_role() to authenticated;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict default public.current_clinic_id(),
  name text not null,
  cpf text unique,
  birth_date date,
  phone text,
  whatsapp text,
  email text,
  address jsonb,
  gender text,
  blood_type text,
  observations text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger patients_set_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

create table if not exists public.procedures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict default public.current_clinic_id(),
  name text not null,
  category text,
  duration_minutes int,
  base_price numeric,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger procedures_set_updated_at
before update on public.procedures
for each row execute function public.set_updated_at();

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict default public.current_clinic_id(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  dentist_id uuid not null references public.profiles (id) on delete restrict,
  procedure_id uuid references public.procedures (id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null check (status in ('scheduled','confirmed','completed','cancelled','no_show')) default 'scheduled',
  notes text,
  room text,
  created_at timestamptz not null default now()
);

create index if not exists appointments_clinic_start_time_idx on public.appointments (clinic_id, start_time);
create index if not exists appointments_dentist_start_time_idx on public.appointments (dentist_id, start_time);

create table if not exists public.appointment_rsvp_tokens (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade default public.current_clinic_id(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists appointment_rsvp_tokens_appointment_id_idx on public.appointment_rsvp_tokens (appointment_id);

create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict default public.current_clinic_id(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  dentist_id uuid not null references public.profiles (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete set null,
  chief_complaint text,
  clinical_notes text,
  diagnosis text,
  treatment_plan text,
  tooth_map jsonb,
  attachments jsonb[] not null default '{}',
  signed_by uuid references public.profiles (id) on delete set null,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists medical_records_patient_created_at_idx on public.medical_records (patient_id, created_at desc);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict default public.current_clinic_id(),
  patient_id uuid references public.patients (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  type text not null check (type in ('income','expense')),
  category text,
  description text,
  amount numeric not null,
  due_date date,
  paid_date date,
  status text not null check (status in ('pending','paid','overdue','cancelled')) default 'pending',
  payment_method text check (payment_method in ('cash','credit_card','debit_card','pix','insurance','installment')),
  installments int,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists financial_transactions_clinic_due_date_idx on public.financial_transactions (clinic_id, due_date);

create table if not exists public.anamnesis (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict default public.current_clinic_id(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  answered_at timestamptz,
  responses jsonb,
  allergies text[] not null default '{}',
  medications text[] not null default '{}',
  health_conditions text[] not null default '{}',
  smoker boolean,
  pregnant boolean
);

create table if not exists public.return_controls (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict default public.current_clinic_id(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  procedure_id uuid references public.procedures (id) on delete set null,
  last_visit date,
  next_return_date date,
  reminder_sent boolean not null default false,
  notes text
);

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
  insert into public.clinics (name)
  values (p_clinic_name)
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

create or replace function public.rsvp_appointment(
  p_token text,
  p_action text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.appointment_rsvp_tokens%rowtype;
  v_status text;
begin
  select * into v_row from public.appointment_rsvp_tokens where token = p_token limit 1;
  if v_row.id is null then
    return 'invalid_token';
  end if;
  if v_row.expires_at <= now() then
    return 'expired_token';
  end if;
  if v_row.used_at is not null then
    return 'already_used';
  end if;

  if lower(p_action) in ('confirm','confirmar','confirmed') then
    v_status := 'confirmed';
  elsif lower(p_action) in ('cancel','cancelar','cancelled') then
    v_status := 'cancelled';
  else
    return 'invalid_action';
  end if;

  update public.appointments set status = v_status where id = v_row.appointment_id;
  update public.appointment_rsvp_tokens set used_at = now() where id = v_row.id;
  return v_status;
end;
$$;

revoke all on function public.rsvp_appointment(text, text) from public;
grant execute on function public.rsvp_appointment(text, text) to anon;
grant execute on function public.rsvp_appointment(text, text) to authenticated;

alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.medical_records enable row level security;
alter table public.procedures enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.anamnesis enable row level security;
alter table public.return_controls enable row level security;
alter table public.appointment_rsvp_tokens enable row level security;

create policy clinics_select_own
on public.clinics
for select
to authenticated
using (id = public.current_clinic_id());

create policy clinics_update_own_admin
on public.clinics
for update
to authenticated
using (id = public.current_clinic_id() and public.current_role() = 'admin')
with check (id = public.current_clinic_id() and public.current_role() = 'admin');

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

create policy profiles_admin_write
on public.profiles
for all
to authenticated
using (clinic_id = public.current_clinic_id() and public.current_role() = 'admin')
with check (clinic_id = public.current_clinic_id() and public.current_role() = 'admin');

create policy patients_crud_same_clinic
on public.patients
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

create policy procedures_crud_same_clinic
on public.procedures
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

create policy appointments_crud_same_clinic
on public.appointments
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

create policy medical_records_crud_same_clinic
on public.medical_records
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

create policy financial_transactions_crud_same_clinic
on public.financial_transactions
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

create policy anamnesis_crud_same_clinic
on public.anamnesis
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

create policy return_controls_crud_same_clinic
on public.return_controls
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

drop policy if exists appointment_rsvp_tokens_select_same_clinic on public.appointment_rsvp_tokens;
create policy appointment_rsvp_tokens_select_same_clinic
on public.appointment_rsvp_tokens
for select
to authenticated
using (clinic_id = public.current_clinic_id());

drop policy if exists appointment_rsvp_tokens_insert_same_clinic on public.appointment_rsvp_tokens;
create policy appointment_rsvp_tokens_insert_same_clinic
on public.appointment_rsvp_tokens
for insert
to authenticated
with check (clinic_id = public.current_clinic_id());
