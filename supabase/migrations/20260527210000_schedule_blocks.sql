create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade default public.current_clinic_id(),
  dentist_id uuid references public.profiles (id) on delete restrict,
  start_time timestamptz not null,
  end_time timestamptz not null,
  title text not null default 'Bloqueio',
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists schedule_blocks_clinic_start_time_idx on public.schedule_blocks (clinic_id, start_time);
create index if not exists schedule_blocks_dentist_start_time_idx on public.schedule_blocks (dentist_id, start_time);

alter table public.schedule_blocks enable row level security;

drop policy if exists schedule_blocks_select_same_clinic on public.schedule_blocks;
create policy schedule_blocks_select_same_clinic
on public.schedule_blocks
for select
to authenticated
using (clinic_id = public.current_clinic_id());

drop policy if exists schedule_blocks_insert_staff on public.schedule_blocks;
create policy schedule_blocks_insert_staff
on public.schedule_blocks
for insert
to authenticated
with check (
  clinic_id = public.current_clinic_id()
  and (
    public.current_role() in ('admin','receptionist')
    or (public.current_role() = 'dentist' and dentist_id = auth.uid())
  )
);

drop policy if exists schedule_blocks_update_staff on public.schedule_blocks;
create policy schedule_blocks_update_staff
on public.schedule_blocks
for update
to authenticated
using (
  clinic_id = public.current_clinic_id()
  and (
    public.current_role() in ('admin','receptionist')
    or (public.current_role() = 'dentist' and dentist_id = auth.uid())
  )
)
with check (
  clinic_id = public.current_clinic_id()
  and (
    public.current_role() in ('admin','receptionist')
    or (public.current_role() = 'dentist' and dentist_id = auth.uid())
  )
);

drop policy if exists schedule_blocks_delete_staff on public.schedule_blocks;
create policy schedule_blocks_delete_staff
on public.schedule_blocks
for delete
to authenticated
using (
  clinic_id = public.current_clinic_id()
  and (
    public.current_role() in ('admin','receptionist')
    or (public.current_role() = 'dentist' and dentist_id = auth.uid())
  )
);

create or replace function public.assert_no_schedule_block_conflict()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflict boolean;
begin
  select exists (
    select 1
    from public.schedule_blocks b
    where b.clinic_id = coalesce(new.clinic_id, public.current_clinic_id())
      and (b.dentist_id is null or b.dentist_id = new.dentist_id)
      and b.start_time < new.end_time
      and b.end_time > new.start_time
  ) into v_conflict;

  if v_conflict then
    raise exception 'Horário bloqueado.';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_block_conflict on public.appointments;
create trigger appointments_block_conflict
before insert or update of start_time, end_time, dentist_id on public.appointments
for each row execute function public.assert_no_schedule_block_conflict();

