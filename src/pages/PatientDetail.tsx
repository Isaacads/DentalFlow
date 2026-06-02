import * as React from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, CalendarDays, FileImage, FileText, HeartPulse, MessageSquare, NotebookPen, Plus, ShieldCheck, Smile } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useReactToPrint } from "react-to-print"
import { supabase } from "@/lib/supabase"
import { canAccess, planAllows, useAuth } from "@/providers/AuthProvider"
import type { Appointment, Anamnesis, FinancialTransaction, Json, MedicalRecord, Patient, Procedure } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDate, formatDateTimeWithYear, formatMoneyBRL } from "@/lib/format"

type ApptRow = Appointment & { procedure?: Pick<Procedure, "name"> | null }

const patientTabValues = ["resumo", "prontuarios", "financeiro", "anamnese", "documentos", "agendamentos"] as const
type PatientTab = (typeof patientTabValues)[number]

const statusLabel: Record<Appointment["status"], string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  cancelled: "Cancelada",
  no_show: "Faltou",
}

function whatsappLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "")
  const br = digits.startsWith("55") ? digits : `55${digits}`
  return `https://wa.me/${br}?text=${encodeURIComponent(message)}`
}

function parseList(value: string) {
  return value
    .split(/[,;\n]/g)
    .map((s) => s.trim())
    .filter(Boolean)
}

const problemDurationOptions = [
  { label: "Menos de 1 semana", value: "lt_1w" },
  { label: "1 a 4 semanas", value: "1_4w" },
  { label: "1 a 6 meses", value: "1_6m" },
  { label: "Mais de 6 meses", value: "gt_6m" },
] as const

const healthConditionOptions = [
  { label: "Hipertensão arterial", value: "hipertensao" },
  { label: "Diabetes", value: "diabetes" },
  { label: "Asma ou problemas respiratórios", value: "asma" },
  { label: "Alergias (especificar abaixo)", value: "alergias" },
  { label: "Problemas de coagulação do sangue", value: "coagulacao" },
  { label: "Imunocomprometido ou em tratamento especial", value: "imunocomprometido" },
] as const

const brushFrequencyOptions = [
  { label: "Uma vez ao dia", value: "1x" },
  { label: "Duas vezes ao dia", value: "2x" },
  { label: "Três ou mais vezes ao dia", value: "3x+" },
  { label: "Raramente", value: "rare" },
] as const

const flossUsageOptions = [
  { label: "Diariamente", value: "daily" },
  { label: "Raramente", value: "rare" },
  { label: "Nunca", value: "never" },
] as const

const sensitivityOptions = [
  { label: "Não", value: "none", score: 0 },
  { label: "Leve", value: "mild", score: 1 },
  { label: "Moderada", value: "moderate", score: 2 },
  { label: "Intensa", value: "severe", score: 3 },
] as const

const habitOptions = [
  { label: "Fuma", value: "smoke", risk: "high" as const },
  { label: "Consome álcool regularmente", value: "alcohol", risk: "medium" as const },
  { label: "Range os dentes/bruxismo", value: "bruxism", risk: "medium" as const },
  { label: "Aperta os dentes durante o dia", value: "clench", risk: "low" as const },
] as const

const previousTreatmentOptions = [
  { label: "Restaurações (empastes)", value: "restauracao" },
  { label: "Tratamento de canal", value: "endodontia" },
  { label: "Extração de dente", value: "extracao" },
  { label: "Implante dentário", value: "implante" },
  { label: "Prótese dentária", value: "protese" },
  { label: "Ortodontia (aparelho)", value: "ortodontia" },
] as const

function lastCleaningValid(raw: string) {
  const s = raw.trim()
  if (!s) return false
  const normalized = s.replace(/^Ha\b/i, "Há")
  if (/^Nunca fiz$/i.test(normalized)) return true
  return /^Há\s+\d+\s+(dias?|semanas?|meses?|anos?)$/i.test(normalized)
}

type ProblemDurationValue = (typeof problemDurationOptions)[number]["value"]
type HealthConditionValue = (typeof healthConditionOptions)[number]["value"]
type BrushFrequencyValue = (typeof brushFrequencyOptions)[number]["value"]
type FlossUsageValue = (typeof flossUsageOptions)[number]["value"]
type SensitivityValue = (typeof sensitivityOptions)[number]["value"]
type HabitValue = (typeof habitOptions)[number]["value"]
type PreviousTreatmentValue = (typeof previousTreatmentOptions)[number]["value"]
type TriChoice = "unknown" | "yes" | "no"

const problemDurationAllowed = problemDurationOptions.map((o) => o.value) as ReadonlyArray<ProblemDurationValue>
const healthConditionAllowed = healthConditionOptions.map((o) => o.value) as ReadonlyArray<HealthConditionValue>
const brushFrequencyAllowed = brushFrequencyOptions.map((o) => o.value) as ReadonlyArray<BrushFrequencyValue>
const flossUsageAllowed = flossUsageOptions.map((o) => o.value) as ReadonlyArray<FlossUsageValue>
const sensitivityAllowed = sensitivityOptions.map((o) => o.value) as ReadonlyArray<SensitivityValue>
const habitAllowed = habitOptions.map((o) => o.value) as ReadonlyArray<HabitValue>
const previousTreatmentAllowed = previousTreatmentOptions.map((o) => o.value) as ReadonlyArray<PreviousTreatmentValue>

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  if (Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function errorMessage(err: unknown) {
  if (err && typeof err === "object" && "message" in err) return String((err as { message?: unknown }).message ?? "")
  return "Não foi possível salvar a anamnese."
}

function pickAllowed<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value !== "string") return fallback
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function pickAllowedArray<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is T => typeof x === "string" && (allowed as readonly string[]).includes(x))
}

function labelFromOptions<T extends { value: string; label: string }>(value: unknown, options: readonly T[]) {
  if (typeof value !== "string") return "—"
  return options.find((o) => o.value === value)?.label ?? value
}

function yesNoUnknown(value: unknown) {
  if (value === true) return "Sim"
  if (value === false) return "Não"
  return "—"
}

function joinArray(value: unknown) {
  if (!Array.isArray(value)) return "—"
  const items = value.map((v) => String(v ?? "").trim()).filter(Boolean)
  return items.length ? items.join(", ") : "—"
}

const anamnesisSchema = z
  .object({
    chief_complaint: z.string().trim().min(10, "Informe ao menos 10 caracteres.").max(500, "Máximo de 500 caracteres."),
    problem_duration: z
      .enum(problemDurationOptions.map((x) => x.value) as [string, ...string[]])
      .optional()
      .nullable(),
    health_conditions: z
      .array(z.enum(healthConditionOptions.map((x) => x.value) as [string, ...string[]]))
      .min(1, "Selecione ao menos uma opção."),
    allergies_detail: z.string().optional().nullable(),
    medications_continuous: z.string().max(800, "Máximo de 800 caracteres.").optional().nullable(),
    brush_frequency: z.enum(brushFrequencyOptions.map((x) => x.value) as [string, ...string[]]),
    floss_usage: z.enum(flossUsageOptions.map((x) => x.value) as [string, ...string[]]),
    sensitivity: z.enum(sensitivityOptions.map((x) => x.value) as [string, ...string[]]),
    habits: z.array(z.enum(habitOptions.map((x) => x.value) as [string, ...string[]])).default([]),
    last_cleaning: z
      .string()
      .trim()
      .min(2, "Informe a última limpeza.")
      .refine((v) => lastCleaningValid(v), "Use um formato como: 'Há 6 meses', 'Há 1 ano' ou 'Nunca fiz'."),
    previous_treatments: z.array(z.enum(previousTreatmentOptions.map((x) => x.value) as [string, ...string[]])).default([]),
    dentist_fear: z.enum(["0", "1", "2"]).optional().nullable(),
    fear_concern: z.string().max(300, "Máximo de 300 caracteres.").optional().nullable(),
    observations: z.string().max(1000, "Máximo de 1000 caracteres.").optional().nullable(),
    consent: z.boolean().refine((v) => v === true, { message: "É necessário autorizar o uso dos dados." }),
    pregnant: z.enum(["unknown", "yes", "no"]).optional().default("unknown"),
  })
  .superRefine((v, ctx) => {
    if (v.health_conditions.includes("alergias")) {
      const d = String(v.allergies_detail ?? "").trim()
      if (d.length < 5) ctx.addIssue({ code: "custom", path: ["allergies_detail"], message: "Especifique suas alergias (mínimo 5 caracteres)." })
    }
    if (v.dentist_fear === "1" || v.dentist_fear === "2") {
      const c = String(v.fear_concern ?? "").trim()
      if (!c) ctx.addIssue({ code: "custom", path: ["fear_concern"], message: "Descreva sua principal preocupação." })
    }
  })

type AnamnesisFormValues = z.input<typeof anamnesisSchema>

function toggleInArray<T extends string>(arr: T[], value: T) {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]
}

function fileNameFromPath(path: string) {
  const p = String(path ?? "").trim()
  if (!p) return "Arquivo"
  try {
    const url = new URL(p)
    const base = url.pathname.split("/").filter(Boolean).slice(-1)[0] ?? ""
    return decodeURIComponent(base) || "Arquivo"
  } catch {
    return p.split("/").filter(Boolean).slice(-1)[0] ?? "Arquivo"
  }
}

function fileKind(path: string) {
  const name = fileNameFromPath(path).toLowerCase()
  if (name.endsWith(".pdf")) return "pdf"
  if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image"
  return "file"
}

export function PatientDetail() {
  const { id } = useParams()
  const patientId = id ?? ""
  const { profile, planTier } = useAuth()
  const canSeeFinance = canAccess(profile?.role, "financeiro") && planAllows(planTier, "financeiro")
  const canSeeRecords = canAccess(profile?.role, "prontuario") && planAllows(planTier, "prontuario")
  const canEditAnamnesis = ["admin", "receptionist", "dentist", "assistant"].includes(String(profile?.role ?? ""))
  const [tab, setTab] = React.useState<PatientTab>("resumo")
  const [loadingPatient, setLoadingPatient] = React.useState(true)
  const [loadingSummary, setLoadingSummary] = React.useState(true)
  const [summaryLastRecordAt, setSummaryLastRecordAt] = React.useState<string | null>(null)
  const [summaryNextAppt, setSummaryNextAppt] = React.useState<{ start_time: string; procedure?: Pick<Procedure, "name"> | null } | null>(null)
  const [patient, setPatient] = React.useState<Patient | null>(null)
  const [records, setRecords] = React.useState<MedicalRecord[]>([])
  const [transactions, setTransactions] = React.useState<FinancialTransaction[]>([])
  const [anamnesis, setAnamnesis] = React.useState<Anamnesis | null>(null)
  const [appointments, setAppointments] = React.useState<ApptRow[]>([])
  const [docSignedUrls, setDocSignedUrls] = React.useState<Record<string, string>>({})
  const [recordsLoaded, setRecordsLoaded] = React.useState(false)
  const [financeLoaded, setFinanceLoaded] = React.useState(false)
  const [anamLoaded, setAnamLoaded] = React.useState(false)
  const [apptsLoaded, setApptsLoaded] = React.useState(false)
  const [loadingRecords, setLoadingRecords] = React.useState(false)
  const [loadingFinance, setLoadingFinance] = React.useState(false)
  const [loadingAnam, setLoadingAnam] = React.useState(false)
  const [loadingAppts, setLoadingAppts] = React.useState(false)
  const [anamSaving, setAnamSaving] = React.useState(false)
  const [policyOpen, setPolicyOpen] = React.useState(false)

  const {
    control,
    setValue,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<AnamnesisFormValues>({
    resolver: zodResolver(anamnesisSchema),
    defaultValues: {
      chief_complaint: "",
      problem_duration: null,
      health_conditions: [],
      allergies_detail: "",
      medications_continuous: "",
      brush_frequency: "2x",
      floss_usage: "rare",
      sensitivity: "none",
      habits: [],
      last_cleaning: "",
      previous_treatments: [],
      dentist_fear: "0",
      fear_concern: "",
      observations: "",
      consent: false,
      pregnant: "unknown",
    },
  })

  const chiefComplaint = useWatch({ control, name: "chief_complaint" })
  const problemDuration = useWatch({ control, name: "problem_duration" })
  const healthConditions = useWatch({ control, name: "health_conditions" })
  const allergiesDetail = useWatch({ control, name: "allergies_detail" })
  const medicationsContinuous = useWatch({ control, name: "medications_continuous" })
  const brushFrequency = useWatch({ control, name: "brush_frequency" })
  const flossUsage = useWatch({ control, name: "floss_usage" })
  const sensitivity = useWatch({ control, name: "sensitivity" })
  const habits = useWatch({ control, name: "habits" }) ?? []
  const lastCleaning = useWatch({ control, name: "last_cleaning" })
  const previousTreatments = useWatch({ control, name: "previous_treatments" }) ?? []
  const dentistFear = useWatch({ control, name: "dentist_fear" })
  const fearConcern = useWatch({ control, name: "fear_concern" })
  const observations = useWatch({ control, name: "observations" })
  const consent = useWatch({ control, name: "consent" })
  const pregnantChoice = useWatch({ control, name: "pregnant" })

  React.useEffect(() => {
    let mounted = true
    async function loadPatient() {
      setLoadingPatient(true)
      setLoadingSummary(true)
      setTab("resumo")
      setRecords([])
      setTransactions([])
      setAppointments([])
      setAnamnesis(null)
      setRecordsLoaded(false)
      setFinanceLoaded(false)
      setApptsLoaded(false)
      setAnamLoaded(false)
      setSummaryLastRecordAt(null)
      setSummaryNextAppt(null)

      const nowIso = new Date().toISOString()
      try {
        const patientRes = await supabase
          .from("patients")
          .select("id,name,cpf,birth_date,phone,whatsapp,email,address,gender,blood_type,observations,active,created_at,updated_at")
          .eq("id", patientId)
          .maybeSingle()
        if (!mounted) return
        setPatient((patientRes.data ?? null) as Patient | null)
      } finally {
        if (mounted) setLoadingPatient(false)
      }

      try {
        const lastRecordPromise = canSeeRecords
          ? supabase.from("medical_records").select("created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null as unknown, error: null })
        const nextApptPromise = supabase
          .from("appointments")
          .select("start_time,procedure:procedures(name)")
          .eq("patient_id", patientId)
          .gt("start_time", nowIso)
          .order("start_time", { ascending: true })
          .limit(1)
          .maybeSingle()
        const [lastRes, nextRes] = await Promise.all([lastRecordPromise, nextApptPromise])
        if (!mounted) return
        setSummaryLastRecordAt(String((lastRes.data as { created_at?: string } | null)?.created_at ?? "") || null)
        setSummaryNextAppt((nextRes.data ?? null) as { start_time: string; procedure?: Pick<Procedure, "name"> | null } | null)
      } finally {
        if (mounted) setLoadingSummary(false)
      }
    }

    if (patientId)
      void loadPatient().catch(() => {
        if (mounted) setLoadingPatient(false)
      })
    return () => {
      mounted = false
    }
  }, [patientId, canSeeRecords])

  const ensureRecords = React.useCallback(async () => {
    if (!patientId) return
    if (!canSeeRecords) return
    if (recordsLoaded || loadingRecords) return
    setLoadingRecords(true)
    try {
      const { data } = await supabase
        .from("medical_records")
        .select("id,created_at,chief_complaint,attachments")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(200)
      setRecords((data ?? []) as MedicalRecord[])
      setRecordsLoaded(true)
    } finally {
      setLoadingRecords(false)
    }
  }, [canSeeRecords, loadingRecords, patientId, recordsLoaded])

  const ensureFinance = React.useCallback(async () => {
    if (!patientId) return
    if (!canSeeFinance) return
    if (financeLoaded || loadingFinance) return
    setLoadingFinance(true)
    try {
      const { data } = await supabase
        .from("financial_transactions")
        .select("id,type,category,description,amount,due_date,paid_date,status,created_at,appointment_id")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(200)
      setTransactions((data ?? []) as FinancialTransaction[])
      setFinanceLoaded(true)
    } finally {
      setLoadingFinance(false)
    }
  }, [canSeeFinance, financeLoaded, loadingFinance, patientId])

  const ensureAppointments = React.useCallback(async () => {
    if (!patientId) return
    if (apptsLoaded || loadingAppts) return
    setLoadingAppts(true)
    try {
      const { data } = await supabase
        .from("appointments")
        .select("id,start_time,status,procedure:procedures(name)")
        .eq("patient_id", patientId)
        .order("start_time", { ascending: false })
        .limit(200)
      setAppointments((data ?? []) as ApptRow[])
      setApptsLoaded(true)
    } finally {
      setLoadingAppts(false)
    }
  }, [apptsLoaded, loadingAppts, patientId])

  const ensureAnamnesis = React.useCallback(async () => {
    if (!patientId) return
    if (anamLoaded || loadingAnam) return
    setLoadingAnam(true)
    try {
      const { data } = await supabase
        .from("anamnesis")
        .select("id,clinic_id,patient_id,answered_at,responses,allergies,medications,health_conditions,smoker,pregnant")
        .eq("patient_id", patientId)
        .maybeSingle()
      setAnamnesis((data ?? null) as Anamnesis | null)
      setAnamLoaded(true)
    } finally {
      setLoadingAnam(false)
    }
  }, [anamLoaded, loadingAnam, patientId])

  React.useEffect(() => {
    if (tab === "prontuarios" || tab === "documentos") void ensureRecords()
    if (tab === "financeiro") void ensureFinance()
    if (tab === "agendamentos") void ensureAppointments()
    if (tab === "anamnese") void ensureAnamnesis()
  }, [ensureAnamnesis, ensureAppointments, ensureFinance, ensureRecords, tab])

  React.useEffect(() => {
    const r = asRecord(anamnesis?.responses ?? null)
    const sensitivityRaw = asRecord(r?.sensitivity)
    const sensitivityValue = sensitivityRaw?.value ?? r?.sensitivity
    const consentRaw = asRecord(r?.consent)
    const consentAccepted = consentRaw?.accepted === true
    const pdRaw = r?.problem_duration ?? r?.problemDuration
    const pd =
      typeof pdRaw === "string" && (problemDurationAllowed as readonly string[]).includes(pdRaw) ? (pdRaw as ProblemDurationValue) : null
    reset({
      chief_complaint: String(r?.chief_complaint ?? r?.chiefComplaint ?? "").trim(),
      problem_duration: pd,
      health_conditions: pickAllowedArray((Array.isArray(anamnesis?.health_conditions) ? anamnesis?.health_conditions : []) as unknown, healthConditionAllowed),
      allergies_detail: String(r?.allergies_detail ?? r?.allergiesDetail ?? "").trim(),
      medications_continuous: String(r?.medications_continuous ?? r?.medicationsContinuous ?? "").trim(),
      brush_frequency: pickAllowed(r?.brush_frequency ?? r?.brushFrequency, brushFrequencyAllowed, "2x"),
      floss_usage: pickAllowed(r?.floss_usage ?? r?.flossUsage, flossUsageAllowed, "rare"),
      sensitivity: pickAllowed(sensitivityValue, sensitivityAllowed, "none"),
      habits: pickAllowedArray(r?.habits, habitAllowed),
      last_cleaning: String(r?.last_cleaning ?? r?.lastCleaning ?? "").trim(),
      previous_treatments: pickAllowedArray(r?.previous_treatments, previousTreatmentAllowed),
      dentist_fear: pickAllowed(r?.dentist_fear ?? r?.dentistFear, ["0", "1", "2"] as const, "0"),
      fear_concern: String(r?.fear_concern ?? r?.fearConcern ?? "").trim(),
      observations: String(r?.observations ?? "").trim(),
      consent: consentAccepted,
      pregnant: (anamnesis?.pregnant === true ? "yes" : anamnesis?.pregnant === false ? "no" : "unknown") as TriChoice,
    })
  }, [anamnesis, reset])

  const documents = React.useMemo(() => {
    const out: Array<{ path: string; record_id: string; created_at: string }> = []
    const seen = new Set<string>()
    for (const r of records) {
      for (const raw of r.attachments ?? []) {
        const path = String(raw ?? "").trim()
        if (!path || seen.has(path)) continue
        seen.add(path)
        out.push({ path, record_id: r.id, created_at: r.created_at })
      }
    }
    out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    return out
  }, [records])

  React.useEffect(() => {
    let cancelled = false
    async function hydrateSignedUrls() {
      const missing = documents.map((d) => d.path).filter((p) => p && !String(p).startsWith("http"))
      if (!missing.length) return
      const toFetch = missing.filter((p) => !docSignedUrls[p])
      if (!toFetch.length) return
      const next: Record<string, string> = {}
      for (const path of toFetch) {
        const { data, error } = await supabase.storage.from("medical-attachments").createSignedUrl(path, 60 * 60)
        if (!error && data?.signedUrl) next[path] = data.signedUrl
      }
      if (!cancelled && Object.keys(next).length) setDocSignedUrls((prev) => ({ ...prev, ...next }))
    }
    void hydrateSignedUrls()
    return () => {
      cancelled = true
    }
  }, [documents, docSignedUrls])

  if (loadingPatient)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )

  if (!patient)
    return <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Paciente não encontrado.</div>

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button asChild variant="ghost" size="icon" className="mt-0.5">
            <Link to="/app/pacientes" aria-label="Voltar para pacientes">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <div className="text-xl font-semibold">{patient.name}</div>
            <div className="text-sm text-muted-foreground">{patient.cpf ? `CPF: ${patient.cpf}` : "CPF: —"}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link to={`/app/agenda`}>Novo agendamento</Link>
          </Button>
          {patient.whatsapp || patient.phone ? (
            <Button
              variant="outline"
              onClick={() => {
                const phone = (patient.whatsapp ?? patient.phone ?? "").trim()
                if (!phone) return
                window.open(whatsappLink(phone, `Olá, ${patient.name}!`), "_blank")
              }}
            >
              WhatsApp
            </Button>
          ) : null}
          {canSeeRecords ? (
            <Button asChild>
              <Link to={`/app/prontuario/${patient.id}`}>
                <Plus className="mr-2 h-4 w-4" />
                Novo prontuário
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = value as PatientTab
          if (patientTabValues.includes(next)) setTab(next)
        }}
      >
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          {canSeeRecords ? <TabsTrigger value="prontuarios">Prontuários</TabsTrigger> : null}
          {canSeeFinance ? <TabsTrigger value="financeiro">Financeiro</TabsTrigger> : null}
          <TabsTrigger value="anamnese">Anamnese</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Dados cadastrais</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nascimento</span>
                  <span>{patient.birth_date ? formatDate(patient.birth_date) : "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Telefone</span>
                  <span>{patient.phone ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">WhatsApp</span>
                  <span>{patient.whatsapp ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">E-mail</span>
                  <span>{patient.email ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span>{patient.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Resumo clínico</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Último prontuário</span>
                  <span>
                    {loadingSummary ? (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Spinner className="h-4 w-4" />
                        Carregando...
                      </span>
                    ) : canSeeRecords && summaryLastRecordAt ? (
                      formatDateTimeWithYear(summaryLastRecordAt)
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Próxima consulta</span>
                  <span>
                    {loadingSummary ? (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Spinner className="h-4 w-4" />
                        Carregando...
                      </span>
                    ) : summaryNextAppt?.start_time ? (
                      formatDateTimeWithYear(summaryNextAppt.start_time)
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {canSeeRecords ? (
          <TabsContent value="prontuarios">
          <Card>
            <CardHeader>
              <CardTitle>Histórico</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {loadingRecords && !recordsLoaded ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : records.length ? (
                records.map((r) => (
                  <Link
                    key={r.id}
                    to={`/app/prontuario/${patient.id}?record=${r.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-secondary/50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{r.chief_complaint ?? "Prontuário"}</div>
                      <div className="truncate text-xs text-muted-foreground">{formatDateTimeWithYear(r.created_at)}</div>
                    </div>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))
              ) : (
                <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Nenhum prontuário ainda.</div>
              )}
            </CardContent>
          </Card>
          </TabsContent>
        ) : null}

        {canSeeFinance ? (
          <TabsContent value="financeiro">
          <Card>
            <CardHeader>
              <CardTitle>Extrato</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {loadingFinance && !financeLoaded ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : transactions.length ? (
                transactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{t.description ?? t.category ?? "Transação"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        Venc.: {t.due_date ? formatDate(t.due_date) : "—"} • Status:{" "}
                        {t.status === "paid"
                          ? "Pago"
                          : t.status === "pending"
                            ? "Pendente"
                            : t.status === "overdue"
                              ? "Vencido"
                              : "Cancelado"}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{formatMoneyBRL(Number(t.amount))}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Sem movimentações financeiras.</div>
              )}
            </CardContent>
          </Card>
          </TabsContent>
        ) : null}

        <TabsContent value="anamnese">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle>Questionário de saúde</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!anamLoaded || !anamnesis}
                onClick={() => {
                  if (!anamLoaded || !anamnesis) {
                    toast.error("Preencha a anamnese antes de gerar o relatório.")
                    return
                  }
                  const url = `${window.location.origin}/app/pacientes/${patientId}/anamnese/relatorio?auto=1`
                  const w = window.open(url, "_blank", "noopener,noreferrer")
                  if (!w) toast.error("O navegador bloqueou o pop-up. Permita pop-ups para gerar o PDF.")
                }}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Relatório
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4">
              {loadingAnam && !anamLoaded ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : null}
              {anamLoaded && !anamnesis ? <div className="rounded-lg border p-4 text-sm text-muted-foreground">Anamnese não preenchida.</div> : null}
              {anamLoaded && anamnesis?.answered_at ? (
                <div className="text-xs text-muted-foreground">Última atualização: {formatDate(anamnesis.answered_at)}</div>
              ) : null}

              <form
                className="grid gap-4"
                onSubmit={handleSubmit(async (values) => {
                  if (!canEditAnamnesis) return
                  setAnamSaving(true)
                  try {
                    const sensitivityMeta = sensitivityOptions.find((x) => x.value === values.sensitivity) ?? sensitivityOptions[0]
                    const hygieneScore =
                      (values.floss_usage === "daily" ? 0 : values.floss_usage === "rare" ? 1 : 2) +
                      (values.brush_frequency === "3x+" || values.brush_frequency === "2x" ? 0 : values.brush_frequency === "1x" ? 1 : 2) +
                      sensitivityMeta.score
                    const habitsList = ((values.habits ?? []) as HabitValue[]).filter(Boolean)
                    const previousTreatmentsList = (values.previous_treatments ?? []) as PreviousTreatmentValue[]
                    const habitMeta = habitsList.map((h: HabitValue) => {
                      const m = habitOptions.find((x) => x.value === h)
                      return m ? { value: m.value, risk: m.risk } : { value: String(h), risk: "unknown" }
                    })
                    const responses: Json = {
                      version: 2,
                      chief_complaint: values.chief_complaint,
                      problem_duration: values.problem_duration ?? null,
                      allergies_detail: values.health_conditions.includes("alergias") ? String(values.allergies_detail ?? "").trim() : null,
                      medications_continuous: String(values.medications_continuous ?? "").trim() || null,
                      brush_frequency: values.brush_frequency,
                      floss_usage: values.floss_usage,
                      sensitivity: { value: values.sensitivity, score: sensitivityMeta.score },
                      habits: habitMeta,
                      last_cleaning: values.last_cleaning.trim(),
                      previous_treatments: previousTreatmentsList,
                      dentist_fear: values.dentist_fear ?? null,
                      fear_concern: values.dentist_fear === "1" || values.dentist_fear === "2" ? String(values.fear_concern ?? "").trim() : null,
                      observations: String(values.observations ?? "").trim() || null,
                      hygiene_score: hygieneScore,
                      consent: { accepted: true, accepted_at: new Date().toISOString() },
                    }

                    const payload = {
                      patient_id: patientId,
                      answered_at: new Date().toISOString(),
                      health_conditions: values.health_conditions,
                      allergies: values.health_conditions.includes("alergias") ? parseList(String(values.allergies_detail ?? "")) : [],
                      medications: parseList(String(values.medications_continuous ?? "")),
                      smoker: habitsList.includes("smoke") ? true : habitsList.length ? false : null,
                      pregnant: values.pregnant === "unknown" ? null : values.pregnant === "yes",
                      responses,
                    }

                    if (anamnesis?.id) {
                      const { data, error } = await supabase.from("anamnesis").update(payload).eq("id", anamnesis.id).select("*").maybeSingle()
                      if (error) throw error
                      setAnamnesis((data ?? null) as Anamnesis | null)
                    } else {
                      const { data, error } = await supabase.from("anamnesis").insert(payload).select("*").maybeSingle()
                      if (error) throw error
                      setAnamnesis((data ?? null) as Anamnesis | null)
                    }

                    toast.success("Anamnese salva.")
                  } catch (err: unknown) {
                    toast.error(errorMessage(err))
                  } finally {
                    setAnamSaving(false)
                  }
                })}
              >
                <div className="grid gap-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 font-semibold">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      Queixa principal
                    </div>
                    <Badge variant="secondary">Seção 1</Badge>
                  </div>
                  <div className="grid gap-2">
                    <Label>Queixa principal *</Label>
                    <textarea
                      className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={chiefComplaint}
                      onChange={(e) => setValue("chief_complaint", e.target.value, { shouldDirty: true })}
                      placeholder="O que o(a) traz até nós? Descreva sua principal queixa ou motivo da consulta..."
                      disabled={!canEditAnamnesis || anamSaving}
                      maxLength={500}
                    />
                    {errors.chief_complaint?.message ? <div className="text-sm text-destructive">{errors.chief_complaint.message}</div> : null}
                  </div>
                  <div className="grid gap-2">
                    <Label>Tempo do problema</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {problemDurationOptions.map((o) => (
                        <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                          <input
                            type="radio"
                            name="problem_duration"
                            value={o.value}
                            checked={problemDuration === o.value}
                            onChange={() => setValue("problem_duration", o.value, { shouldDirty: true })}
                            disabled={!canEditAnamnesis || anamSaving}
                          />
                          <span className="min-w-0">{o.label}</span>
                        </label>
                      ))}
                      <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                        <input
                          type="radio"
                          name="problem_duration"
                          value=""
                          checked={!problemDuration}
                          onChange={() => setValue("problem_duration", null, { shouldDirty: true })}
                          disabled={!canEditAnamnesis || anamSaving}
                        />
                        <span className="min-w-0">Não informar</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 font-semibold">
                      <HeartPulse className="h-4 w-4 text-muted-foreground" />
                      Histórico de saúde geral
                    </div>
                    <Badge variant="secondary">Seção 2</Badge>
                  </div>

                  <div className="grid gap-2">
                    <Label>Doenças e condições *</Label>
                    <div className="grid gap-2 md:grid-cols-2">
                      {healthConditionOptions.map((o) => {
                        const selected = healthConditions.includes(o.value)
                        return (
                          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() =>
                                setValue("health_conditions", toggleInArray(healthConditions, o.value), { shouldDirty: true })
                              }
                              disabled={!canEditAnamnesis || anamSaving}
                            />
                            <span className="min-w-0">{o.label}</span>
                          </label>
                        )
                      })}
                    </div>
                    {errors.health_conditions?.message ? <div className="text-sm text-destructive">{errors.health_conditions.message as string}</div> : null}
                  </div>

                  <div
                    className={`grid gap-2 overflow-hidden rounded-md border-l-4 bg-secondary/30 p-3 transition-all duration-300 ${
                      healthConditions.includes("alergias") ? "max-h-[240px] opacity-100" : "max-h-0 border-transparent p-0 opacity-0"
                    }`}
                  >
                    <Label>Especificar alergias *</Label>
                    <textarea
                      className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={String(allergiesDetail ?? "")}
                      onChange={(e) => setValue("allergies_detail", e.target.value, { shouldDirty: true })}
                      placeholder="Liste suas alergias (medicamentos, alimentos, materiais dentários...)"
                      disabled={!canEditAnamnesis || anamSaving || !healthConditions.includes("alergias")}
                    />
                    {errors.allergies_detail?.message ? <div className="text-sm text-destructive">{errors.allergies_detail.message}</div> : null}
                  </div>

                  <div className="grid gap-2">
                    <Label>Medicamentos contínuos</Label>
                    <textarea
                      className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={String(medicationsContinuous ?? "")}
                      onChange={(e) => setValue("medications_continuous", e.target.value, { shouldDirty: true })}
                      placeholder="Liste os medicamentos que toma regularmente (nome, dosagem, frequência...)"
                      disabled={!canEditAnamnesis || anamSaving}
                      maxLength={800}
                    />
                    <div className="text-xs text-muted-foreground">Esta informação é importante para evitar interações medicamentosas.</div>
                    {errors.medications_continuous?.message ? <div className="text-sm text-destructive">{errors.medications_continuous.message}</div> : null}
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 font-semibold">
                      <Smile className="h-4 w-4 text-muted-foreground" />
                      Saúde bucal
                    </div>
                    <Badge variant="secondary">Seção 3</Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Frequência de escovação *</Label>
                      <div className="grid gap-2">
                        {brushFrequencyOptions.map((o) => (
                          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                            <input
                              type="radio"
                              name="brush_frequency"
                              value={o.value}
                              checked={brushFrequency === o.value}
                              onChange={() => setValue("brush_frequency", o.value, { shouldDirty: true })}
                              disabled={!canEditAnamnesis || anamSaving}
                            />
                            <span className="min-w-0">{o.label}</span>
                          </label>
                        ))}
                      </div>
                      {errors.brush_frequency?.message ? <div className="text-sm text-destructive">{errors.brush_frequency.message}</div> : null}
                    </div>

                    <div className="grid gap-2">
                      <Label>Uso de fio dental *</Label>
                      <div className="grid gap-2">
                        {flossUsageOptions.map((o) => (
                          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                            <input
                              type="radio"
                              name="floss_usage"
                              value={o.value}
                              checked={flossUsage === o.value}
                              onChange={() => setValue("floss_usage", o.value, { shouldDirty: true })}
                              disabled={!canEditAnamnesis || anamSaving}
                            />
                            <span className="min-w-0">{o.label}</span>
                          </label>
                        ))}
                      </div>
                      {errors.floss_usage?.message ? <div className="text-sm text-destructive">{errors.floss_usage.message}</div> : null}
                    </div>
                    <div className="text-xs text-muted-foreground md:col-span-2">Recomendado: 2–3 vezes ao dia.</div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Sensibilidade dentária *</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {sensitivityOptions.map((o) => (
                        <label key={o.value} className="flex cursor-pointer items-center justify-between gap-2 rounded-md border p-2 text-sm">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="sensitivity"
                              value={o.value}
                              checked={sensitivity === o.value}
                              onChange={() => setValue("sensitivity", o.value, { shouldDirty: true })}
                              disabled={!canEditAnamnesis || anamSaving}
                            />
                            <span>{o.label}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{o.score} pts</span>
                        </label>
                      ))}
                    </div>
                    {errors.sensitivity?.message ? <div className="text-sm text-destructive">{errors.sensitivity.message}</div> : null}
                  </div>

                  <div className="grid gap-2">
                    <Label>Hábitos</Label>
                    <div className="grid gap-2 md:grid-cols-2">
                      {habitOptions.map((o) => {
                        const selected = habits.includes(o.value)
                        return (
                          <label key={o.value} className="flex cursor-pointer items-center justify-between gap-2 rounded-md border p-2 text-sm">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => setValue("habits", toggleInArray(habits, o.value), { shouldDirty: true })}
                                disabled={!canEditAnamnesis || anamSaving}
                              />
                              <span className="min-w-0">{o.label}</span>
                            </div>
                            <Badge variant={o.risk === "high" ? "destructive" : o.risk === "medium" ? "default" : "secondary"}>
                              {o.risk === "high" ? "Risco alto" : o.risk === "medium" ? "Risco médio" : "Risco baixo"}
                            </Badge>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid gap-2 md:max-w-xs">
                    <Label>Gestante?</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={pregnantChoice}
                      onChange={(e) => setValue("pregnant", e.target.value as TriChoice, { shouldDirty: true })}
                      disabled={!canEditAnamnesis || anamSaving}
                    >
                      <option value="unknown">Não informado</option>
                      <option value="no">Não</option>
                      <option value="yes">Sim</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 font-semibold">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      Histórico odontológico
                    </div>
                    <Badge variant="secondary">Seção 4</Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Última limpeza *</Label>
                      <Input
                        value={lastCleaning}
                        onChange={(e) => setValue("last_cleaning", e.target.value, { shouldDirty: true })}
                        placeholder="Ex: Há 6 meses, Há 1 ano, Nunca fiz"
                        disabled={!canEditAnamnesis || anamSaving}
                      />
                      {errors.last_cleaning?.message ? <div className="text-sm text-destructive">{errors.last_cleaning.message}</div> : null}
                    </div>

                    <div className="grid gap-2">
                      <Label>Medo de dentista</Label>
                      <div className="grid gap-2">
                        {[
                          { label: "Não", value: "0" },
                          { label: "Um pouco", value: "1" },
                          { label: "Sim, bastante", value: "2" },
                        ].map((o) => (
                          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                            <input
                              type="radio"
                              name="dentist_fear"
                              value={o.value}
                              checked={dentistFear === o.value}
                              onChange={() => setValue("dentist_fear", o.value as "0" | "1" | "2", { shouldDirty: true })}
                              disabled={!canEditAnamnesis || anamSaving}
                            />
                            <span className="min-w-0">{o.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Tratamentos anteriores</Label>
                    <div className="grid gap-2 md:grid-cols-2">
                      {previousTreatmentOptions.map((o) => {
                        const selected = previousTreatments.includes(o.value)
                        return (
                          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() =>
                                setValue("previous_treatments", toggleInArray(previousTreatments, o.value), { shouldDirty: true })
                              }
                              disabled={!canEditAnamnesis || anamSaving}
                            />
                            <span className="min-w-0">{o.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div
                    className={`grid gap-2 overflow-hidden rounded-md border-l-4 bg-secondary/30 p-3 transition-all duration-300 ${
                      dentistFear === "1" || dentistFear === "2"
                        ? "max-h-[220px] opacity-100"
                        : "max-h-0 border-transparent p-0 opacity-0"
                    }`}
                  >
                    <Label>Preocupação específica *</Label>
                    <textarea
                      className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={String(fearConcern ?? "")}
                      onChange={(e) => setValue("fear_concern", e.target.value, { shouldDirty: true })}
                      placeholder="Qual é sua principal preocupação? Descreva o que o assusta mais..."
                      disabled={!canEditAnamnesis || anamSaving || !(dentistFear === "1" || dentistFear === "2")}
                      maxLength={300}
                    />
                    {errors.fear_concern?.message ? <div className="text-sm text-destructive">{errors.fear_concern.message}</div> : null}
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 font-semibold">
                      <NotebookPen className="h-4 w-4 text-muted-foreground" />
                      Observações adicionais
                    </div>
                    <Badge variant="secondary">Seção 5</Badge>
                  </div>

                  <div className="grid gap-2">
                    <Label>Observações gerais</Label>
                    <textarea
                      className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={String(observations ?? "")}
                      onChange={(e) => setValue("observations", e.target.value, { shouldDirty: true })}
                      placeholder="Há algo mais que devemos saber sobre você? Informações adicionais que julgar relevantes..."
                      disabled={!canEditAnamnesis || anamSaving}
                      maxLength={1000}
                    />
                    {errors.observations?.message ? <div className="text-sm text-destructive">{errors.observations.message}</div> : null}
                  </div>

                  <div className={`rounded-md border-l-4 p-3 ${consent ? "border-transparent bg-secondary/20" : "border-destructive bg-destructive/5"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setValue("consent", e.target.checked, { shouldDirty: true })}
                          disabled={!canEditAnamnesis || anamSaving}
                        />
                        <span>Autorizo o uso destes dados para meu atendimento e concordo com a política de privacidade *</span>
                      </label>
                      <Button type="button" variant="outline" size="sm" onClick={() => setPolicyOpen(true)}>
                        <ShieldCheck className="h-4 w-4" />
                        Política
                      </Button>
                    </div>
                    {errors.consent?.message ? <div className="mt-2 text-sm text-destructive">{errors.consent.message}</div> : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    {canEditAnamnesis ? (isDirty ? "Há alterações não salvas." : "Sem alterações.") : "Sem permissão para editar anamnese."}
                  </div>
                  <Button type="submit" disabled={!canEditAnamnesis || anamSaving}>
                    {anamSaving ? "Salvando..." : "Salvar anamnese"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Política de privacidade</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 text-sm">
              <div>
                Estes dados são utilizados exclusivamente para o atendimento odontológico e para a segurança clínica do paciente, respeitando a privacidade e as normas aplicáveis.
              </div>
              <div>
                A clínica pode armazenar informações de saúde, histórico e documentos anexos no prontuário do paciente para fins de acompanhamento, diagnóstico e continuidade do tratamento.
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <CardTitle>Arquivos</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {!canSeeRecords ? (
                <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
                  Sem permissão para visualizar documentos do prontuário.
                </div>
              ) : loadingRecords && !recordsLoaded ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : documents.length ? (
                documents.map((d) => {
                  const kind = fileKind(d.path)
                  const href = String(d.path).startsWith("http") ? d.path : docSignedUrls[d.path]
                  const label = fileNameFromPath(d.path)
                  return (
                    <a
                      key={d.path}
                      href={href ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-secondary/50 ${href ? "" : "pointer-events-none opacity-60"}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {kind === "image" ? <FileImage className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{label}</div>
                          <div className="truncate text-xs text-muted-foreground">Prontuário • {formatDateTimeWithYear(d.created_at)}</div>
                        </div>
                      </div>
                      <Badge variant="secondary">{kind === "pdf" ? "PDF" : kind === "image" ? "Imagem" : "Arquivo"}</Badge>
                    </a>
                  )
                })
              ) : (
                <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Sem documentos anexados.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agendamentos">
          <Card>
            <CardHeader>
              <CardTitle>Histórico e futuros</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {loadingAppts && !apptsLoaded ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : appointments.length ? (
                appointments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{a.procedure?.name ?? "Consulta"}</div>
                      <div className="truncate text-xs text-muted-foreground">{formatDateTimeWithYear(a.start_time)} • {statusLabel[a.status]}</div>
                    </div>
                    <Badge variant={a.status === "confirmed" ? "success" : a.status === "no_show" ? "destructive" : a.status === "scheduled" ? "default" : "secondary"}>
                      {statusLabel[a.status]}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Sem agendamentos.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function PatientAnamnesisReportPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const printableRef = React.useRef<HTMLDivElement>(null)
  const didAutoPrintRef = React.useRef(false)

  const patientId = String(id ?? "")
  const [loading, setLoading] = React.useState(true)
  const [clinicBrand, setClinicBrand] = React.useState<{ name: string; slogan: string; logo_url: string } | null>(null)
  const [patient, setPatient] = React.useState<Pick<Patient, "id" | "name" | "birth_date" | "cpf" | "phone" | "whatsapp" | "email"> | null>(null)
  const [anamnesis, setAnamnesis] = React.useState<Anamnesis | null>(null)

  const onPrint = useReactToPrint({
    contentRef: printableRef,
    documentTitle: `Anamnese - ${patient?.name ?? "Paciente"}`,
    pageStyle: "@page { size: A4; margin: 12mm; } html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }",
  })

  React.useEffect(() => {
    let mounted = true
    async function load() {
      if (!profile?.clinic_id || !patientId) return
      setLoading(true)
      try {
        const [clinicRes, patientRes, anamRes] = await Promise.all([
          supabase.from("clinics").select("name,slogan,logo_url").eq("id", profile.clinic_id).maybeSingle(),
          supabase.from("patients").select("id,name,birth_date,cpf,phone,whatsapp,email").eq("id", patientId).maybeSingle(),
          supabase
            .from("anamnesis")
            .select("id,clinic_id,patient_id,answered_at,responses,allergies,medications,health_conditions,smoker,pregnant")
            .eq("patient_id", patientId)
            .order("answered_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])
        if (!mounted) return
        const name = String(clinicRes.data?.name ?? "").trim()
        const slogan = String((clinicRes.data as unknown as { slogan?: unknown } | null)?.slogan ?? "").trim()
        const logoUrl = String(clinicRes.data?.logo_url ?? "").trim()
        setClinicBrand({ name, slogan, logo_url: logoUrl })
        setPatient((patientRes.data ?? null) as Pick<Patient, "id" | "name" | "birth_date" | "cpf" | "phone" | "whatsapp" | "email"> | null)
        setAnamnesis((anamRes.data ?? null) as Anamnesis | null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load().catch(() => {
      if (mounted) setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [profile?.clinic_id, patientId])

  const responses = React.useMemo(() => asRecord(anamnesis?.responses ?? null) ?? {}, [anamnesis?.responses])
  const sensitivity = asRecord(responses.sensitivity)
  const consent = asRecord(responses.consent)
  const habits = Array.isArray(responses.habits) ? responses.habits : []
  const auto = params.get("auto") === "1"

  React.useEffect(() => {
    if (!auto) return
    if (loading) return
    if (!anamnesis) return
    if (didAutoPrintRef.current) return
    didAutoPrintRef.current = true
    setTimeout(() => {
      void onPrint()
    }, 0)
  }, [auto, loading, anamnesis, onPrint])

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )

  if (!patient)
    return (
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xl font-semibold">Relatório de anamnese</div>
          <Button variant="outline" onClick={() => navigate("/app/pacientes")}>
            Voltar
          </Button>
        </div>
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">Paciente não encontrado.</div>
      </div>
    )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-1">
          <div className="text-xl font-semibold">Relatório de anamnese</div>
          <div className="text-sm text-muted-foreground">{anamnesis?.answered_at ? `Última atualização: ${formatDate(anamnesis.answered_at)}` : "Sem registro de anamnese"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Voltar
          </Button>
          <Button onClick={() => onPrint()} disabled={!anamnesis}>
            Baixar PDF
          </Button>
        </div>
      </div>

      <div ref={printableRef}>
        <div className="grid gap-4 rounded-lg border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {clinicBrand?.logo_url ? <img src={clinicBrand.logo_url} alt={clinicBrand.name} className="h-12 w-12 rounded object-contain" /> : null}
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">{clinicBrand?.name || "Clínica"}</div>
                <div className="truncate text-sm text-muted-foreground">{clinicBrand?.slogan || ""}</div>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div>Emitido em {formatDateTimeWithYear(new Date().toISOString())}</div>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border bg-background p-4 text-sm">
            <div className="font-semibold">Paciente</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium">{patient.name}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Nascimento</span>
                <span className="font-medium">{patient.birth_date ? formatDate(patient.birth_date) : "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">CPF</span>
                <span className="font-medium">{patient.cpf ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Contato</span>
                <span className="font-medium">{patient.whatsapp ?? patient.phone ?? "—"}</span>
              </div>
            </div>
          </div>

          {!anamnesis ? (
            <div className="rounded-lg border p-6 text-sm text-muted-foreground">Nenhuma anamnese preenchida para este paciente.</div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-2 rounded-lg border bg-background p-4 text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Queixa principal
                </div>
                <div className="whitespace-pre-wrap">{String(responses.chief_complaint ?? "—")}</div>
                <div className="text-muted-foreground">Duração: {labelFromOptions(responses.problem_duration, problemDurationOptions)}</div>
              </div>

              <div className="grid gap-2 rounded-lg border bg-background p-4 text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <HeartPulse className="h-4 w-4 text-muted-foreground" />
                  Saúde geral
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Condições</span>
                  <span className="font-medium">
                    {(() => {
                      const list = Array.isArray(anamnesis.health_conditions) ? (anamnesis.health_conditions as unknown[]) : []
                      const labels = list
                        .map((v) => healthConditionOptions.find((o) => o.value === v)?.label ?? String(v ?? "").trim())
                        .filter(Boolean)
                      return labels.length ? labels.join(", ") : "—"
                    })()}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Alergias</span>
                  <span className="font-medium">{joinArray(anamnesis.allergies)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Medicamentos</span>
                  <span className="font-medium">{joinArray(anamnesis.medications)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Gestante</span>
                  <span className="font-medium">{yesNoUnknown(anamnesis.pregnant)}</span>
                </div>
              </div>

              <div className="grid gap-2 rounded-lg border bg-background p-4 text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <NotebookPen className="h-4 w-4 text-muted-foreground" />
                  Saúde bucal
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Escovação</span>
                    <span className="font-medium">{labelFromOptions(responses.brush_frequency, brushFrequencyOptions)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Fio dental</span>
                    <span className="font-medium">{labelFromOptions(responses.floss_usage, flossUsageOptions)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:col-span-2">
                    <span className="text-muted-foreground">Sensibilidade</span>
                    <span className="font-medium">{labelFromOptions(sensitivity?.value, sensitivityOptions)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Hábitos</span>
                  <span className="font-medium">
                    {habits.length
                      ? habits
                          .map((h) => {
                            const r = asRecord(h)
                            const v = String(r?.value ?? "").trim()
                            if (!v) return null
                            return habitOptions.find((o) => o.value === v)?.label ?? v
                          })
                          .filter(Boolean)
                          .join(", ")
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Fumante</span>
                  <span className="font-medium">{yesNoUnknown(anamnesis.smoker)}</span>
                </div>
              </div>

              <div className="grid gap-2 rounded-lg border bg-background p-4 text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  Histórico odontológico
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Última limpeza</span>
                  <span className="font-medium">{String(responses.last_cleaning ?? "—")}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Tratamentos anteriores</span>
                  <span className="font-medium">{joinArray(responses.previous_treatments)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Medo de dentista</span>
                  <span className="font-medium">{String(responses.dentist_fear ?? "—")}</span>
                </div>
                {String(responses.fear_concern ?? "").trim() ? <div className="text-muted-foreground">Preocupação: {String(responses.fear_concern)}</div> : null}
              </div>

              <div className="grid gap-2 rounded-lg border bg-background p-4 text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  Consentimento e observações
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Consentimento</span>
                  <span className="font-medium">{consent?.accepted === true ? "Aceito" : "—"}</span>
                </div>
                {String(responses.observations ?? "").trim() ? (
                  <div className="whitespace-pre-wrap">{String(responses.observations)}</div>
                ) : (
                  <div className="text-muted-foreground">Sem observações.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
