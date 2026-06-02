-- DentalFlow - dados de exemplo (executar com Supabase CLI: supabase db reset)

do $$
declare
  v_instance_id uuid;
begin
  select id into v_instance_id from auth.instances limit 1;
  if v_instance_id is null then
    raise exception 'auth.instances não encontrado';
  end if;

  insert into public.clinics (id, name, cnpj, address)
  values (
    '11111111-1111-1111-1111-111111111111',
    'Clínica DentalFlow (Demo)',
    '12.345.678/0001-90',
    jsonb_build_object(
      'street','Av. Brasil',
      'number','1200',
      'neighborhood','Centro',
      'city','São Paulo',
      'state','SP',
      'zip','01000-000'
    )
  )
  on conflict (id) do nothing;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  values
    (v_instance_id, '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'admin@dentalflow.local', crypt('12345678', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dra. Camila Souza"}', false),
    (v_instance_id, '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'dentista1@dentalflow.local', crypt('12345678', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Rafael Lima"}', false),
    (v_instance_id, '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'dentista2@dentalflow.local', crypt('12345678', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dra. Juliana Rocha"}', false)
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', jsonb_build_object('sub','22222222-2222-2222-2222-222222222222','email','admin@dentalflow.local'), 'email', now(), now(), now()),
    (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', jsonb_build_object('sub','33333333-3333-3333-3333-333333333333','email','dentista1@dentalflow.local'), 'email', now(), now(), now()),
    (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', jsonb_build_object('sub','44444444-4444-4444-4444-444444444444','email','dentista2@dentalflow.local'), 'email', now(), now(), now())
  on conflict do nothing;

  insert into public.profiles (id, clinic_id, full_name, role, cro, specialty, phone, color, active)
  values
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Dra. Camila Souza', 'admin', 'CRO-SP 12345', 'Ortodontia', '(11) 99999-1000', '#1E3A5F', true),
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Dr. Rafael Lima', 'dentist', 'CRO-SP 23456', 'Dentística', '(11) 99999-2000', '#10B981', true),
    ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Dra. Juliana Rocha', 'dentist', 'CRO-SP 34567', 'Endodontia', '(11) 99999-3000', '#F59E0B', true)
  on conflict (id) do update set
    clinic_id = excluded.clinic_id,
    full_name = excluded.full_name,
    role = excluded.role,
    cro = excluded.cro,
    specialty = excluded.specialty,
    phone = excluded.phone,
    color = excluded.color,
    active = excluded.active;

  insert into public.procedures (id, clinic_id, name, category, duration_minutes, base_price, description, active)
  values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'Avaliação Inicial', 'Diagnóstico', 30, 150, 'Consulta inicial com avaliação clínica.', true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111', 'Profilaxia', 'Prevenção', 40, 180, 'Limpeza e orientação de higiene.', true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '11111111-1111-1111-1111-111111111111', 'Restauração em Resina', 'Dentística', 60, 280, 'Restauração estética em resina composta.', true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '11111111-1111-1111-1111-111111111111', 'Tratamento de Canal', 'Endodontia', 90, 900, 'Endodontia em dente unitário.', true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '11111111-1111-1111-1111-111111111111', 'Extração Simples', 'Cirurgia', 45, 350, 'Exodontia simples.', true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', '11111111-1111-1111-1111-111111111111', 'Radiografia Periapical', 'Radiologia', 15, 80, 'Imagem para diagnóstico.', true)
  on conflict (id) do nothing;

  insert into public.patients (id, clinic_id, name, cpf, birth_date, phone, whatsapp, email, address, gender, blood_type, observations, active)
  values
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '11111111-1111-1111-1111-111111111111', 'Mariana Alves', '52998224725', '1992-08-14', '(11) 98888-1111', '(11) 98888-1111', 'mariana.alves@email.com', jsonb_build_object('street','Rua das Flores','number','45','neighborhood','Jardins','city','São Paulo','state','SP','zip','01400-000'), 'F', 'O+', 'Sensibilidade ao frio.', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '11111111-1111-1111-1111-111111111111', 'Carlos Henrique', '11144477735', '1986-03-22', '(11) 97777-2222', '(11) 97777-2222', 'carlos.h@email.com', jsonb_build_object('street','Rua do Sol','number','120','neighborhood','Vila Mariana','city','São Paulo','state','SP','zip','04100-000'), 'M', 'A+', 'Hipertensão controlada.', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '11111111-1111-1111-1111-111111111111', 'Ana Beatriz Silva', '93541134780', '2001-11-05', '(11) 96666-3333', '(11) 96666-3333', 'ana.bsilva@email.com', jsonb_build_object('street','Av. Paulista','number','900','neighborhood','Bela Vista','city','São Paulo','state','SP','zip','01310-100'), 'F', 'B+', 'Em tratamento ortodôntico.', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '11111111-1111-1111-1111-111111111111', 'João Pedro Santos', '15350946056', '1998-01-30', '(11) 95555-4444', '(11) 95555-4444', 'joao.pedro@email.com', jsonb_build_object('street','Rua da Saúde','number','10','neighborhood','Saúde','city','São Paulo','state','SP','zip','04000-000'), 'M', 'AB+', 'Bruxismo noturno.', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', '11111111-1111-1111-1111-111111111111', 'Fernanda Oliveira', '98765432100', '1979-06-09', '(11) 94444-5555', '(11) 94444-5555', 'fernanda.o@email.com', jsonb_build_object('street','Rua Horizonte','number','300','neighborhood','Moema','city','São Paulo','state','SP','zip','04500-000'), 'F', 'O-', 'Alergia a dipirona.', true)
  on conflict (id) do nothing;

  insert into public.anamnesis (clinic_id, patient_id, answered_at, responses, allergies, medications, health_conditions, smoker, pregnant)
  values
    ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', now() - interval '20 days', jsonb_build_object('pressao_alta', true, 'diabetes', false), array['Penicilina'], array['Losartana'], array['Hipertensão'], false, null),
    ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', now() - interval '10 days', jsonb_build_object('alergias', true, 'cirurgias', false), array['Dipirona'], array[]::text[], array[]::text[], false, null);

  insert into public.appointments (id, clinic_id, patient_id, dentist_id, procedure_id, start_time, end_time, status, notes, room)
  values
    ('cccccccc-cccc-cccc-cccc-ccccccccccc1', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', now() + interval '2 hours', now() + interval '2 hours 40 minutes', 'confirmed', 'Preferência por manhã.', 'Sala 1'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccc2', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', now() + interval '1 day 3 hours', now() + interval '1 day 3 hours 30 minutes', 'scheduled', null, 'Sala 2'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccc3', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', now() + interval '2 days 4 hours', now() + interval '2 days 5 hours', 'scheduled', null, 'Sala 1'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccc4', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', now() - interval '7 days', now() - interval '7 days' + interval '15 minutes', 'completed', 'Radiografia para avaliação.', 'Sala 2'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccc5', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', now() - interval '30 days', now() - interval '30 days' + interval '45 minutes', 'no_show', null, 'Sala 1'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccc6', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', now() + interval '3 days 2 hours', now() + interval '3 days 2 hours 30 minutes', 'scheduled', null, 'Sala 1'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccc7', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', now() + interval '4 days 1 hours', now() + interval '4 days 1 hours 40 minutes', 'scheduled', null, 'Sala 2'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccc8', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', now() + interval '5 days 5 hours', now() + interval '5 days 6 hours 30 minutes', 'scheduled', 'Trazer exames.', 'Sala 1'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccc9', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', now() - interval '60 days', now() - interval '60 days' + interval '60 minutes', 'completed', null, 'Sala 1'),
    ('cccccccc-cccc-cccc-cccc-cccccccccc10', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', now() - interval '95 days', now() - interval '95 days' + interval '40 minutes', 'completed', null, 'Sala 2')
  on conflict (id) do nothing;

  insert into public.medical_records (clinic_id, patient_id, dentist_id, appointment_id, chief_complaint, clinical_notes, diagnosis, treatment_plan, tooth_map, signed_by, signed_at, created_at)
  values
    (
      '11111111-1111-1111-1111-111111111111',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
      '33333333-3333-3333-3333-333333333333',
      'cccccccc-cccc-cccc-cccc-ccccccccccc4',
      'Dor ao mastigar',
      'Paciente relata dor leve ao mastigar no dente 36. Testes de sensibilidade realizados. Radiografia periapical anexada no prontuário.',
      'Suspeita de trinca dental',
      'Acompanhamento + ajuste oclusal se necessário',
      jsonb_build_object('36', jsonb_build_object('status','fraturado','treatment','avaliação')),
      '33333333-3333-3333-3333-333333333333',
      now() - interval '7 days',
      now() - interval '7 days'
    )
  on conflict do nothing;

  insert into public.financial_transactions (id, clinic_id, patient_id, appointment_id, type, category, description, amount, due_date, paid_date, status, payment_method, installments, notes)
  values
    ('dddddddd-dddd-dddd-dddd-ddddddddddd1', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'cccccccc-cccc-cccc-cccc-ccccccccccc4', 'income', 'Radiologia', 'Radiografia periapical', 80, (now() - interval '7 days')::date, (now() - interval '7 days')::date, 'paid', 'pix', null, null),
    ('dddddddd-dddd-dddd-dddd-ddddddddddd2', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', null, 'income', 'Prevenção', 'Profilaxia', 180, (now() + interval '2 days')::date, null, 'pending', 'credit_card', null, null),
    ('dddddddd-dddd-dddd-dddd-ddddddddddd3', '11111111-1111-1111-1111-111111111111', null, null, 'expense', 'Materiais', 'Compra de materiais clínicos', 420, (now() - interval '2 days')::date, null, 'overdue', 'pix', null, 'Fornecedor: DentalSupplies')
  on conflict (id) do nothing;

  insert into public.return_controls (clinic_id, patient_id, procedure_id, last_visit, next_return_date, reminder_sent, notes)
  values
    ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', (now() - interval '95 days')::date, (now() - interval '5 days')::date, false, 'Retorno anual de profilaxia.'),
    ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', (now() - interval '60 days')::date, (now() + interval '30 days')::date, false, null);
end $$;
