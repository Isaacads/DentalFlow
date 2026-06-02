-- DentalFlow - Storage bucket e políticas

do $$
begin
  begin
    execute 'set local role supabase_storage_admin';
  exception
    when others then
      begin
        execute 'set local role supabase_admin';
      exception
        when others then
          null;
      end;
  end;

  begin
    execute $sql$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values (
        'medical-attachments',
        'medical-attachments',
        false,
        10485760,
        array['image/png','image/jpeg','image/jpg','application/pdf']
      )
      on conflict (id) do nothing
    $sql$;
  exception
    when others then
      null;
  end;

  begin
    execute 'alter table storage.objects enable row level security';
  exception
    when others then
      null;
  end;

  begin
    execute $sql$
      create policy storage_objects_read_own_clinic
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'medical-attachments'
        and split_part(name, '/', 1)::uuid = public.current_clinic_id()
      )
    $sql$;
  exception
    when duplicate_object then
      null;
  end;

  begin
    execute $sql$
      create policy storage_objects_write_own_clinic
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'medical-attachments'
        and split_part(name, '/', 1)::uuid = public.current_clinic_id()
      )
    $sql$;
  exception
    when duplicate_object then
      null;
  end;

  begin
    execute $sql$
      create policy storage_objects_update_own_clinic
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'medical-attachments'
        and split_part(name, '/', 1)::uuid = public.current_clinic_id()
      )
      with check (
        bucket_id = 'medical-attachments'
        and split_part(name, '/', 1)::uuid = public.current_clinic_id()
      )
    $sql$;
  exception
    when duplicate_object then
      null;
  end;

  begin
    execute $sql$
      create policy storage_objects_delete_own_clinic
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'medical-attachments'
        and split_part(name, '/', 1)::uuid = public.current_clinic_id()
      )
    $sql$;
  exception
    when duplicate_object then
      null;
  end;
end $$;
