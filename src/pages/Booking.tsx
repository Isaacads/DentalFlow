import * as React from "react"
import { useParams } from "react-router-dom"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"

type DentistOption = { id: string; full_name: string }
type ProcedureOption = { id: string; name: string; duration_minutes?: number | null }

function getErrorMessage(err: unknown) {
  if (err && typeof err === "object") {
    const anyErr = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [anyErr.message, anyErr.details, anyErr.hint, anyErr.code]
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean)
    if (parts.length) return parts.join(" • ")
  }
  if (typeof err === "string") return err
  return "Erro desconhecido."
}

function coerceArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  return []
}

export function BookingPage() {
  const { slug = "" } = useParams()
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [bookingMode, setBookingMode] = React.useState<"request" | "auto">("request")
  const [bookedStart, setBookedStart] = React.useState<string | null>(null)
  const [configError, setConfigError] = React.useState<string>("")

  const [clinicName, setClinicName] = React.useState("AMMI DentalFlow")
  const [windowDays, setWindowDays] = React.useState(14)
  const [leadHours, setLeadHours] = React.useState(2)
  const [dentists, setDentists] = React.useState<DentistOption[]>([])
  const [procedures, setProcedures] = React.useState<ProcedureOption[]>([])

  const [dentistId, setDentistId] = React.useState<string>("")
  const [procedureId, setProcedureId] = React.useState<string>("")
  const [slots, setSlots] = React.useState<string[]>([])
  const [selectedSlots, setSelectedSlots] = React.useState<string[]>([])

  const [patientName, setPatientName] = React.useState("")
  const [patientWhatsapp, setPatientWhatsapp] = React.useState("")
  const [patientEmail, setPatientEmail] = React.useState("")
  const [notes, setNotes] = React.useState("")

  React.useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setConfigError("")
      if (!isSupabaseConfigured) {
        if (!mounted) return
        setConfigError("Agendamento online indisponível: o app não está conectado ao Supabase (variáveis de ambiente não configuradas).")
        setLoading(false)
        return
      }
      try {
        const { data, error } = await supabase.rpc("get_booking_config", { p_slug: slug })
        if (error) throw error
        const row = (data ?? [])[0] as
          | {
              clinic_name?: string
              booking_mode?: string
              booking_window_days?: number
              booking_lead_time_hours?: number
              dentists?: unknown
              procedures?: unknown
            }
          | undefined
        if (!row) throw new Error("Agendamento online indisponível.")
        if (!mounted) return
        setClinicName(String(row.clinic_name ?? "AMMI DentalFlow"))
        setBookingMode(row.booking_mode === "auto" ? "auto" : "request")
        setWindowDays(Number(row.booking_window_days ?? 14))
        setLeadHours(Number(row.booking_lead_time_hours ?? 2))
        setDentists(coerceArray<DentistOption>(row.dentists))
        setProcedures(coerceArray<ProcedureOption>(row.procedures))
      } catch (e) {
        const msg = getErrorMessage(e)
        if (mounted) {
          setConfigError(msg)
          toast.error(msg)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [slug])

  React.useEffect(() => {
    if (loading) return
    let mounted = true
    async function loadSlots() {
      try {
        const daysToLoad = Math.max(1, Math.min(14, Number(windowDays || 7)))
        const { data, error } = await supabase.rpc("get_booking_availability", {
          p_slug: slug,
          p_dentist_id: dentistId || null,
          p_procedure_id: procedureId || null,
          p_days: daysToLoad,
        })
        if (error) throw error
        if (!mounted) return
        const list = (data ?? []) as Array<{ start_time: string }>
        setSlots(list.map((x) => String(x.start_time)))
        setSelectedSlots([])
      } catch (e) {
        if (mounted) toast.error(getErrorMessage(e))
        if (mounted) setSlots([])
      }
    }
    void loadSlots()
    return () => {
      mounted = false
    }
  }, [slug, dentistId, procedureId, loading, windowDays])

  const groupedSlots = React.useMemo(() => {
    const groups = new Map<string, string[]>()
    for (const s of slots) {
      const d = new Date(s)
      const key = format(d, "yyyy-MM-dd")
      const arr = groups.get(key) ?? []
      arr.push(s)
      groups.set(key, arr)
    }
    return Array.from(groups.entries()).map(([key, list]) => ({ key, date: new Date(list[0]), list }))
  }, [slots])

  async function onSubmit() {
    if (submitting) return
    const name = patientName.trim()
    const whatsapp = patientWhatsapp.trim()
    if (name.length < 2) {
      toast.error("Informe seu nome.")
      return
    }
    if (whatsapp.replace(/\D/g, "").length < 10) {
      toast.error("Informe um WhatsApp válido.")
      return
    }
    if (selectedSlots.length < 1) {
      toast.error("Selecione pelo menos 1 horário.")
      return
    }
    if (bookingMode === "auto" && selectedSlots.length !== 1) {
      toast.error("Selecione 1 horário para agendar.")
      return
    }
    setSubmitting(true)
    try {
      if (bookingMode === "auto") {
        const { error } = await supabase.rpc("create_booking_appointment", {
          p_slug: slug,
          p_patient_name: name,
          p_patient_whatsapp: whatsapp,
          p_start_time: selectedSlots[0],
          p_patient_email: patientEmail.trim() || null,
          p_dentist_id: dentistId || null,
          p_procedure_id: procedureId || null,
          p_notes: notes.trim() || null,
        })
        if (error) throw error
        setBookedStart(selectedSlots[0])
      } else {
        const { error } = await supabase.rpc("create_booking_request", {
          p_slug: slug,
          p_patient_name: name,
          p_patient_whatsapp: whatsapp,
          p_patient_email: patientEmail.trim() || null,
          p_dentist_id: dentistId || null,
          p_procedure_id: procedureId || null,
          p_preferred_times: selectedSlots,
          p_notes: notes.trim() || null,
        })
        if (error) throw error
      }
      setDone(true)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (configError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg rounded-xl border bg-card p-6 text-center shadow-soft">
          <div className="text-lg font-semibold">Agendamento online</div>
          <div className="mt-3 text-sm text-muted-foreground">{configError}</div>
          <div className="mt-3 text-xs text-muted-foreground">Link: /booking/{slug || "—"}</div>
          <a className="mt-5 inline-flex text-sm font-medium text-accent hover:underline" href="/">
            Voltar ao site
          </a>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg rounded-xl border bg-card p-6 text-center shadow-soft">
          <div className="text-lg font-semibold">{clinicName}</div>
          <div className="mt-3 text-sm text-muted-foreground">
            {bookingMode === "auto"
              ? bookedStart
                ? `Consulta agendada para ${format(new Date(bookedStart), "dd/MM 'às' HH:mm", { locale: ptBR })}.`
                : "Consulta agendada."
              : "Recebemos sua solicitação de agendamento. Em breve a equipe entra em contato para confirmar o melhor horário."}
          </div>
          <a className="mt-5 inline-flex text-sm font-medium text-accent hover:underline" href="/">
            Voltar ao site
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background p-4">
      <div className="mx-auto grid w-full max-w-4xl gap-4">
        <div className="rounded-xl border bg-card p-5 shadow-soft">
          <div className="text-xl font-semibold">{clinicName}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {bookingMode === "auto"
              ? "Escolha o atendimento e selecione 1 horário para agendar agora."
              : "Escolha o atendimento e selecione de 1 a 3 horários. A clínica confirma pelo WhatsApp."}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Janela: até {windowDays} dias • Antecedência mínima: {leadHours}h
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Preferências</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>Procedimento</Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={procedureId}
                  onChange={(e) => setProcedureId(e.target.value)}
                >
                  <option value="">(Qualquer)</option>
                  {procedures.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {!procedures.length ? <div className="text-xs text-muted-foreground">Nenhum procedimento ativo cadastrado.</div> : null}
              </div>

              <div className="grid gap-2">
                <Label>Profissional</Label>
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={dentistId} onChange={(e) => setDentistId(e.target.value)}>
                  <option value="">(Qualquer)</option>
                  {dentists.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
                {!dentists.length ? <div className="text-xs text-muted-foreground">Nenhum profissional (admin/dentista) ativo disponível.</div> : null}
              </div>

              <div className="grid gap-2">
                <Label>Seu nome</Label>
                <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="grid gap-2">
                <Label>WhatsApp</Label>
                <Input value={patientWhatsapp} onChange={(e) => setPatientWhatsapp(e.target.value)} placeholder="(DDD) 9xxxx-xxxx" />
              </div>
              <div className="grid gap-2">
                <Label>E-mail (opcional)</Label>
                <Input value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} placeholder="voce@email.com" />
              </div>
              <div className="grid gap-2">
                <Label>Observações (opcional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: dor, preferência de horário, convênio..." />
              </div>

              <Button onClick={onSubmit} disabled={submitting}>
                {submitting ? "Enviando..." : bookingMode === "auto" ? "Agendar agora" : "Solicitar agendamento"}
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Horários disponíveis</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {!groupedSlots.length ? (
                <div className="text-sm text-muted-foreground">
                  {dentists.length
                    ? `Nenhum horário disponível nos próximos ${Math.max(1, Math.min(14, Number(windowDays || 7)))} dias.`
                    : "Nenhum profissional disponível para agendamento online."}
                </div>
              ) : null}
              {groupedSlots.map((g) => (
                <div key={g.key} className="grid gap-2">
                  <div className="text-sm font-medium">{format(g.date, "EEEE dd/MM", { locale: ptBR }).replace(".", "")}</div>
                  <div className="flex flex-wrap gap-2">
                    {g.list.map((s) => {
                      const selected = selectedSlots.includes(s)
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setSelectedSlots((prev) => {
                              if (prev.includes(s)) return prev.filter((x) => x !== s)
                              if (bookingMode === "auto") return [s]
                              if (prev.length >= 3) {
                                toast.error("Selecione no máximo 3 horários.")
                                return prev
                              }
                              return [...prev, s]
                            })
                          }}
                          className={`h-9 rounded-md border px-3 text-sm ${selected ? "border-accent bg-accent text-white" : "bg-background hover:bg-secondary"}`}
                        >
                          {format(new Date(s), "HH:mm", { locale: ptBR })}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="text-xs text-muted-foreground">
                {bookingMode === "auto" ? "Selecione 1 horário para agendar." : "Selecione até 3 horários. A clínica confirma pelo WhatsApp."}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
