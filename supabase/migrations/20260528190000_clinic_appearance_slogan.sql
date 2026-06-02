do $$
begin
  begin
    alter table public.clinics add column if not exists slogan text;
  exception
    when others then
      null;
  end;
end $$;
