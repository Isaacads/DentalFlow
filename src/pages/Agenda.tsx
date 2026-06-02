import * as React from "react"
import { addDays, format, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Appointment, BookingRequest, Patient, Procedure, Profile, ScheduleBlock, WhatsAppMessage } from "@/types/database"
import { canAccess, planAllows, useAuth } from "@/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { formatDateTime } from "@/lib/format"

type AppointmentRow = Appointment & {
  patient?: Pick<Patient, "id" | "name" | "whatsapp" | "phone"> | null
  procedure?: Pick<Procedure, "id" | "name" | "duration_minutes" | "base_price"> | null
  dentist?: Pick<Profile, "id" | "full_name" | "color"> | null
}

type BookingRequestRow = BookingRequest & {
  procedure?: Pick<Procedure, "name"> | null
  dentist?: Pick<Profile, "full_name"> | null
}

type WhatsAppQueueRow = WhatsAppMessage & {
  appointment?: Pick<Appointment, "id" | "start_time" | "status"> | null
  patient?: Pick<Patient, "id" | "name" | "whatsapp" | "phone"> | null
}

const agendaAppointmentSelect =
  "id,patient_id,dentist_id,procedure_id,start_time,end_time,status,notes,room,created_via,created_at,patient:patients(id,name,whatsapp,phone),procedure:procedures(id,name,duration_minutes,base_price),dentist:profiles(id,full_name,color)"
const agendaScheduleBlockSelect = "id,title,start_time,end_time,dentist_id,created_at"
const agendaBookingRequestSelect =
  "id,status,created_at,patient_name,patient_whatsapp,preferred_times,procedure_id,dentist_id,procedure:procedures(name),dentist:profiles(full_name)"
const agendaWhatsQueueSelect =
  "id,status,kind,to_phone,message,appointment_id,created_at,appointment:appointments(id,start_time,status),patient:patients(id,name,whatsapp,phone)"

function BookingRequestsCard({
  bookingRequests,
  canManageBooking,
  onSendWhatsApp,
}: {
  bookingRequests: BookingRequestRow[]
  canManageBooking: boolean
  onSendWhatsApp: (r: BookingRequestRow, message: string) => void
}) {
  const rows = bookingRequests.filter((r) => r.status === "new").slice(0, 8)
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Solicitações de agendamento online</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!rows.length ? (
          <div className="text-sm text-muted-foreground">Nenhuma solicitação nova.</div>
        ) : (
          <div className="grid gap-2">
            {rows.map((r) => {
              const times = (r.preferred_times ?? []).slice(0, 3)
              const phone = r.patient_whatsapp ?? ""
              const msg = `Olá, ${r.patient_name}! Recebemos sua solicitação.\n\nHorários escolhidos:\n${times.map((t) => `• ${formatDateTime(t)}`).join("\n")}\n\nQual horário você prefere?`
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.patient_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.procedure?.name ? `${r.procedure.name} • ` : ""}
                      {r.dentist?.full_name ? `${r.dentist.full_name} • ` : ""}
                      {times.length ? `Horários escolhidos: ${times.map((t) => formatDateTime(t)).join(" • ")}` : "Sem horários"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {phone ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1 px-2 text-[11px]"
                        variant="outline"
                        onClick={() => onSendWhatsApp(r, msg)}
                        disabled={!canManageBooking}
                      >
                        WhatsApp
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function WhatsAppQueueCard({
  rows,
  sendingWhatsId,
  onSend,
}: {
  rows: WhatsAppQueueRow[]
  sendingWhatsId: string
  onSend: (row: WhatsAppQueueRow) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Confirmações WhatsApp pendentes</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!rows.length ? (
          <div className="text-sm text-muted-foreground">Nenhuma confirmação pendente.</div>
        ) : (
          <div className="grid gap-2">
            {rows.slice(0, 8).map((m) => {
              const phone = (m.to_phone || m.patient?.whatsapp || m.patient?.phone || "").trim()
              const start = m.appointment?.start_time ? formatDateTime(m.appointment.start_time) : null
              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{m.patient?.name ?? (phone || "Paciente")}</div>
                    <div className="text-xs text-muted-foreground">{start ? start : "—"}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => onSend(m)} disabled={!phone || Boolean(sendingWhatsId)}>
                      {sendingWhatsId === m.id ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function useAgendaWeek(weekOffset: number) {
  const slots = React.useMemo(() => buildSlots(), [])
  const weekStart = React.useMemo(() => {
    const base = addDays(new Date(), weekOffset * 7)
    return startOfWeek(base, { weekStartsOn: 1 })
  }, [weekOffset])
  const weekEnd = React.useMemo(() => addDays(weekStart, 7), [weekStart])
  const days = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  return { slots, weekStart, weekEnd, days }
}

function useAgendaData({
  clinicId,
  weekStart,
  weekEnd,
  canManageBooking,
  dentistId,
  setDentistId,
}: {
  clinicId: string
  weekStart: Date
  weekEnd: Date
  canManageBooking: boolean
  dentistId: string
  setDentistId: React.Dispatch<React.SetStateAction<string>>
}) {
  const [loading, setLoading] = React.useState(true)
  const [dentists, setDentists] = React.useState<Profile[]>([])
  const [appointments, setAppointments] = React.useState<AppointmentRow[]>([])
  const [blocks, setBlocks] = React.useState<ScheduleBlock[]>([])
  const [bookingRequests, setBookingRequests] = React.useState<BookingRequestRow[]>([])
  const [whatsQueue, setWhatsQueue] = React.useState<WhatsAppQueueRow[]>([])
  const [whatsTemplate, setWhatsTemplate] = React.useState("")

  React.useEffect(() => {
    let mounted = true
    async function loadClinicTemplate() {
      if (!clinicId) return
      const { data } = await supabase.from("clinics").select("whatsapp_confirmation_template").eq("id", clinicId).maybeSingle()
      if (!mounted) return
      setWhatsTemplate(String(data?.whatsapp_confirmation_template ?? ""))
    }
    void loadClinicTemplate().catch(() => undefined)
    return () => {
      mounted = false
    }
  }, [clinicId])

  React.useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      const whatsPromise = canManageBooking
        ? supabase
            .from("whatsapp_messages")
            .select(agendaWhatsQueueSelect)
            .eq("status", "queued")
            .eq("kind", "confirm")
            .order("created_at", { ascending: true })
            .limit(12)
        : Promise.resolve({ data: [] as unknown[], error: null })

      const [dentistsRes, apptRes, blocksRes, bookingRes, whatsRes] = await Promise.all([
        supabase.from("profiles").select("id,full_name,color").in("role", ["admin", "dentist"]).eq("active", true).order("full_name", { ascending: true }),
        supabase
          .from("appointments")
          .select(agendaAppointmentSelect)
          .gte("start_time", weekStart.toISOString())
          .lt("start_time", weekEnd.toISOString())
          .order("start_time", { ascending: true }),
        supabase
          .from("schedule_blocks")
          .select(agendaScheduleBlockSelect)
          .lt("start_time", weekEnd.toISOString())
          .gt("end_time", weekStart.toISOString())
          .order("start_time", { ascending: true }),
        supabase
          .from("booking_requests")
          .select(agendaBookingRequestSelect)
          .order("created_at", { ascending: false })
          .limit(12),
        whatsPromise,
      ])

      if (!mounted) return
      setDentists((dentistsRes.data ?? []) as Profile[])
      setAppointments((apptRes.data ?? []) as AppointmentRow[])
      setBlocks((blocksRes.data ?? []) as ScheduleBlock[])
      setBookingRequests((bookingRes.data ?? []) as BookingRequestRow[])
      setWhatsQueue((whatsRes.data ?? []) as WhatsAppQueueRow[])
      setLoading(false)
    }
    load().catch(() => setLoading(false))
    return () => {
      mounted = false
    }
  }, [canManageBooking, weekEnd, weekStart])

  React.useEffect(() => {
    if (!dentistId && dentists.length) setDentistId(dentists[0].id)
  }, [dentistId, dentists, setDentistId])

  return {
    loading,
    dentists,
    appointments,
    blocks,
    bookingRequests,
    whatsQueue,
    whatsTemplate,
    setAppointments,
    setBlocks,
    setBookingRequests,
    setWhatsQueue,
    setWhatsTemplate,
  }
}

function AgendaToolbar({
  weekOffset,
  onWeekOffsetChange,
  dentists,
  dentistId,
  onDentistIdChange,
  onlyOnline,
  onOnlyOnlineChange,
}: {
  weekOffset: number
  onWeekOffsetChange: (next: number) => void
  dentists: Profile[]
  dentistId: string
  onDentistIdChange: (id: string) => void
  onlyOnline: boolean
  onOnlyOnlineChange: (next: boolean) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => onWeekOffsetChange(weekOffset - 1)}>
          Semana anterior
        </Button>
        <Button variant="outline" onClick={() => onWeekOffsetChange(0)}>
          Hoje
        </Button>
        <Button variant="outline" onClick={() => onWeekOffsetChange(weekOffset + 1)}>
          Próxima semana
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="dentist">Dentista</Label>
          <select
            id="dentist"
            value={dentistId}
            onChange={(e) => onDentistIdChange(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {dentists.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name ?? d.id}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <div className="text-sm">Somente online</div>
          <Switch checked={onlyOnline} onCheckedChange={(v) => onOnlyOnlineChange(v)} />
        </div>
      </div>
    </div>
  )
}

function WeeklyAgendaCard({
  days,
  slots,
  apptBySlot,
  blockBySlot,
  canManageBlocks,
  onSelectAppointment,
  onSelectBlock,
  onCreateAppointmentAt,
  onCreateBlockAt,
  onMoveAppointment,
}: {
  days: Date[]
  slots: Array<{ hour: number; minute: number; label: string }>
  apptBySlot: Map<string, AppointmentRow>
  blockBySlot: Map<string, ScheduleBlock>
  canManageBlocks: boolean
  onSelectAppointment: (appt: AppointmentRow) => void
  onSelectBlock: (block: ScheduleBlock) => void
  onCreateAppointmentAt: (at: { day: Date; hour: number; minute: number }) => void
  onCreateBlockAt: (at: { day: Date; hour: number; minute: number }) => void
  onMoveAppointment: (apptId: string, day: Date, hour: number, minute: number) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Agenda semanal</CardTitle>
      </CardHeader>
      <CardContent className="overflow-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[88px_repeat(7,1fr)] border-b">
            <div className="p-2 text-xs text-muted-foreground">Horário</div>
            {days.map((d) => (
              <div key={d.toISOString()} className="p-2 text-xs font-medium">
                {formatDayHeader(d)}
              </div>
            ))}
          </div>

          <div className="grid">
            {slots.map((s) => (
              <div key={s.label} className="grid grid-cols-[88px_repeat(7,1fr)] border-b last:border-b-0">
                <div className="p-2 text-xs text-muted-foreground">{s.label}</div>
                {days.map((day) => {
                  const iso = isoForDaySlot(day, s.hour, s.minute)
                  const key = slotKey(iso)
                  const appt = apptBySlot.get(key)
                  const block = blockBySlot.get(key)
                  return (
                    <div
                      key={day.toISOString()}
                      className="relative h-12 border-l p-1"
                      onDoubleClick={(e) => {
                        if (block) {
                          onSelectBlock(block)
                          return
                        }
                        if (e.shiftKey && canManageBlocks) {
                          onCreateBlockAt({ day, hour: s.hour, minute: s.minute })
                          return
                        }
                        onCreateAppointmentAt({ day, hour: s.hour, minute: s.minute })
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const apptId = e.dataTransfer.getData("text/appointment-id")
                        if (apptId) onMoveAppointment(apptId, day, s.hour, s.minute)
                      }}
                    >
                      {appt ? (
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/appointment-id", appt.id)}
                          onClick={() => onSelectAppointment(appt)}
                          className={`group flex h-full w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-md border px-2 text-left text-xs transition-colors hover:bg-secondary ${statusMeta[appt.status].color}`}
                          style={{ borderLeftColor: appt.dentist?.color ?? "hsl(var(--primary))", borderLeftWidth: 4 }}
                        >
                          <span className={`min-w-0 flex-1 truncate ${appt.status === "completed" ? "line-through opacity-70" : ""}`}>
                            {appt.patient?.name ?? "Paciente"}
                          </span>
                          <span className="shrink-0 flex items-center gap-2 whitespace-nowrap opacity-70">
                            {(appt.created_via ?? "internal") === "online" ? (
                              <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium leading-none text-white opacity-100">Online</span>
                            ) : null}
                            <span>{format(new Date(appt.start_time), "HH:mm")}</span>
                          </span>
                        </button>
                      ) : block ? (
                        <button
                          type="button"
                          onClick={() => onSelectBlock(block)}
                          className="flex h-full w-full items-center justify-between gap-2 rounded-md border bg-secondary/40 px-2 text-left text-xs text-muted-foreground hover:bg-secondary"
                        >
                          <span className="min-w-0 flex-1 truncate">{block.title || "Bloqueado"}</span>
                          <span className="shrink-0 whitespace-nowrap opacity-70">Bloq.</span>
                        </button>
                      ) : (
                        <div className="h-full w-full rounded-md" />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="mt-3 text-xs text-muted-foreground">Dica: duplo clique em um horário vazio para criar. Shift + duplo clique para bloquear. Arraste uma consulta para reagendar.</div>
        </div>
      </CardContent>
    </Card>
  )
}

function AppointmentDetailDialog({
  open,
  appointment,
  canSendWhatsApp,
  canDelete,
  updatingStatus,
  deleting,
  onClose,
  onWhatsApp,
  onUpdateStatus,
  onRequestDelete,
}: {
  open: boolean
  appointment: AppointmentRow | null
  canSendWhatsApp: boolean
  canDelete: boolean
  updatingStatus: boolean
  deleting: boolean
  onClose: () => void
  onWhatsApp: (appt: AppointmentRow) => Promise<void>
  onUpdateStatus: (appt: AppointmentRow, status: Appointment["status"]) => void
  onRequestDelete: (appt: AppointmentRow) => void
}) {
  const { profile, planTier } = useAuth()
  const canFinance = planAllows(planTier, "financeiro") && canAccess(profile?.role, "financeiro")
  const [hasCharge, setHasCharge] = React.useState(false)

  React.useEffect(() => {
    let mounted = true
    async function loadCharge() {
      if (!open || !appointment?.id || !canFinance) {
        if (mounted) setHasCharge(false)
        return
      }
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("id,type,status")
        .eq("appointment_id", appointment.id)
        .limit(5)
      if (!mounted) return
      if (error) {
        setHasCharge(false)
        return
      }
      const rows = (data ?? []) as Array<{ type?: unknown; status?: unknown }>
      setHasCharge(rows.some((r) => String(r.type ?? "") === "income" && String(r.status ?? "") !== "cancelled"))
    }
    void loadCharge().catch(() => {
      if (mounted) setHasCharge(false)
    })
    return () => {
      mounted = false
    }
  }, [appointment?.id, canFinance, open])

  const lockStatus = Boolean(hasCharge && appointment?.status === "completed")

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalhes da consulta</DialogTitle>
          <DialogDescription>{appointment ? `${appointment.patient?.name ?? "Paciente"} • ${formatDateTime(appointment.start_time)}` : null}</DialogDescription>
        </DialogHeader>
        {appointment ? (
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Status</div>
              {statusMeta[appointment.status].badge}
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Procedimento</span>
                <span>{appointment.procedure?.name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sala</span>
                <span>{appointment.room ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Origem</span>
                <span>{(appointment.created_via ?? "internal") === "online" ? "Online" : "Interno"}</span>
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter className="flex flex-nowrap justify-end gap-2 overflow-x-auto">
          {canSendWhatsApp && (appointment?.patient?.whatsapp || appointment?.patient?.phone) ? (
            <Button size="sm" className="h-8 shrink-0 px-2 text-[11px]" variant="outline" onClick={() => appointment && void onWhatsApp(appointment)}>
              WhatsApp
            </Button>
          ) : null}
          <Button
            size="sm"
            className="h-8 shrink-0 px-2 text-[11px]"
            variant={appointment?.status === "confirmed" ? "destructive" : "outline"}
            onClick={() => appointment && onUpdateStatus(appointment, appointment.status === "confirmed" ? "cancelled" : "confirmed")}
            disabled={updatingStatus || lockStatus}
          >
            {appointment?.status === "confirmed" ? "Cancelar" : "Confirmar"}
          </Button>
          <Button
            size="sm"
            className="h-8 shrink-0 px-2 text-[11px]"
            variant="outline"
            onClick={() => appointment && onUpdateStatus(appointment, "completed")}
            disabled={updatingStatus || lockStatus || appointment?.status === "completed"}
          >
            Realizada
          </Button>
          {canDelete ? (
            <Button
              size="sm"
              className="h-8 shrink-0 px-2 text-[11px]"
              variant="outline"
              onClick={() => appointment && onRequestDelete(appointment)}
              disabled={deleting || updatingStatus}
            >
              Excluir
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteAppointmentDialog({
  open,
  target,
  deleting,
  onCancel,
  onConfirm,
}: {
  open: boolean
  target: AppointmentRow | null
  deleting: boolean
  onCancel: () => void
  onConfirm: (target: AppointmentRow) => Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir agendamento</DialogTitle>
          <DialogDescription>
            {target ? `Você tem certeza que deseja excluir o agendamento de ${target.patient?.name ?? "Paciente"} em ${formatDateTime(target.start_time)}?` : "Você tem certeza que deseja excluir este agendamento?"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={deleting}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={() => target && void onConfirm(target)} disabled={deleting || !target}>
            {deleting ? "Excluindo..." : "Confirmar exclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const statusMeta: Record<
  Appointment["status"],
  { label: string; badge: React.ReactNode; color: string; whatsappLabel: string }
> = {
  scheduled: { label: "Agendada", badge: <Badge variant="default">Agendada</Badge>, color: "bg-primary/10", whatsappLabel: "Confirmar" },
  confirmed: { label: "Confirmada", badge: <Badge variant="success">Confirmada</Badge>, color: "bg-success/10", whatsappLabel: "Confirmada" },
  completed: { label: "Realizada", badge: <Badge className="border-transparent bg-blue-600 text-white">Realizada</Badge>, color: "bg-blue-500/10", whatsappLabel: "Realizada" },
  cancelled: { label: "Cancelada", badge: <Badge variant="destructive">Cancelada</Badge>, color: "bg-destructive/10", whatsappLabel: "Cancelada" },
  no_show: { label: "Faltou", badge: <Badge variant="destructive">Faltou</Badge>, color: "bg-destructive/10", whatsappLabel: "Faltou" },
}

function buildSlots() {
  const slots: { hour: number; minute: number; label: string }[] = []
  for (let h = 8; h < 18; h++) {
    slots.push({ hour: h, minute: 0, label: `${String(h).padStart(2, "0")}:00` })
    slots.push({ hour: h, minute: 30, label: `${String(h).padStart(2, "0")}:30` })
  }
  return slots
}

function isoForDaySlot(day: Date, hour: number, minute: number) {
  const d = new Date(day)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function slotKey(iso: string) {
  return iso.slice(0, 16)
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return bStart.getTime() < aEnd.getTime() && bEnd.getTime() > aStart.getTime()
}

function formatDayHeader(d: Date) {
  return format(d, "EEE dd/MM", { locale: ptBR }).replace(".", "")
}

function whatsappLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "")
  const br = digits.startsWith("55") ? digits : `55${digits}`
  return `https://wa.me/${br}?text=${encodeURIComponent(message)}`
}

function fillTemplate(template: string, vars: Record<string, string>) {
  let out = template
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v)
  }
  return out
}

function publicBaseUrl() {
  const env = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ?? ""
  const raw = (env || window.location.origin).trim()
  return raw.endsWith("/") ? raw.slice(0, -1) : raw
}

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

export function Agenda() {
  const { profile, planTier } = useAuth()
  const canSendWhatsApp = profile?.role === "admin" || profile?.role === "receptionist" || profile?.role === "dentist"
  const canManageBlocks = profile?.role === "admin" || profile?.role === "receptionist" || profile?.role === "dentist"
  const canManageGlobalBlocks = profile?.role === "admin" || profile?.role === "receptionist"
  const canManageBooking = profile?.role === "admin" || profile?.role === "receptionist"
  const canFinance = planAllows(planTier, "financeiro") && canAccess(profile?.role, "financeiro")
  const [weekOffset, setWeekOffset] = React.useState(0)
  const [dentistId, setDentistId] = React.useState<string>("")
  const [onlyOnline, setOnlyOnline] = React.useState(false)
  const [sendingWhatsId, setSendingWhatsId] = React.useState<string>("")
  const [selectedBlock, setSelectedBlock] = React.useState<ScheduleBlock | null>(null)
  const [selected, setSelected] = React.useState<AppointmentRow | null>(null)
  const [chargeOpen, setChargeOpen] = React.useState(false)
  const [chargeAppointment, setChargeAppointment] = React.useState<AppointmentRow | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<AppointmentRow | null>(null)
  const [creatingAt, setCreatingAt] = React.useState<{ day: Date; hour: number; minute: number } | null>(null)
  const [creatingBlockAt, setCreatingBlockAt] = React.useState<{ day: Date; hour: number; minute: number } | null>(null)
  const [updatingStatus, setUpdatingStatus] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const { slots, weekStart, weekEnd, days } = useAgendaWeek(weekOffset)

  const { loading, dentists, appointments, blocks, bookingRequests, whatsQueue, whatsTemplate, setAppointments, setBlocks, setBookingRequests, setWhatsQueue } = useAgendaData({
    clinicId: profile?.clinic_id ?? "",
    weekStart,
    weekEnd,
    canManageBooking,
    dentistId,
    setDentistId,
  })

  const filteredAppointments = React.useMemo(() => {
    let list = appointments
    if (dentistId) list = list.filter((a) => a.dentist_id === dentistId)
    if (onlyOnline) list = list.filter((a) => (a.created_via ?? "internal") === "online")
    return list
  }, [appointments, dentistId, onlyOnline])

  const filteredBlocks = React.useMemo(() => {
    if (!dentistId) return blocks
    return blocks.filter((b) => !b.dentist_id || b.dentist_id === dentistId)
  }, [blocks, dentistId])

  const apptBySlot = React.useMemo(() => {
    const map = new Map<string, AppointmentRow>()
    for (const a of filteredAppointments) {
      map.set(slotKey(new Date(a.start_time).toISOString()), a)
    }
    return map
  }, [filteredAppointments])

  const blockBySlot = React.useMemo(() => {
    const map = new Map<string, ScheduleBlock>()
    for (const b of filteredBlocks) {
      const start = new Date(b.start_time)
      const end = new Date(b.end_time)
      for (const day of days) {
        for (const s of slots) {
          const iso = isoForDaySlot(day, s.hour, s.minute)
          const d = new Date(iso)
          if (d.getTime() >= start.getTime() && d.getTime() < end.getTime()) {
            map.set(slotKey(iso), b)
          }
        }
      }
    }
    return map
  }, [filteredBlocks, days, slots])

  async function updateStatus(appt: AppointmentRow, status: Appointment["status"]) {
    if (updatingStatus) return
    setUpdatingStatus(true)
    try {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", appt.id)
      if (error) throw error
      setAppointments((prev) => prev.map((p) => (p.id === appt.id ? { ...p, status } : p)))
      toast.success("Status atualizado.")
      setSelected((s) => (s ? { ...s, status } : s))
      if (status === "completed" && canFinance && appt.patient_id) {
        setChargeAppointment({ ...appt, status })
        setChargeOpen(true)
      }
    } catch (e) {
      toast.error(`Não foi possível atualizar o status. (${getErrorMessage(e)})`)
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function deleteAppointment(appt: AppointmentRow) {
    if (deleting) return
    if (profile?.role !== "admin") {
      toast.error("Apenas administradores podem excluir agendamentos.")
      return
    }
    if (appt.status === "completed") {
      toast.error("Não é permitido excluir uma consulta marcada como Realizada.")
      return
    }
    setDeleting(true)
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", appt.id)
      if (error) throw error
      setAppointments((prev) => prev.filter((p) => p.id !== appt.id))
      setSelected(null)
      toast.success("Agendamento excluído.")
    } catch (e) {
      toast.error(`Não foi possível excluir o agendamento. (${getErrorMessage(e)})`)
    } finally {
      setDeleting(false)
    }
  }

  async function updateBookingRequestStatus(req: BookingRequestRow, status: BookingRequest["status"]) {
    if (!canManageBooking) {
      toast.error("Sem permissão para alterar solicitações.")
      return
    }
    try {
      const { error } = await supabase.from("booking_requests").update({ status }).eq("id", req.id)
      if (error) throw error
      setBookingRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status } : r)))
      if (status === "contacted") toast.success("WhatsApp enviado. Solicitação removida da lista.")
      else if (status === "cancelled") toast.success("Solicitação cancelada.")
      else if (status === "scheduled") toast.success("Solicitação marcada como Agendada.")
      else toast.success("Solicitação atualizada.")
    } catch (e) {
      toast.error(`Não foi possível atualizar. (${getErrorMessage(e)})`)
    }
  }

  async function openWhatsAppForAppointment(appt: AppointmentRow) {
    if (!canSendWhatsApp) return
    const phone = appt.patient?.whatsapp ?? appt.patient?.phone ?? ""
    if (!phone) return
    const start = new Date(appt.start_time)
    const template = (whatsTemplate || "Olá, {nome}! Confirmamos sua consulta em {data} às {hora}.").trim()
    let message = fillTemplate(template, {
      nome: appt.patient?.name ?? "",
      data: format(start, "dd/MM", { locale: ptBR }),
      hora: format(start, "HH:mm", { locale: ptBR }),
    })
    try {
      const { data, error } = await supabase.rpc("create_rsvp_token", { p_appointment_id: appt.id, p_hours: 48 })
      if (!error && data) {
        const base = publicBaseUrl()
        const token = String(data)
        const confirmUrl = `${base}/rsvp?token=${encodeURIComponent(token)}&action=confirm`
        const cancelUrl = `${base}/rsvp?token=${encodeURIComponent(token)}&action=cancel`
        message = `${message}\n\n✅ Confirmar: ${confirmUrl}\n❌ Cancelar: ${cancelUrl}`
      }
    } catch (e) {
      void e
    }
    window.open(whatsappLink(phone, message), "_blank")
  }

  async function sendQueuedWhatsApp(row: WhatsAppQueueRow) {
    if (!canManageBooking) {
      toast.error("Sem permissão para enviar confirmações.")
      return
    }
    if (sendingWhatsId) return
    setSendingWhatsId(row.id)
    try {
      const phone = (row.to_phone || row.patient?.whatsapp || row.patient?.phone || "").trim()
      if (!phone) {
        toast.error("Paciente sem WhatsApp/telefone.")
        return
      }

      let message = String(row.message ?? "").trim()
      const apptId = row.appointment_id
      if (apptId) {
        try {
          const { data, error } = await supabase.rpc("create_rsvp_token", { p_appointment_id: apptId, p_hours: 48 })
          if (!error && data) {
            const base = publicBaseUrl()
            const token = String(data)
            const confirmUrl = `${base}/rsvp?token=${encodeURIComponent(token)}&action=confirm`
            const cancelUrl = `${base}/rsvp?token=${encodeURIComponent(token)}&action=cancel`
            message = `${message}\n\n✅ Confirmar: ${confirmUrl}\n❌ Cancelar: ${cancelUrl}`.trim()
          }
        } catch {
          message = message.trim()
        }
      }

      window.open(whatsappLink(phone, message), "_blank")

      const { error: updateError } = await supabase.from("whatsapp_messages").update({ status: "sent", message }).eq("id", row.id)
      if (updateError) throw updateError

      setWhatsQueue((prev) => prev.filter((m) => m.id !== row.id))
      toast.success("WhatsApp preparado para envio.")
    } catch (e) {
      const msg = getErrorMessage(e)
      toast.error(`Não foi possível enviar. (${msg})`)
      try {
        const { error: updateError } = await supabase.from("whatsapp_messages").update({ status: "failed", error: msg }).eq("id", row.id)
        if (!updateError) setWhatsQueue((prev) => prev.filter((m) => m.id !== row.id))
      } catch {
        setWhatsQueue((prev) => prev)
      }
    } finally {
      setSendingWhatsId("")
    }
  }

  function sendBookingRequestWhatsApp(r: BookingRequestRow, msg: string) {
    const phone = r.patient_whatsapp ?? ""
    if (!phone) return
    window.open(whatsappLink(phone, msg), "_blank")
    void updateBookingRequestStatus(r, "contacted")
  }

  function isBlocked(dentistIdToCheck: string, start: Date, end: Date) {
    for (const b of blocks) {
      if (b.dentist_id && b.dentist_id !== dentistIdToCheck) continue
      const bStart = new Date(b.start_time)
      const bEnd = new Date(b.end_time)
      if (overlaps(start, end, bStart, bEnd)) return b
    }
    return null
  }

  async function moveAppointment(apptId: string, day: Date, hour: number, minute: number) {
    const appt = appointments.find((a) => a.id === apptId)
    if (!appt) return
    const start = new Date(appt.start_time)
    const end = new Date(appt.end_time)
    const durationMs = Math.max(15 * 60 * 1000, end.getTime() - start.getTime())
    const newStart = new Date(day)
    newStart.setHours(hour, minute, 0, 0)
    const newEnd = new Date(newStart.getTime() + durationMs)

    const conflict = isBlocked(appt.dentist_id, newStart, newEnd)
    if (conflict) {
      toast.error(`Horário bloqueado. (${conflict.title})`)
      return
    }

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ start_time: newStart.toISOString(), end_time: newEnd.toISOString() })
        .eq("id", apptId)
      if (error) throw error
      setAppointments((prev) => prev.map((p) => (p.id === apptId ? { ...p, start_time: newStart.toISOString(), end_time: newEnd.toISOString() } : p)))
      toast.success("Consulta reagendada.")
    } catch (e) {
      toast.error(`Não foi possível reagendar. (${getErrorMessage(e)})`)
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )

  return (
    <div className="grid gap-4">
      <AgendaToolbar
        weekOffset={weekOffset}
        onWeekOffsetChange={setWeekOffset}
        dentists={dentists}
        dentistId={dentistId}
        onDentistIdChange={setDentistId}
        onlyOnline={onlyOnline}
        onOnlyOnlineChange={setOnlyOnline}
      />

      <BookingRequestsCard bookingRequests={bookingRequests} canManageBooking={canManageBooking} onSendWhatsApp={sendBookingRequestWhatsApp} />

      {canManageBooking ? (
        <WhatsAppQueueCard rows={whatsQueue} sendingWhatsId={sendingWhatsId} onSend={(m) => void sendQueuedWhatsApp(m)} />
      ) : null}

      <WeeklyAgendaCard
        days={days}
        slots={slots}
        apptBySlot={apptBySlot}
        blockBySlot={blockBySlot}
        canManageBlocks={canManageBlocks}
        onSelectAppointment={setSelected}
        onSelectBlock={setSelectedBlock}
        onCreateAppointmentAt={setCreatingAt}
        onCreateBlockAt={setCreatingBlockAt}
        onMoveAppointment={(id, day, h, m) => void moveAppointment(id, day, h, m)}
      />

      <AppointmentDetailDialog
        open={!!selected}
        appointment={selected}
        canSendWhatsApp={canSendWhatsApp}
        canDelete={profile?.role === "admin"}
        updatingStatus={updatingStatus}
        deleting={deleting}
        onClose={() => setSelected(null)}
        onWhatsApp={openWhatsAppForAppointment}
        onUpdateStatus={(appt, st) => void updateStatus(appt, st)}
        onRequestDelete={(appt) => {
          setDeleteTarget(appt)
          setConfirmDeleteOpen(true)
        }}
      />

      <DeleteAppointmentDialog
        open={confirmDeleteOpen}
        target={deleteTarget}
        deleting={deleting}
        onCancel={() => {
          setConfirmDeleteOpen(false)
          setDeleteTarget(null)
        }}
        onConfirm={async (t) => {
          await deleteAppointment(t)
          setConfirmDeleteOpen(false)
          setDeleteTarget(null)
        }}
      />

      <GenerateChargeDialog
        open={chargeOpen}
        appointment={chargeAppointment}
        onOpenChange={(open) => {
          setChargeOpen(open)
          if (!open) setChargeAppointment(null)
        }}
      />

      <CreateAppointmentDialog
        open={!!creatingAt}
        onOpenChange={(open) => !open && setCreatingAt(null)}
        defaultTime={creatingAt}
        dentists={dentists}
        dentistId={dentistId}
        blocks={blocks}
        onCreated={(appt) => setAppointments((prev) => [...prev, appt])}
      />

      <CreateBlockDialog
        open={!!creatingBlockAt}
        onOpenChange={(open) => !open && setCreatingBlockAt(null)}
        defaultTime={creatingBlockAt}
        dentists={dentists}
        dentistId={dentistId}
        canManageGlobal={canManageGlobalBlocks}
        currentUserId={profile?.id ?? ""}
        currentRole={profile?.role}
        onCreated={(b) => setBlocks((prev) => [...prev, b])}
      />

      <BlockDetailDialog
        open={!!selectedBlock}
        onOpenChange={(open) => !open && setSelectedBlock(null)}
        block={selectedBlock}
        canManage={canManageBlocks}
        onDeleted={(id) => setBlocks((prev) => prev.filter((b) => b.id !== id))}
      />
    </div>
  )
}

function GenerateChargeDialog({
  open,
  appointment,
  onOpenChange,
}: {
  open: boolean
  appointment: AppointmentRow | null
  onOpenChange: (open: boolean) => void
}) {
  const { profile, planTier } = useAuth()
  const canFinance = planAllows(planTier, "financeiro") && canAccess(profile?.role, "financeiro")
  const [saving, setSaving] = React.useState(false)
  const [amount, setAmount] = React.useState("")
  const [status, setStatus] = React.useState<"paid" | "pending">("paid")
  const [dueDate, setDueDate] = React.useState("")
  const [paidDate, setPaidDate] = React.useState("")

  React.useEffect(() => {
    if (!open || !appointment) return
    const today = new Date().toISOString().slice(0, 10)
    const base = appointment.procedure?.base_price
    setAmount(base != null && Number.isFinite(Number(base)) ? String(Number(base).toFixed(2)).replace(".", ",") : "")
    setStatus("paid")
    setDueDate(today)
    setPaidDate(today)
  }, [appointment, open])

  async function onSave() {
    if (!appointment?.id || !appointment.patient_id) return
    if (!canFinance) {
      toast.error("Sem permissão para lançar no financeiro.")
      return
    }
    const parsed = Number(String(amount).replace(",", "."))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Informe um valor válido.")
      return
    }
    const due = dueDate || new Date().toISOString().slice(0, 10)
    const paid = status === "paid" ? (paidDate || due) : null
    setSaving(true)
    try {
      const procName = appointment.procedure?.name ?? "Atendimento"
      const payload = {
        type: "income" as const,
        amount: parsed,
        status,
        due_date: due,
        paid_date: paid,
        patient_id: appointment.patient_id,
        appointment_id: appointment.id,
        category: "Atendimento",
        description: procName,
      }
      const { error } = await supabase.from("financial_transactions").insert(payload)
      if (error) {
        const code = String((error as { code?: unknown }).code ?? "")
        if (code === "23505") {
          toast.error("Já existe uma cobrança para este atendimento.")
          return
        }
        throw error
      }
      toast.success("Cobrança lançada.")
      onOpenChange(false)
    } catch (e) {
      toast.error(`Não foi possível lançar. (${getErrorMessage(e)})`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar cobrança</DialogTitle>
          <DialogDescription>{appointment?.patient?.name ?? "Paciente"}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Procedimento</Label>
            <Input readOnly value={appointment?.procedure?.name ?? "Sem procedimento"} />
          </div>
          <div className="grid gap-2">
            <Label>Valor (BRL)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex: 180,00" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "paid" | "pending")}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="paid">Pago</option>
                <option value="pending">Pendente</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Vencimento</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Pagamento</Label>
            <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} disabled={status !== "paid"} />
          </div>
        </div>
        <DialogFooter className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Pular
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={saving || !canFinance}>
            {saving ? "Salvando..." : "Lançar no financeiro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateAppointmentDialog({
  open,
  onOpenChange,
  defaultTime,
  dentists,
  dentistId,
  blocks,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTime: { day: Date; hour: number; minute: number } | null
  dentists: Profile[]
  dentistId: string
  blocks: ScheduleBlock[]
  onCreated: (appt: AppointmentRow) => void
}) {
  const [saving, setSaving] = React.useState(false)
  const [patientQuery, setPatientQuery] = React.useState("")
  const [patientOptions, setPatientOptions] = React.useState<Array<Pick<Patient, "id" | "name">>>([])
  const [patientId, setPatientId] = React.useState("")
  const [procedureOptions, setProcedureOptions] = React.useState<Array<Pick<Procedure, "id" | "name" | "duration_minutes">>>([])
  const [procedureId, setProcedureId] = React.useState("")
  const [room, setRoom] = React.useState("Sala 1")
  const [notes, setNotes] = React.useState("")
  const [selectedDentistId, setSelectedDentistId] = React.useState(dentistId)

  React.useEffect(() => setSelectedDentistId(dentistId), [dentistId, open])

  React.useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const { data } = await supabase
          .from("procedures")
          .select("id,name,duration_minutes")
          .eq("active", true)
          .order("name", { ascending: true })
        setProcedureOptions((data ?? []) as unknown as Array<Pick<Procedure, "id" | "name" | "duration_minutes">>)
      } catch {
        setProcedureOptions([])
      }
    })()
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const q = patientQuery.trim()
    const h = window.setTimeout(async () => {
      if (q.length < 2) {
        setPatientOptions([])
        return
      }
      const { data } = await supabase.from("patients").select("id,name").ilike("name", `%${q}%`).limit(8)
      setPatientOptions((data ?? []) as unknown as Array<Pick<Patient, "id" | "name">>)
    }, 250)
    return () => window.clearTimeout(h)
  }, [patientQuery, open])

  React.useEffect(() => {
    if (!open) {
      setPatientQuery("")
      setPatientOptions([])
      setPatientId("")
      setProcedureId("")
      setRoom("Sala 1")
      setNotes("")
    }
  }, [open])

  async function onSave() {
    if (!defaultTime) return
    if (!patientId) {
      toast.error("Selecione um paciente.")
      return
    }
    setSaving(true)
    try {
      const start = new Date(defaultTime.day)
      start.setHours(defaultTime.hour, defaultTime.minute, 0, 0)
      const proc = procedureOptions.find((p) => p.id === procedureId)
      const dur = proc?.duration_minutes ?? 30
      const end = new Date(start.getTime() + dur * 60 * 1000)

      for (const b of blocks) {
        if (b.dentist_id && b.dentist_id !== selectedDentistId) continue
        if (overlaps(start, end, new Date(b.start_time), new Date(b.end_time))) {
          toast.error(`Horário bloqueado. (${b.title})`)
          return
        }
      }

      const { data, error } = await supabase
        .from("appointments")
        .insert({
          patient_id: patientId,
          dentist_id: selectedDentistId,
          procedure_id: procedureId || null,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: "scheduled",
          notes: notes || null,
          room: room || null,
        })
        .select(agendaAppointmentSelect)
        .single()

      if (error) throw error
      toast.success("Agendamento criado.")
      onCreated(data as unknown as AppointmentRow)
      onOpenChange(false)
    } catch (e) {
      toast.error(`Não foi possível criar o agendamento. (${getErrorMessage(e)})`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>{defaultTime ? formatDateTime(isoForDaySlot(defaultTime.day, defaultTime.hour, defaultTime.minute)) : null}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Dentista</Label>
            <select
              value={selectedDentistId}
              onChange={(e) => setSelectedDentistId(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name ?? d.id}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Paciente</Label>
            <Input placeholder="Digite para buscar..." value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} />
            {patientOptions.length ? (
              <div className="grid gap-1 rounded-md border p-2">
                {patientOptions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`rounded px-2 py-1 text-left text-sm hover:bg-secondary ${patientId === p.id ? "bg-secondary" : ""}`}
                    onClick={() => {
                      setPatientId(p.id)
                      setPatientQuery(p.name)
                      setPatientOptions([])
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label>Procedimento</Label>
            <select
              value={procedureId}
              onChange={(e) => setProcedureId(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">(Sem procedimento)</option>
              {procedureOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Sala</Label>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Observações</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Salvando..." : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateBlockDialog({
  open,
  onOpenChange,
  defaultTime,
  dentists,
  dentistId,
  canManageGlobal,
  currentUserId,
  currentRole,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTime: { day: Date; hour: number; minute: number } | null
  dentists: Profile[]
  dentistId: string
  canManageGlobal: boolean
  currentUserId: string
  currentRole: Profile["role"] | null | undefined
  onCreated: (block: ScheduleBlock) => void
}) {
  const [saving, setSaving] = React.useState(false)
  const [title, setTitle] = React.useState("Bloqueio")
  const [durationMinutes, setDurationMinutes] = React.useState<number>(60)
  const [applyToAll, setApplyToAll] = React.useState(false)
  const [selectedDentistId, setSelectedDentistId] = React.useState(dentistId)

  React.useEffect(() => {
    if (!open) return
    setTitle("Bloqueio")
    setDurationMinutes(60)
    setApplyToAll(false)
    if (currentRole === "dentist") setSelectedDentistId(currentUserId)
    else setSelectedDentistId(dentistId)
  }, [open, dentistId, currentRole, currentUserId])

  async function onSave() {
    if (!defaultTime) return
    const safeDuration = Number.isFinite(durationMinutes) ? Math.max(15, Math.min(12 * 60, Math.trunc(durationMinutes))) : 60
    const start = new Date(defaultTime.day)
    start.setHours(defaultTime.hour, defaultTime.minute, 0, 0)
    const end = new Date(start.getTime() + safeDuration * 60 * 1000)

    setSaving(true)
    try {
      const payload = {
        dentist_id: applyToAll ? null : selectedDentistId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        title: (title || "Bloqueio").trim(),
      }
      const { data, error } = await supabase.from("schedule_blocks").insert(payload).select(agendaScheduleBlockSelect).single()
      if (error) throw error
      toast.success("Horário bloqueado.")
      onCreated(data as ScheduleBlock)
      onOpenChange(false)
    } catch (e) {
      toast.error(`Não foi possível bloquear o horário. (${getErrorMessage(e)})`)
    } finally {
      setSaving(false)
    }
  }

  const allowApplyToAll = canManageGlobal && currentRole !== "dentist"
  const allowDentistPick = canManageGlobal && currentRole !== "dentist" && !applyToAll

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bloquear horário</DialogTitle>
          <DialogDescription>
            {defaultTime ? formatDateTime(isoForDaySlot(defaultTime.day, defaultTime.hour, defaultTime.minute)) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Motivo</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Almoço, Reunião, Férias..." />
          </div>
          <div className="grid gap-2">
            <Label>Duração (min)</Label>
            <Input type="number" min={15} step={15} value={String(durationMinutes)} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
          </div>
          {allowApplyToAll ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Aplicar para todos</div>
                <div className="text-sm text-muted-foreground">Bloqueia o horário para todos os profissionais.</div>
              </div>
              <Switch checked={applyToAll} onCheckedChange={(v) => setApplyToAll(v)} />
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label>Profissional</Label>
            <select
              value={applyToAll ? "" : selectedDentistId}
              onChange={(e) => setSelectedDentistId(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              disabled={!allowDentistPick}
            >
              {applyToAll ? <option value="">Todos</option> : null}
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name ?? d.id}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Salvando..." : "Bloquear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BlockDetailDialog({
  open,
  onOpenChange,
  block,
  canManage,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  block: ScheduleBlock | null
  canManage: boolean
  onDeleted: (id: string) => void
}) {
  const [deleting, setDeleting] = React.useState(false)

  async function onDelete() {
    if (!block) return
    setDeleting(true)
    try {
      const { error } = await supabase.from("schedule_blocks").delete().eq("id", block.id)
      if (error) throw error
      toast.success("Bloqueio removido.")
      onDeleted(block.id)
      onOpenChange(false)
    } catch (e) {
      toast.error(`Não foi possível remover o bloqueio. (${getErrorMessage(e)})`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Horário bloqueado</DialogTitle>
          <DialogDescription>{block ? block.title : null}</DialogDescription>
        </DialogHeader>
        {block ? (
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Início</span>
              <span>{formatDateTime(block.start_time)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Fim</span>
              <span>{formatDateTime(block.end_time)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Aplicação</span>
              <span>{block.dentist_id ? "Somente este profissional" : "Todos os profissionais"}</span>
            </div>
          </div>
        ) : null}
        <DialogFooter className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Fechar
          </Button>
          {canManage ? (
            <Button variant="destructive" onClick={onDelete} disabled={deleting}>
              {deleting ? "Removendo..." : "Remover bloqueio"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
