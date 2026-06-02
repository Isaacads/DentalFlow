alter table public.clinics add column if not exists plan_tier text not null default 'essential';

do $$
begin
  alter table public.clinics drop constraint if exists clinics_plan_tier_check;
  alter table public.clinics add constraint clinics_plan_tier_check check (plan_tier in ('essential','clinic','management'));
exception
  when duplicate_object then null;
end
$$;

create or replace function public.enforce_clinic_plan_change_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan_tier is distinct from old.plan_tier then
    if not public.current_is_owner() then
      raise exception 'Apenas o titular pode alterar o plano.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists clinics_enforce_plan_change on public.clinics;
create trigger clinics_enforce_plan_change
before update on public.clinics
for each row execute function public.enforce_clinic_plan_change_owner();

