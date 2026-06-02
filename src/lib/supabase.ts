import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ""
const envAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ""

const isRealSupabase = Boolean(envUrl && envAnonKey)

type DemoDb = {
  clinics: Array<Record<string, unknown>>
  booking_requests: Array<Record<string, unknown>>
  whatsapp_messages: Array<Record<string, unknown>>
  profiles: Array<Record<string, unknown>>
  patients: Array<Record<string, unknown>>
  procedures: Array<Record<string, unknown>>
  appointments: Array<Record<string, unknown>>
  schedule_blocks: Array<Record<string, unknown>>
  medical_records: Array<Record<string, unknown>>
  financial_transactions: Array<Record<string, unknown>>
  anamnesis: Array<Record<string, unknown>>
  return_controls: Array<Record<string, unknown>>
  appointment_rsvp_tokens: Array<Record<string, unknown>>
}

type DemoSession = { user: { id: string; email: string } } | null

const demoDbKey = "dentalflow.demo.db"
const demoSessionKey = "dentalflow.demo.session"

function nowIso() {
  return new Date().toISOString()
}

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

function seedDemoDb(): DemoDb {
  const clinicId = "11111111-1111-1111-1111-111111111111"
  const adminId = "22222222-2222-2222-2222-222222222222"
  const dentist1Id = "33333333-3333-3333-3333-333333333333"
  const dentist2Id = "44444444-4444-4444-4444-444444444444"

  const workingHours = {
    "1": [
      { start: "08:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ],
    "2": [
      { start: "08:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ],
    "3": [
      { start: "08:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ],
    "4": [
      { start: "08:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ],
    "5": [
      { start: "08:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ],
    "6": [{ start: "08:00", end: "12:00" }],
    "0": [],
  }

  const procedures = [
    { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", clinic_id: clinicId, name: "Avaliação Inicial", category: "Diagnóstico", duration_minutes: 30, base_price: 150, description: "Consulta inicial com avaliação clínica.", active: true, created_at: nowIso(), updated_at: nowIso() },
    { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", clinic_id: clinicId, name: "Profilaxia", category: "Prevenção", duration_minutes: 40, base_price: 180, description: "Limpeza e orientação de higiene.", active: true, created_at: nowIso(), updated_at: nowIso() },
    { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", clinic_id: clinicId, name: "Restauração em Resina", category: "Dentística", duration_minutes: 60, base_price: 280, description: "Restauração estética em resina composta.", active: true, created_at: nowIso(), updated_at: nowIso() },
    { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4", clinic_id: clinicId, name: "Tratamento de Canal", category: "Endodontia", duration_minutes: 90, base_price: 900, description: "Endodontia em dente unitário.", active: true, created_at: nowIso(), updated_at: nowIso() },
    { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5", clinic_id: clinicId, name: "Extração Simples", category: "Cirurgia", duration_minutes: 45, base_price: 350, description: "Exodontia simples.", active: true, created_at: nowIso(), updated_at: nowIso() },
    { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6", clinic_id: clinicId, name: "Radiografia Periapical", category: "Radiologia", duration_minutes: 15, base_price: 80, description: "Imagem para diagnóstico.", active: true, created_at: nowIso(), updated_at: nowIso() },
  ]

  const patients = [
    {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
      clinic_id: clinicId,
      name: "Mariana Alves",
      cpf: "52998224725",
      birth_date: "1992-08-14",
      phone: "(11) 98888-1111",
      whatsapp: "(11) 98888-1111",
      email: "mariana.alves@email.com",
      address: { street: "Rua das Flores", number: "45", neighborhood: "Jardins", city: "São Paulo", state: "SP", zip: "01400-000" },
      gender: "F",
      blood_type: "O+",
      observations: "Sensibilidade ao frio.",
      active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
      clinic_id: clinicId,
      name: "Carlos Henrique",
      cpf: "11144477735",
      birth_date: "1986-03-22",
      phone: "(11) 97777-2222",
      whatsapp: "(11) 97777-2222",
      email: "carlos.h@email.com",
      address: { street: "Rua do Sol", number: "120", neighborhood: "Vila Mariana", city: "São Paulo", state: "SP", zip: "04100-000" },
      gender: "M",
      blood_type: "A+",
      observations: "Hipertensão controlada.",
      active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3",
      clinic_id: clinicId,
      name: "Ana Beatriz Silva",
      cpf: "93541134780",
      birth_date: "2001-11-05",
      phone: "(11) 96666-3333",
      whatsapp: "(11) 96666-3333",
      email: "ana.bsilva@email.com",
      address: { street: "Av. Paulista", number: "900", neighborhood: "Bela Vista", city: "São Paulo", state: "SP", zip: "01310-100" },
      gender: "F",
      blood_type: "B+",
      observations: "Em tratamento ortodôntico.",
      active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4",
      clinic_id: clinicId,
      name: "João Pedro Santos",
      cpf: "15350946056",
      birth_date: "1998-01-30",
      phone: "(11) 95555-4444",
      whatsapp: "(11) 95555-4444",
      email: "joao.pedro@email.com",
      address: { street: "Rua da Saúde", number: "10", neighborhood: "Saúde", city: "São Paulo", state: "SP", zip: "04000-000" },
      gender: "M",
      blood_type: "AB+",
      observations: "Bruxismo noturno.",
      active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5",
      clinic_id: clinicId,
      name: "Fernanda Oliveira",
      cpf: "98765432100",
      birth_date: "1979-06-09",
      phone: "(11) 94444-5555",
      whatsapp: "(11) 94444-5555",
      email: "fernanda.o@email.com",
      address: { street: "Rua Horizonte", number: "300", neighborhood: "Moema", city: "São Paulo", state: "SP", zip: "04500-000" },
      gender: "F",
      blood_type: "O-",
      observations: "Alergia a dipirona.",
      active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ]

  const profiles = [
    { id: adminId, clinic_id: clinicId, full_name: "Dra. Camila Souza", role: "admin", cro: "CRO-SP 12345", specialty: "Ortodontia", phone: "(11) 99999-1000", color: "#1E3A5F", active: true, avatar_url: null, created_at: nowIso(), updated_at: nowIso() },
    { id: dentist1Id, clinic_id: clinicId, full_name: "Dr. Rafael Lima", role: "dentist", cro: "CRO-SP 23456", specialty: "Dentística", phone: "(11) 99999-2000", color: "#10B981", active: true, avatar_url: null, created_at: nowIso(), updated_at: nowIso() },
    { id: dentist2Id, clinic_id: clinicId, full_name: "Dra. Juliana Rocha", role: "dentist", cro: "CRO-SP 34567", specialty: "Endodontia", phone: "(11) 99999-3000", color: "#F59E0B", active: true, avatar_url: null, created_at: nowIso(), updated_at: nowIso() },
  ]

  const clinics = [
    {
      id: clinicId,
      name: "Clínica AMMI DentalFlow (Demo)",
      owner_id: adminId,
      plan_tier: "management",
      booking_enabled: true,
      booking_slug: "demo",
      booking_window_days: 14,
      booking_lead_time_hours: 2,
      booking_mode: "auto",
      working_hours: workingHours,
      cnpj: "12.345.678/0001-90",
      address: { street: "Av. Brasil", number: "1200", neighborhood: "Centro", city: "São Paulo", state: "SP", zip: "01000-000" },
      logo_url: null,
      whatsapp_confirmation_template: "Olá, {nome}! Confirmamos sua consulta em {data} às {hora}. Responda CONFIRMO para confirmar.",
      whatsapp_enabled: false,
      whatsapp_auto_confirm: false,
      whatsapp_auto_cancel: false,
      whatsapp_cancel_template: "",
      whatsapp_return_template: "",
      return_enabled: true,
      return_default_days: 180,
      return_reminder_enabled: false,
      return_reminder_days_before: 7,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ]

  const appt = (id: string, patient_id: string, dentist_id: string, procedure_id: string | null, start: Date, minutes: number, status: string, room: string, notes: string | null) => ({
    id,
    clinic_id: clinicId,
    patient_id,
    dentist_id,
    procedure_id,
    start_time: start.toISOString(),
    end_time: new Date(start.getTime() + minutes * 60 * 1000).toISOString(),
    status,
    notes,
    room,
    created_via: "internal",
    created_at: nowIso(),
  })

  const base = new Date()
  const appointments = [
    appt("cccccccc-cccc-cccc-cccc-ccccccccccc1", patients[0].id, dentist1Id, procedures[1].id, new Date(base.getTime() + 2 * 60 * 60 * 1000), 40, "confirmed", "Sala 1", "Preferência por manhã."),
    appt("cccccccc-cccc-cccc-cccc-ccccccccccc2", patients[1].id, dentist2Id, procedures[0].id, new Date(base.getTime() + (24 + 3) * 60 * 60 * 1000), 30, "scheduled", "Sala 2", null),
    appt("cccccccc-cccc-cccc-cccc-ccccccccccc3", patients[2].id, adminId, procedures[2].id, new Date(base.getTime() + (48 + 4) * 60 * 60 * 1000), 60, "scheduled", "Sala 1", null),
    appt("cccccccc-cccc-cccc-cccc-ccccccccccc4", patients[3].id, dentist1Id, procedures[5].id, new Date(base.getTime() - 7 * 24 * 60 * 60 * 1000), 15, "completed", "Sala 2", "Radiografia para avaliação."),
    appt("cccccccc-cccc-cccc-cccc-ccccccccccc5", patients[4].id, dentist2Id, procedures[4].id, new Date(base.getTime() - 30 * 24 * 60 * 60 * 1000), 45, "no_show", "Sala 1", null),
    appt("cccccccc-cccc-cccc-cccc-ccccccccccc6", patients[0].id, adminId, procedures[0].id, new Date(base.getTime() + (72 + 2) * 60 * 60 * 1000), 30, "scheduled", "Sala 1", null),
    appt("cccccccc-cccc-cccc-cccc-ccccccccccc7", patients[1].id, dentist1Id, procedures[1].id, new Date(base.getTime() + (96 + 1) * 60 * 60 * 1000), 40, "scheduled", "Sala 2", null),
    appt("cccccccc-cccc-cccc-cccc-ccccccccccc8", patients[2].id, dentist2Id, procedures[3].id, new Date(base.getTime() + (120 + 5) * 60 * 60 * 1000), 90, "scheduled", "Sala 1", "Trazer exames."),
    appt("cccccccc-cccc-cccc-cccc-ccccccccccc9", patients[3].id, adminId, procedures[2].id, new Date(base.getTime() - 60 * 24 * 60 * 60 * 1000), 60, "completed", "Sala 1", null),
    appt("cccccccc-cccc-cccc-cccc-cccccccccc10", patients[4].id, dentist1Id, procedures[1].id, new Date(base.getTime() - 95 * 24 * 60 * 60 * 1000), 40, "completed", "Sala 2", null),
  ]

  const medical_records = [
    {
      id: crypto.randomUUID(),
      clinic_id: clinicId,
      patient_id: patients[3].id,
      dentist_id: dentist1Id,
      appointment_id: "cccccccc-cccc-cccc-cccc-ccccccccccc4",
      chief_complaint: "Dor ao mastigar",
      clinical_notes:
        "Paciente relata dor leve ao mastigar no dente 36. Testes de sensibilidade realizados. Radiografia periapical anexada no prontuário.",
      diagnosis: "Suspeita de trinca dental",
      treatment_plan: "Acompanhamento + ajuste oclusal se necessário",
      tooth_map: { "36": { status: "fraturado", treatment: "avaliação" } },
      attachments: [],
      signed_by: dentist1Id,
      signed_at: new Date(base.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(base.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]

  const financial_transactions = [
    { id: "dddddddd-dddd-dddd-dddd-ddddddddddd1", clinic_id: clinicId, patient_id: patients[3].id, appointment_id: "cccccccc-cccc-cccc-cccc-ccccccccccc4", type: "income", category: "Radiologia", description: "Radiografia periapical", amount: 80, due_date: new Date(base.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), paid_date: new Date(base.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: "paid", payment_method: "pix", installments: null, notes: null, created_at: nowIso() },
    { id: "dddddddd-dddd-dddd-dddd-ddddddddddd2", clinic_id: clinicId, patient_id: patients[0].id, appointment_id: null, type: "income", category: "Prevenção", description: "Profilaxia", amount: 180, due_date: new Date(base.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), paid_date: null, status: "pending", payment_method: "credit_card", installments: null, notes: null, created_at: nowIso() },
    { id: "dddddddd-dddd-dddd-dddd-ddddddddddd3", clinic_id: clinicId, patient_id: null, appointment_id: null, type: "expense", category: "Materiais", description: "Compra de materiais clínicos", amount: 420, due_date: new Date(base.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), paid_date: null, status: "overdue", payment_method: "pix", installments: null, notes: "Fornecedor: DentalSupplies", created_at: nowIso() },
  ]

  const anamnesis = [
    { id: crypto.randomUUID(), clinic_id: clinicId, patient_id: patients[1].id, answered_at: new Date(base.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(), responses: { pressao_alta: true, diabetes: false }, allergies: ["Penicilina"], medications: ["Losartana"], health_conditions: ["Hipertensão"], smoker: false, pregnant: null },
    { id: crypto.randomUUID(), clinic_id: clinicId, patient_id: patients[4].id, answered_at: new Date(base.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), responses: { alergias: true, cirurgias: false }, allergies: ["Dipirona"], medications: [], health_conditions: [], smoker: false, pregnant: null },
  ]

  const return_controls = [
    { id: crypto.randomUUID(), clinic_id: clinicId, patient_id: patients[4].id, procedure_id: procedures[1].id, last_visit: new Date(base.getTime() - 95 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), next_return_date: new Date(base.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), reminder_sent: false, notes: "Retorno anual de profilaxia." },
    { id: crypto.randomUUID(), clinic_id: clinicId, patient_id: patients[3].id, procedure_id: procedures[0].id, last_visit: new Date(base.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), next_return_date: new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), reminder_sent: false, notes: null },
  ]

  return {
    clinics,
    booking_requests: [],
    whatsapp_messages: [],
    profiles,
    patients,
    procedures,
    appointments,
    schedule_blocks: [],
    medical_records,
    financial_transactions,
    anamnesis,
    return_controls,
    appointment_rsvp_tokens: [],
  }
}

function getDemoDb(): DemoDb {
  const existing = readJson<DemoDb>(demoDbKey)
  if (existing) {
    const next: DemoDb = {
      clinics: existing.clinics ?? [],
      booking_requests: (existing as unknown as { booking_requests?: Array<Record<string, unknown>> }).booking_requests ?? [],
      whatsapp_messages: (existing as unknown as { whatsapp_messages?: Array<Record<string, unknown>> }).whatsapp_messages ?? [],
      profiles: existing.profiles ?? [],
      patients: existing.patients ?? [],
      procedures: existing.procedures ?? [],
      appointments: existing.appointments ?? [],
      schedule_blocks: existing.schedule_blocks ?? [],
      medical_records: existing.medical_records ?? [],
      financial_transactions: existing.financial_transactions ?? [],
      anamnesis: existing.anamnesis ?? [],
      return_controls: existing.return_controls ?? [],
      appointment_rsvp_tokens: existing.appointment_rsvp_tokens ?? [],
    }
    if ((existing as unknown as { booking_requests?: unknown }).booking_requests == null || (existing as unknown as { whatsapp_messages?: unknown }).whatsapp_messages == null)
      setDemoDb(next)
    return next
  }
  const seeded = seedDemoDb()
  writeJson(demoDbKey, seeded)
  return seeded
}

function setDemoDb(next: DemoDb) {
  writeJson(demoDbKey, next)
}

function getDemoSession(): DemoSession {
  return readJson<DemoSession>(demoSessionKey)
}

function setDemoSession(session: DemoSession) {
  writeJson(demoSessionKey, session)
}

function like(value: unknown, pattern: string) {
  const s = String(value ?? "").toLowerCase()
  const p = pattern.toLowerCase().replace(/%/g, "")
  return s.includes(p)
}

type OrderSpec = { ascending?: boolean; nullsFirst?: boolean }

class DemoQuery {
  private table: keyof DemoDb
  private filters: Array<(row: Record<string, unknown>) => boolean> = []
  private orderBy: { field: string; spec: OrderSpec } | null = null
  private limitN: number | null = null
  private selectSpec: string | null = null
  private countMode: { head?: boolean; count?: "exact" } | null = null

  constructor(table: keyof DemoDb) {
    this.table = table
  }

  select(spec: string, opts?: { head?: boolean; count?: "exact" }) {
    this.selectSpec = spec
    if (opts?.head || opts?.count) this.countMode = opts
    return this
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value)
    return this
  }

  in(field: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[field]))
    return this
  }

  ilike(field: string, pattern: string) {
    this.filters.push((row) => like(row[field], pattern))
    return this
  }

  or(expr: string) {
    const parts = expr.split(",").map((s) => s.trim()).filter(Boolean)
    this.filters.push((row) => {
      return parts.some((p) => {
        const m = p.match(/^([a-zA-Z0-9_]+)\.ilike\.(.+)$/)
        if (!m) return false
        const field = m[1]
        const pattern = m[2]
        return like(row[field], pattern)
      })
    })
    return this
  }

  gte(field: string, value: string) {
    this.filters.push((row) => String(row[field] ?? "") >= value)
    return this
  }

  lte(field: string, value: string) {
    this.filters.push((row) => String(row[field] ?? "") <= value)
    return this
  }

  lt(field: string, value: string) {
    this.filters.push((row) => String(row[field] ?? "") < value)
    return this
  }

  order(field: string, spec?: OrderSpec) {
    this.orderBy = { field, spec: spec ?? {} }
    return this
  }

  limit(n: number) {
    this.limitN = n
    return this
  }

  private applyJoins(row: Record<string, unknown>) {
    const spec = this.selectSpec ?? "*"
    const tokens = spec.split(",").map((s) => s.trim()).filter(Boolean)
    if (!tokens.some((t) => t.includes(":"))) return row

    const db = getDemoDb()
    const withJoins: Record<string, unknown> = { ...row }

    for (const token of tokens) {
      const match = token.match(/^([a-zA-Z0-9_]+):([a-zA-Z0-9_]+)\((.+)\)$/)
      if (!match) continue
      const alias = match[1]
      const table = match[2] as keyof DemoDb
      const cols = match[3].split(",").map((c) => c.trim()).filter(Boolean)

      let fkField: string | null = null
      if (this.table === "appointments" && alias === "patient") fkField = "patient_id"
      if (this.table === "appointments" && alias === "procedure") fkField = "procedure_id"
      if (this.table === "appointments" && alias === "dentist") fkField = "dentist_id"
      if (this.table === "financial_transactions" && alias === "patient") fkField = "patient_id"
      if (this.table === "return_controls" && alias === "patient") fkField = "patient_id"
      if (this.table === "booking_requests" && alias === "procedure") fkField = "procedure_id"
      if (this.table === "booking_requests" && alias === "dentist") fkField = "dentist_id"
      if (this.table === "whatsapp_messages" && alias === "appointment") fkField = "appointment_id"
      if (this.table === "whatsapp_messages" && alias === "patient") fkField = "patient_id"
      if (!fkField) continue

      const fkValue = row[fkField]
      const target = db[table].find((r) => r.id === fkValue) ?? null
      if (!target) {
        withJoins[alias] = null
        continue
      }
      const picked: Record<string, unknown> = {}
      for (const c of cols) picked[c] = (target as Record<string, unknown>)[c]
      withJoins[alias] = picked
    }
    return withJoins
  }

  private run() {
    const db = getDemoDb()
    let rows = [...db[this.table]]
    for (const f of this.filters) rows = rows.filter(f)
    if (this.orderBy) {
      const { field, spec } = this.orderBy
      const asc = spec.ascending !== false
      const nullsFirst = Boolean(spec.nullsFirst)
      rows.sort((a, b) => {
        const av = a[field]
        const bv = b[field]
        const aNull = av == null
        const bNull = bv == null
        if (aNull && bNull) return 0
        if (aNull) return nullsFirst ? -1 : 1
        if (bNull) return nullsFirst ? 1 : -1
        const cmp = String(av).localeCompare(String(bv))
        return asc ? cmp : -cmp
      })
    }
    const count = rows.length
    if (this.limitN != null) rows = rows.slice(0, this.limitN)
    rows = rows.map((r) => this.applyJoins(r))
    return { rows, count }
  }

  async then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const { rows, count } = this.run()
      const head = Boolean(this.countMode?.head)
      const data = head ? null : rows
      const payload = { data, error: null as null, count: this.countMode?.count ? count : null }
      return Promise.resolve(onfulfilled ? onfulfilled(payload) : (payload as unknown as TResult1))
    } catch (e) {
      if (onrejected) return Promise.resolve(onrejected(e))
      throw e
    }
  }

  single() {
    return {
      then: async (onfulfilled?: ((value: { data: unknown; error: null }) => unknown) | null) => {
        const { rows } = this.run()
        const first = rows[0]
        const payload = { data: first, error: null as null }
        return onfulfilled ? onfulfilled(payload) : payload
      },
    }
  }

  maybeSingle() {
    return {
      then: async (onfulfilled?: ((value: { data: unknown; error: null }) => unknown) | null) => {
        const { rows } = this.run()
        const first = rows[0] ?? null
        const payload = { data: first, error: null as null }
        return onfulfilled ? onfulfilled(payload) : payload
      },
    }
  }
}

class DemoMutation {
  private table: keyof DemoDb
  private op: "insert" | "update" | "delete"
  private payload: Record<string, unknown> | Record<string, unknown>[] | null
  private where: { field: string; value: unknown } | null = null
  private selectSpec: string | null = null
  private wantSingle = false

  constructor(table: keyof DemoDb, op: "insert" | "update" | "delete", payload?: Record<string, unknown> | Record<string, unknown>[]) {
    this.table = table
    this.op = op
    this.payload = payload ?? null
  }

  eq(field: string, value: unknown) {
    this.where = { field, value }
    return this
  }

  select(spec: string) {
    this.selectSpec = spec
    return this
  }

  single() {
    this.wantSingle = true
    return this
  }

  private applyJoin(row: Record<string, unknown>) {
    const q = new DemoQuery(this.table)
    q.select(this.selectSpec ?? "*")
    return (q as unknown as { applyJoins: (r: Record<string, unknown>) => Record<string, unknown> }).applyJoins(row)
  }

  async then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const db = getDemoDb()
      const rows = [...db[this.table]]
      let changed: Record<string, unknown>[] = []

      if (this.op === "insert") {
        const arr = Array.isArray(this.payload) ? this.payload : [this.payload]
        changed = arr.map((p) => {
          const base: Record<string, unknown> = { ...p }
          if (!base.id) base.id = crypto.randomUUID()
          if (!base.created_at) base.created_at = nowIso()
          if (!base.updated_at && (this.table === "patients" || this.table === "procedures" || this.table === "profiles" || this.table === "clinics")) base.updated_at = nowIso()
          return base
        })
        db[this.table] = [...rows, ...changed]
      } else if (this.op === "update") {
        if (!this.where) throw new Error("update precisa de eq()")
        db[this.table] = rows.map((r) => {
          if (r[this.where!.field] !== this.where!.value) return r
          const next = { ...r, ...(Array.isArray(this.payload) ? this.payload[0] : this.payload) }
          if (this.table === "patients" || this.table === "procedures" || this.table === "profiles" || this.table === "clinics") next.updated_at = nowIso()
          changed.push(next)
          return next
        })
      } else {
        if (!this.where) throw new Error("delete precisa de eq()")
        changed = rows.filter((r) => r[this.where!.field] === this.where!.value)
        db[this.table] = rows.filter((r) => r[this.where!.field] !== this.where!.value)
      }

      setDemoDb(db)
      const data = this.wantSingle ? this.applyJoin(changed[0] ?? null) : changed.map((c) => this.applyJoin(c))
      const payload = { data, error: null as null }
      return Promise.resolve(onfulfilled ? onfulfilled(payload) : (payload as unknown as TResult1))
    } catch (e) {
      if (onrejected) return Promise.resolve(onrejected(e))
      throw e
    }
  }
}

type AuthListener = (event: string, session: { user: { id: string; email: string } } | null) => void

function createDemoClient() {
  const listeners: AuthListener[] = []

  const users = [
    { id: "22222222-2222-2222-2222-222222222222", email: "admin@dentalflow.local", password: "12345678" },
    { id: "33333333-3333-3333-3333-333333333333", email: "dentista1@dentalflow.local", password: "12345678" },
    { id: "44444444-4444-4444-4444-444444444444", email: "dentista2@dentalflow.local", password: "12345678" },
  ]

  function notify(event: string, session: DemoSession) {
    for (const cb of listeners) cb(event, session)
  }

  return {
    from(table: string) {
      return new DemoQuery(table as keyof DemoDb)
    },
    rpc(fn: string, args: Record<string, unknown>) {
      if (fn === "bootstrap_clinic") {
        const session = getDemoSession()
        if (!session?.user?.id) return Promise.resolve({ data: null, error: null })
        const db = getDemoDb()
        const clinicId = crypto.randomUUID()
        const workingHours = {
          "1": [
            { start: "08:00", end: "12:00" },
            { start: "13:00", end: "18:00" },
          ],
          "2": [
            { start: "08:00", end: "12:00" },
            { start: "13:00", end: "18:00" },
          ],
          "3": [
            { start: "08:00", end: "12:00" },
            { start: "13:00", end: "18:00" },
          ],
          "4": [
            { start: "08:00", end: "12:00" },
            { start: "13:00", end: "18:00" },
          ],
          "5": [
            { start: "08:00", end: "12:00" },
            { start: "13:00", end: "18:00" },
          ],
          "6": [{ start: "08:00", end: "12:00" }],
          "0": [],
        }
        const clinic = {
          id: clinicId,
          name: String(args.p_clinic_name ?? "Clínica"),
          owner_id: session.user.id,
          plan_tier: "management",
          booking_enabled: true,
          booking_slug: String(clinicId).slice(0, 8),
          booking_window_days: 14,
          booking_lead_time_hours: 2,
          booking_mode: "auto",
          working_hours: workingHours,
          cnpj: null,
          address: null,
          logo_url: null,
          whatsapp_confirmation_template: "Olá, {nome}! Confirmamos sua consulta em {data} às {hora}.",
          whatsapp_auto_booking_template: "Olá, {nome}! Sua consulta foi agendada com sucesso para {data} às {hora}. Se precisar reagendar, responda esta mensagem.",
          whatsapp_enabled: false,
          whatsapp_auto_confirm: false,
          whatsapp_auto_cancel: false,
          whatsapp_cancel_template: "",
          whatsapp_return_template: "",
          return_enabled: true,
          return_default_days: 180,
          return_reminder_enabled: false,
          return_reminder_days_before: 7,
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        db.clinics = [...db.clinics, clinic]
        const profile = {
          id: session.user.id,
          clinic_id: clinicId,
          full_name: String(args.p_full_name ?? session.user.email),
          role: "admin",
          cro: null,
          specialty: null,
          phone: null,
          color: "#1E3A5F",
          active: true,
          avatar_url: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        db.profiles = db.profiles.filter((p) => p.id !== profile.id).concat(profile)
        setDemoDb(db)
        return Promise.resolve({ data: clinicId, error: null })
      }

      if (fn === "create_rsvp_token") {
        const session = getDemoSession()
        if (!session?.user?.id) return Promise.resolve({ data: null, error: { message: "Não autenticado." } })
        const db = getDemoDb()
        const apptId = String(args.p_appointment_id ?? "")
        const hours = Number.isFinite(Number(args.p_hours)) ? Number(args.p_hours) : 48
        const appt = db.appointments.find((a) => a.id === apptId)
        if (!appt) return Promise.resolve({ data: null, error: { message: "Agendamento não encontrado." } })
        const token = crypto.randomUUID().replaceAll("-", "")
        const expiresAt = new Date(Date.now() + Math.max(1, Math.trunc(hours)) * 60 * 60 * 1000).toISOString()
        db.appointment_rsvp_tokens = db.appointment_rsvp_tokens.concat({
          id: crypto.randomUUID(),
          clinic_id: String((appt as Record<string, unknown>).clinic_id ?? ""),
          appointment_id: apptId,
          token,
          expires_at: expiresAt,
          used_at: null,
          created_at: nowIso(),
        })
        setDemoDb(db)
        return Promise.resolve({ data: token, error: null })
      }

      if (fn === "find_or_create_patient_for_booking") {
        const session = getDemoSession()
        if (!session?.user?.id) return Promise.resolve({ data: null, error: { message: "Não autenticado." } })
        const db = getDemoDb()
        const clinicId = String(db.clinics[0]?.id ?? "")
        const name = String(args.p_patient_name ?? "").trim()
        const whatsapp = String(args.p_patient_whatsapp ?? "").trim()
        const email = args.p_patient_email ? String(args.p_patient_email).trim() : ""
        const digits = whatsapp.replace(/\D/g, "")
        if (name.length < 2) return Promise.resolve({ data: null, error: { message: "Nome inválido." } })
        if (digits.length < 10) return Promise.resolve({ data: null, error: { message: "WhatsApp inválido." } })

        const existing =
          (db.patients.find((p) => String(p.clinic_id) === clinicId && String(p.whatsapp ?? "").replace(/\D/g, "") === digits) as Record<string, unknown> | undefined) ??
          (db.patients.find((p) => String(p.clinic_id) === clinicId && String(p.phone ?? "").replace(/\D/g, "") === digits) as Record<string, unknown> | undefined) ??
          null

        if (existing) {
          db.patients = db.patients.map((p) => {
            if (String(p.id) !== String(existing.id)) return p
            const next = { ...p }
            if (!String(next.name ?? "").trim()) next.name = name
            if (!String(next.whatsapp ?? "").trim()) next.whatsapp = whatsapp
            if (!String(next.email ?? "").trim() && email) next.email = email
            next.updated_at = nowIso()
            return next
          })
          setDemoDb(db)
          return Promise.resolve({ data: String(existing.id), error: null })
        }

        const id = crypto.randomUUID()
        db.patients = db.patients.concat({
          id,
          clinic_id: clinicId,
          name,
          cpf: null,
          birth_date: null,
          phone: null,
          whatsapp,
          email: email || null,
          address: null,
          gender: null,
          blood_type: null,
          observations: null,
          active: true,
          created_at: nowIso(),
          updated_at: nowIso(),
        })
        setDemoDb(db)
        return Promise.resolve({ data: id, error: null })
      }

      if (fn === "rsvp_appointment") {
        const db = getDemoDb()
        const token = String(args.p_token ?? "")
        const action = String(args.p_action ?? "").toLowerCase()
        const row = db.appointment_rsvp_tokens.find((t) => t.token === token) as Record<string, unknown> | undefined
        if (!row) return Promise.resolve({ data: "invalid_token", error: null })
        const expiresAt = String(row.expires_at ?? "")
        if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return Promise.resolve({ data: "expired_token", error: null })
        if (row.used_at) return Promise.resolve({ data: "already_used", error: null })

        const status = action === "confirm" || action === "confirmar" ? "confirmed" : action === "cancel" || action === "cancelar" ? "cancelled" : null
        if (!status) return Promise.resolve({ data: "invalid_action", error: null })

        const apptId = String(row.appointment_id ?? "")
        db.appointments = db.appointments.map((a) => (a.id === apptId ? { ...a, status } : a))
        db.appointment_rsvp_tokens = db.appointment_rsvp_tokens.map((t) => (t.token === token ? { ...t, used_at: nowIso() } : t))
        setDemoDb(db)
        return Promise.resolve({ data: status, error: null })
      }

      if (fn === "transfer_clinic_ownership") {
        const session = getDemoSession()
        if (!session?.user?.id) return Promise.resolve({ data: null, error: { message: "Não autenticado." } })
        const db = getDemoDb()
        const clinicId = String(db.clinics[0]?.id ?? "")
        const clinic = db.clinics.find((c) => String(c.id) === clinicId) as Record<string, unknown> | undefined
        if (!clinic) return Promise.resolve({ data: null, error: { message: "Clínica não encontrada." } })
        const ownerId = String(clinic.owner_id ?? "")
        if (ownerId !== session.user.id) return Promise.resolve({ data: null, error: { message: "Sem permissão." } })
        const nextOwnerId = String(args.p_new_owner_id ?? "")
        const target = db.profiles.find((p) => String(p.id) === nextOwnerId && String(p.clinic_id) === clinicId && String(p.role) === "admin")
        if (!target) return Promise.resolve({ data: null, error: { message: "Novo titular inválido." } })
        db.clinics = db.clinics.map((c) => (String(c.id) === clinicId ? { ...c, owner_id: nextOwnerId, updated_at: nowIso() } : c))
        setDemoDb(db)
        return Promise.resolve({ data: null, error: null })
      }

      if (fn === "get_booking_config") {
        const db = getDemoDb()
        const slug = String(args.p_slug ?? "").trim()
        const clinic = db.clinics.find((c) => String(c.booking_slug ?? "") === slug && Boolean(c.booking_enabled)) as Record<string, unknown> | undefined
        if (!clinic) return Promise.resolve({ data: null, error: { message: "Agendamento online indisponível." } })
        const clinicId = String(clinic.id ?? "")
        const dentists = db.profiles
          .filter((p) => String(p.clinic_id) === clinicId && Boolean(p.active) && ["admin", "dentist"].includes(String(p.role)))
          .sort((a, b) => String(a.full_name ?? "").localeCompare(String(b.full_name ?? "")))
          .map((p) => ({ id: String(p.id), full_name: String(p.full_name ?? "") }))
        const procedures = db.procedures
          .filter((p) => String(p.clinic_id) === clinicId && Boolean(p.active))
          .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")))
          .map((p) => ({ id: String(p.id), name: String(p.name ?? ""), duration_minutes: Number(p.duration_minutes ?? 30) }))
        return Promise.resolve({
          data: [
            {
              clinic_id: clinicId,
              clinic_name: String(clinic.name ?? ""),
              booking_mode: String(clinic.booking_mode ?? "request"),
              booking_window_days: Number(clinic.booking_window_days ?? 14),
              booking_lead_time_hours: Number(clinic.booking_lead_time_hours ?? 2),
              dentists,
              procedures,
            },
          ],
          error: null,
        })
      }

      if (fn === "get_booking_availability") {
        const db = getDemoDb()
        const slug = String(args.p_slug ?? "").trim()
        const clinic = db.clinics.find((c) => String(c.booking_slug ?? "") === slug && Boolean(c.booking_enabled)) as Record<string, unknown> | undefined
        if (!clinic) return Promise.resolve({ data: null, error: { message: "Agendamento online indisponível." } })
        const clinicId = String(clinic.id ?? "")
        const dentistId = args.p_dentist_id ? String(args.p_dentist_id) : null
        const procedureId = args.p_procedure_id ? String(args.p_procedure_id) : null
        const days = Number.isFinite(Number(args.p_days)) ? Math.max(1, Math.min(14, Math.trunc(Number(args.p_days)))) : 7
        const leadHours = Number(clinic.booking_lead_time_hours ?? 2)
        const windowDays = Number(clinic.booking_window_days ?? 14)
        const procedure = procedureId ? db.procedures.find((p) => String(p.id) === procedureId && String(p.clinic_id) === clinicId && Boolean(p.active)) : null
        const dur = Math.max(15, Math.trunc(Number((procedure as Record<string, unknown> | null)?.duration_minutes ?? 30)))

        const clinicWorkingHours = (clinic.working_hours as Record<string, Array<{ start: string; end: string }>> | undefined) ?? {}
        const dentists = db.profiles
          .filter((p) => String(p.clinic_id) === clinicId && Boolean(p.active) && ["admin", "dentist"].includes(String(p.role)))
          .map((p) => {
            const id = String(p.id)
            const hours = ((p.working_hours as Record<string, Array<{ start: string; end: string }>> | undefined) ?? clinicWorkingHours) || clinicWorkingHours
            return { id, hours }
          })
          .filter((p) => (dentistId ? p.id === dentistId : true))

        const slots: Array<{ start_time: string }> = []
        const now = Date.now()
        const minStart = now + leadHours * 60 * 60 * 1000
        const maxStart = now + windowDays * 24 * 60 * 60 * 1000

        function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
          return bStart < aEnd && bEnd > aStart
        }

        const globalBlocks = db.schedule_blocks.filter((b) => String(b.clinic_id) === clinicId && !b.dentist_id) as Array<Record<string, unknown>>

        function dentistFree(dId: string, startMs: number, endMs: number) {
          const dBlocks = db.schedule_blocks.filter((b) => String(b.clinic_id) === clinicId && String(b.dentist_id ?? "") === dId) as Array<Record<string, unknown>>
          const appts = db.appointments.filter((a) => String(a.clinic_id) === clinicId && String(a.dentist_id) === dId && String(a.status) !== "cancelled") as Array<Record<string, unknown>>
          for (const b of globalBlocks) {
            const bs = new Date(String(b.start_time)).getTime()
            const be = new Date(String(b.end_time)).getTime()
            if (overlaps(startMs, endMs, bs, be)) return false
          }
          for (const b of dBlocks) {
            const bs = new Date(String(b.start_time)).getTime()
            const be = new Date(String(b.end_time)).getTime()
            if (overlaps(startMs, endMs, bs, be)) return false
          }
          for (const a of appts) {
            const as = new Date(String(a.start_time)).getTime()
            const ae = new Date(String(a.end_time)).getTime()
            if (overlaps(startMs, endMs, as, ae)) return false
          }
          return true
        }

        function parseTime(s: string) {
          const m = String(s).match(/^([01]\d|2[0-3]):([0-5]\d)$/)
          if (!m) return null
          return { h: Number(m[1]), m: Number(m[2]) }
        }

        const tz = "America/Sao_Paulo"
        const base = new Date()
        const baseLocalMidnight = new Date(base.toLocaleString("en-US", { timeZone: tz }))
        baseLocalMidnight.setHours(0, 0, 0, 0)
        const seen = new Set<string>()
        for (let d = 0; d < days; d++) {
          const day = new Date(baseLocalMidnight.getTime() + d * 24 * 60 * 60 * 1000)
          const dow = day.getDay()
          for (const den of dentists) {
            const periods = den.hours[String(dow)] ?? []
            for (const p of periods) {
              const s = parseTime(p.start)
              const e = parseTime(p.end)
              if (!s || !e) continue
              let startMs = new Date(day.getTime()).setHours(s.h, s.m, 0, 0)
              const endLimit = new Date(day.getTime()).setHours(e.h, e.m, 0, 0)
              for (; startMs <= endLimit - dur * 60 * 1000; startMs += 30 * 60 * 1000) {
                if (startMs < minStart) continue
                if (startMs >= maxStart) continue
                const endMs = startMs + dur * 60 * 1000
                if (!dentistFree(den.id, startMs, endMs)) continue
                const iso = new Date(startMs).toISOString()
                if (seen.has(iso)) continue
                seen.add(iso)
                slots.push({ start_time: iso })
              }
            }
          }
        }
        return Promise.resolve({ data: slots, error: null })
      }

      if (fn === "create_booking_request") {
        const db = getDemoDb()
        const slug = String(args.p_slug ?? "").trim()
        const clinic = db.clinics.find((c) => String(c.booking_slug ?? "") === slug && Boolean(c.booking_enabled)) as Record<string, unknown> | undefined
        if (!clinic) return Promise.resolve({ data: null, error: { message: "Agendamento online indisponível." } })
        const clinicId = String(clinic.id ?? "")
        const patientName = String(args.p_patient_name ?? "").trim()
        const patientWhatsapp = String(args.p_patient_whatsapp ?? "").trim()
        const preferred = (args.p_preferred_times as unknown as string[] | undefined) ?? []
        if (patientName.length < 2) return Promise.resolve({ data: null, error: { message: "Nome inválido." } })
        if (preferred.length < 1 || preferred.length > 3) return Promise.resolve({ data: null, error: { message: "Selecione de 1 a 3 horários." } })

        const id = crypto.randomUUID()
        db.booking_requests = db.booking_requests.concat({
          id,
          clinic_id: clinicId,
          patient_name: patientName,
          patient_whatsapp: patientWhatsapp,
          patient_email: args.p_patient_email ? String(args.p_patient_email) : null,
          dentist_id: args.p_dentist_id ? String(args.p_dentist_id) : null,
          procedure_id: args.p_procedure_id ? String(args.p_procedure_id) : null,
          preferred_times: preferred,
          notes: args.p_notes ? String(args.p_notes) : null,
          status: "new",
          created_at: nowIso(),
        })
        setDemoDb(db)
        return Promise.resolve({ data: id, error: null })
      }

      if (fn === "create_booking_appointment") {
        const db = getDemoDb()
        const slug = String(args.p_slug ?? "").trim()
        const clinic = db.clinics.find((c) => String(c.booking_slug ?? "") === slug && Boolean(c.booking_enabled)) as Record<string, unknown> | undefined
        if (!clinic) return Promise.resolve({ data: null, error: { message: "Agendamento online indisponível." } })
        if (String(clinic.booking_mode ?? "request") !== "auto") return Promise.resolve({ data: null, error: { message: "Agendamento online indisponível." } })

        const clinicId = String(clinic.id ?? "")
        const patientName = String(args.p_patient_name ?? "").trim()
        const patientWhatsapp = String(args.p_patient_whatsapp ?? "").trim()
        const startTime = String(args.p_start_time ?? "").trim()
        const dentistIdArg = args.p_dentist_id ? String(args.p_dentist_id) : null
        const procedureIdArg = args.p_procedure_id ? String(args.p_procedure_id) : null
        const notes = args.p_notes ? String(args.p_notes) : ""

        if (patientName.length < 2) return Promise.resolve({ data: null, error: { message: "Nome inválido." } })
        if (patientWhatsapp.replace(/\D/g, "").length < 10) return Promise.resolve({ data: null, error: { message: "WhatsApp inválido." } })
        const startMs = new Date(startTime).getTime()
        if (!Number.isFinite(startMs)) return Promise.resolve({ data: null, error: { message: "Horário inválido." } })

        const procedure = procedureIdArg
          ? (db.procedures.find((p) => String(p.id) === procedureIdArg && String(p.clinic_id) === clinicId && Boolean(p.active)) as Record<string, unknown> | undefined)
          : undefined
        const dur = Math.max(15, Math.trunc(Number(procedure?.duration_minutes ?? 30)))
        const endMs = startMs + dur * 60 * 1000

        const dentists = db.profiles
          .filter((p) => String(p.clinic_id) === clinicId && Boolean(p.active) && ["admin", "dentist"].includes(String(p.role)))
          .sort((a, b) => String(a.full_name ?? "").localeCompare(String(b.full_name ?? "")))
          .map((p) => {
            const id = String(p.id)
            const clinicHours = (clinic.working_hours as Record<string, Array<{ start: string; end: string }>> | undefined) ?? {}
            const hours = ((p.working_hours as Record<string, Array<{ start: string; end: string }>> | undefined) ?? clinicHours) || clinicHours
            return { id, hours }
          })

        function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
          return bStart < aEnd && bEnd > aStart
        }

        const globalBlocks = db.schedule_blocks.filter((b) => String(b.clinic_id) === clinicId && !b.dentist_id) as Array<Record<string, unknown>>

        function parseTime(s: string) {
          const m = String(s).match(/^([01]\d|2[0-3]):([0-5]\d)$/)
          if (!m) return null
          return { h: Number(m[1]), m: Number(m[2]) }
        }

        function inWorkingHours(hours: Record<string, Array<{ start: string; end: string }>>, startMs: number, endMs: number) {
          const tz = "America/Sao_Paulo"
          const start = new Date(startMs)
          const end = new Date(endMs)
          const startLocal = new Date(start.toLocaleString("en-US", { timeZone: tz }))
          const endLocal = new Date(end.toLocaleString("en-US", { timeZone: tz }))
          if (startLocal.toDateString() !== endLocal.toDateString()) return false
          const dow = startLocal.getDay()
          const periods = hours[String(dow)] ?? []
          const sH = startLocal.getHours()
          const sM = startLocal.getMinutes()
          const eH = endLocal.getHours()
          const eM = endLocal.getMinutes()
          const sMin = sH * 60 + sM
          const eMin = eH * 60 + eM
          for (const p of periods) {
            const ps = parseTime(p.start)
            const pe = parseTime(p.end)
            if (!ps || !pe) continue
            const psMin = ps.h * 60 + ps.m
            const peMin = pe.h * 60 + pe.m
            if (sMin >= psMin && eMin <= peMin) return true
          }
          return false
        }

        function dentistFree(dId: string) {
          for (const b of globalBlocks) {
            const bs = new Date(String(b.start_time)).getTime()
            const be = new Date(String(b.end_time)).getTime()
            if (overlaps(startMs, endMs, bs, be)) return false
          }
          for (const b of db.schedule_blocks as Array<Record<string, unknown>>) {
            if (String(b.clinic_id) !== clinicId) continue
            if (String(b.dentist_id ?? "") !== dId) continue
            const bs = new Date(String(b.start_time)).getTime()
            const be = new Date(String(b.end_time)).getTime()
            if (overlaps(startMs, endMs, bs, be)) return false
          }
          for (const a of db.appointments as Array<Record<string, unknown>>) {
            if (String(a.clinic_id) !== clinicId) continue
            if (String(a.dentist_id) !== dId) continue
            if (String(a.status) === "cancelled") continue
            const as = new Date(String(a.start_time)).getTime()
            const ae = new Date(String(a.end_time)).getTime()
            if (overlaps(startMs, endMs, as, ae)) return false
          }
          return true
        }

        const chosen = dentistIdArg ? dentists.find((d) => d.id === dentistIdArg) ?? null : dentists.find((d) => inWorkingHours(d.hours, startMs, endMs) && dentistFree(d.id)) ?? null
        if (!chosen) return Promise.resolve({ data: null, error: { message: "Horário indisponível." } })
        if (!inWorkingHours(chosen.hours, startMs, endMs)) return Promise.resolve({ data: null, error: { message: "Horário indisponível." } })
        if (!dentistFree(chosen.id)) return Promise.resolve({ data: null, error: { message: "Horário indisponível." } })

        function normalizePersonName(value: unknown) {
          const base = String(value ?? "").trim().toLowerCase()
          return base
            .replace(/[^0-9a-z\u00C0-\u024F ]/g, "")
            .replace(/\s+/g, " ")
            .trim()
        }

        const norm = patientWhatsapp.replace(/\D/g, "")
        const nameKey = normalizePersonName(patientName)
        let patient =
          (db.patients.find((p) => {
            if (String(p.clinic_id) !== clinicId) return false
            const digits = String(p.whatsapp ?? "").replace(/\D/g, "")
            if (digits !== norm) return false
            const pName = normalizePersonName(p.name)
            if (!pName) return true
            return pName === nameKey
          }) as Record<string, unknown> | undefined) ?? null
        if (!patient) {
          patient = {
            id: crypto.randomUUID(),
            clinic_id: clinicId,
            name: patientName,
            cpf: null,
            birth_date: null,
            phone: null,
            whatsapp: patientWhatsapp,
            email: args.p_patient_email ? String(args.p_patient_email) : null,
            address: null,
            gender: null,
            blood_type: null,
            observations: null,
            active: true,
            created_at: nowIso(),
            updated_at: nowIso(),
          }
          db.patients = db.patients.concat(patient)
        }

        const apptId = crypto.randomUUID()
        db.appointments = db.appointments.concat({
          id: apptId,
          clinic_id: clinicId,
          patient_id: String(patient.id),
          dentist_id: chosen.id,
          procedure_id: procedureIdArg || null,
          start_time: new Date(startMs).toISOString(),
          end_time: new Date(endMs).toISOString(),
          status: "scheduled",
          notes: notes ? `Agendado online • ${notes}` : "Agendado online",
          room: null,
          created_via: "online",
          created_at: nowIso(),
        })

        db.booking_requests = db.booking_requests.concat({
          id: crypto.randomUUID(),
          clinic_id: clinicId,
          patient_name: patientName,
          patient_whatsapp: patientWhatsapp,
          patient_email: args.p_patient_email ? String(args.p_patient_email) : null,
          dentist_id: chosen.id,
          procedure_id: procedureIdArg || null,
          preferred_times: [new Date(startMs).toISOString()],
          notes: notes || null,
          status: "scheduled",
          created_at: nowIso(),
        })

        const template = String(
          clinic.whatsapp_auto_booking_template ??
            clinic.whatsapp_confirmation_template ??
            "Olá, {nome}! Sua consulta foi agendada com sucesso para {data} às {hora}. Se precisar reagendar, responda esta mensagem."
        )
        const startDate = new Date(startMs)
        const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })
        const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false })
        let msg = template
        msg = msg.replaceAll("{nome}", patientName)
        msg = msg.replaceAll("{data}", dateFmt.format(startDate))
        msg = msg.replaceAll("{hora}", timeFmt.format(startDate))

        db.whatsapp_messages = db.whatsapp_messages.concat({
          id: crypto.randomUUID(),
          clinic_id: clinicId,
          appointment_id: apptId,
          patient_id: String(patient.id),
          kind: "confirm",
          to_phone: patientWhatsapp,
          message: msg,
          status: "queued",
          provider_response: null,
          error: null,
          created_at: nowIso(),
        })

        setDemoDb(db)
        return Promise.resolve({ data: apptId, error: null })
      }

      return Promise.resolve({ data: null, error: null })
    },
    auth: {
      async getSession() {
        const session = getDemoSession()
        return { data: { session }, error: null }
      },
      onAuthStateChange(cb: AuthListener) {
        listeners.push(cb)
        return {
          data: {
            subscription: {
              unsubscribe() {
                const idx = listeners.indexOf(cb)
                if (idx >= 0) listeners.splice(idx, 1)
              },
            },
          },
        }
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const u = users.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password)
        if (!u) return { data: null, error: { message: "Credenciais inválidas." } }
        const session: DemoSession = { user: { id: u.id, email: u.email } }
        setDemoSession(session)
        notify("SIGNED_IN", session)
        return { data: { session }, error: null }
      },
      async signUp({ email, password }: { email: string; password: string }) {
        const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase())
        if (exists) return { data: null, error: { message: "E-mail já cadastrado." } }
        const id = crypto.randomUUID()
        users.push({ id, email, password })
        const session: DemoSession = { user: { id, email } }
        setDemoSession(session)
        notify("SIGNED_IN", session)
        return { data: { session }, error: null }
      },
      async signOut() {
        setDemoSession(null)
        notify("SIGNED_OUT", null)
        return { error: null }
      },
      async resetPasswordForEmail(_email: string) {
        void _email
        return { data: null, error: null }
      },
    },
    storage: {
      from(_bucket: string) {
        void _bucket
        return {
          async upload(_path: string, _file: File, _opts?: { upsert?: boolean }) {
            void _file
            void _opts
            return { data: { path: _path }, error: null }
          },
          createSignedUrl(path: string, _expiresIn: number) {
            void _expiresIn
            return Promise.resolve({ data: { signedUrl: `demo://medical-attachments/${path}` }, error: null })
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: `demo://medical-attachments/${path}` } }
          },
        }
      },
    },
    _demo: true,
    insert(table: string, payload: Record<string, unknown> | Record<string, unknown>[]) {
      return new DemoMutation(table as keyof DemoDb, "insert", payload)
    },
  }
}

type RealSupabase = SupabaseClient<Database>

function createDemoFromFacade() {
  const demo = createDemoClient()
  return {
    ...demo,
    from(table: string) {
      const q = new DemoQuery(table as keyof DemoDb)
      return {
        select: (spec: string, opts?: { head?: boolean; count?: "exact" }) => q.select(spec, opts),
        eq: (field: string, value: unknown) => q.eq(field, value),
        in: (field: string, values: unknown[]) => q.in(field, values),
        ilike: (field: string, pattern: string) => q.ilike(field, pattern),
        or: (expr: string) => q.or(expr),
        gte: (field: string, value: string) => q.gte(field, value),
        lte: (field: string, value: string) => q.lte(field, value),
        lt: (field: string, value: string) => q.lt(field, value),
        order: (field: string, spec?: OrderSpec) => q.order(field, spec),
        limit: (n: number) => q.limit(n),
        insert: (payload: Record<string, unknown> | Record<string, unknown>[]) => new DemoMutation(table as keyof DemoDb, "insert", payload),
        update: (payload: Record<string, unknown>) => new DemoMutation(table as keyof DemoDb, "update", payload),
        delete: () => new DemoMutation(table as keyof DemoDb, "delete"),
      }
    },
  } as unknown as RealSupabase
}

export const isSupabaseConfigured = isRealSupabase

export const supabase: RealSupabase = isRealSupabase ? createClient<Database>(envUrl, envAnonKey) : createDemoFromFacade()
