-- Billing integration (Kiwify)
-- Adds billing columns to clinics, an idempotency table for webhook events and
-- service-role functions to provision a paid clinic and update payment status.

-- 1) Billing columns on clinics ------------------------------------------------
alter table public.clinics add column if not exists billing_provider text;
alter table public.clinics add column if not exists billing_subscription_id text;
alter table public.clinics add column if not exists payment_status text not null default 'active';

do $$
begin
  alter table public.clinics drop constraint if exists clinics_payment_status_check;
  alter table public.clinics add constraint clinics_payment_status_check check (payment_status in ('active','past_due'));
exception
  when duplicate_object then null;
end
$$;

create unique index if not exists clinics_billing_subscription_id_key
  on public.clinics (billing_subscription_id)
  where billing_subscription_id is not null;

-- 2) Idempotency table for webhook events --------------------------------------
create table if not exists public.billing_events (
  id text primary key,
  type text,
  created_at timestamptz not null default now()
);

alter table public.billing_events enable row level security;
-- No policies: only the service_role (which bypasses RLS) can read/write.

-- 3) Allow service_role (auth.uid() is null) to change the plan tier -----------
-- Manual users still require ownership; the webhook runs without a session.
create or replace function public.enforce_clinic_plan_change_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan_tier is distinct from old.plan_tier then
    if auth.uid() is not null and not public.current_is_owner() then
      raise exception 'Apenas o titular pode alterar o plano.';
    end if;
  end if;
  return new;
end;
$$;

-- 4) Provision a paid clinic (idempotent, service_role only) -------------------
create or replace function public.provision_paid_clinic(
  p_user_id uuid,
  p_clinic_name text,
  p_full_name text,
  p_plan_tier text,
  p_billing_provider text,
  p_billing_subscription_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_tier text := coalesce(nullif(p_plan_tier, ''), 'essential');
begin
  if v_tier not in ('essential','clinic','management') then
    v_tier := 'essential';
  end if;

  -- Idempotent by billing_subscription_id: same subscription => update clinic.
  if p_billing_subscription_id is not null then
    select id into v_clinic_id
      from public.clinics
     where billing_subscription_id = p_billing_subscription_id
     limit 1;

    if v_clinic_id is not null then
      update public.clinics
         set plan_tier = v_tier,
             billing_provider = coalesce(p_billing_provider, billing_provider),
             payment_status = 'active'
       where id = v_clinic_id;
      return v_clinic_id;
    end if;
  end if;

  -- User already owns a clinic (re-purchase / manual account): link billing ids.
  select clinic_id into v_clinic_id
    from public.profiles
   where id = p_user_id
   limit 1;

  if v_clinic_id is not null then
    update public.clinics
       set plan_tier = v_tier,
           billing_provider = coalesce(p_billing_provider, billing_provider),
           billing_subscription_id = coalesce(p_billing_subscription_id, billing_subscription_id),
           payment_status = 'active'
     where id = v_clinic_id;
    return v_clinic_id;
  end if;

  -- Fresh provisioning: create clinic + admin profile.
  insert into public.clinics (name, owner_id, plan_tier, billing_provider, billing_subscription_id, payment_status)
  values (coalesce(nullif(p_clinic_name, ''), 'Minha Clínica'), p_user_id, v_tier, p_billing_provider, p_billing_subscription_id, 'active')
  returning id into v_clinic_id;

  insert into public.profiles (id, clinic_id, full_name, role, active)
  values (p_user_id, v_clinic_id, p_full_name, 'admin', true)
  on conflict (id) do update
    set clinic_id = excluded.clinic_id,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        role = 'admin',
        active = true;

  return v_clinic_id;
end;
$$;

revoke all on function public.provision_paid_clinic(uuid, text, text, text, text, text) from public;
revoke all on function public.provision_paid_clinic(uuid, text, text, text, text, text) from authenticated;
grant execute on function public.provision_paid_clinic(uuid, text, text, text, text, text) to service_role;

-- 5) Update payment status by subscription id (service_role only) --------------
create or replace function public.set_clinic_payment_status_by_subscription(
  p_billing_subscription_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('active','past_due') then
    raise exception 'Status de pagamento inválido.';
  end if;
  if p_billing_subscription_id is null then
    return;
  end if;
  update public.clinics
     set payment_status = p_status
   where billing_subscription_id = p_billing_subscription_id;
end;
$$;

revoke all on function public.set_clinic_payment_status_by_subscription(text, text) from public;
revoke all on function public.set_clinic_payment_status_by_subscription(text, text) from authenticated;
grant execute on function public.set_clinic_payment_status_by_subscription(text, text) to service_role;
