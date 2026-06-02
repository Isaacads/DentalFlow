import * as React from "react"
import { CalendarDays, CreditCard, User } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { canAccess, planAllows, useAuth } from "@/providers/AuthProvider"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import type { Appointment, FinancialTransaction, Patient } from "@/types/database"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

type PatientHit = Pick<Patient, "id" | "name" | "cpf" | "phone" | "whatsapp">
type AppointmentHit = Pick<Appointment, "id" | "start_time" | "status" | "patient_id"> & { patient?: { name: string } | null }
type TxHit = Pick<FinancialTransaction, "id" | "type" | "amount" | "due_date" | "status" | "patient_id"> & {
  patient?: { name: string } | null
}

function formatDateTime(iso: string) {
  return format(new Date(iso), "dd/MM 'às' HH:mm", { locale: ptBR })
}

function formatMoneyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function GlobalSearch({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (to: string) => void
}) {
  const { profile, planTier } = useAuth()
  const canFinance = canAccess(profile?.role, "financeiro") && planAllows(planTier, "financeiro")
  const [query, setQuery] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [patients, setPatients] = React.useState<PatientHit[]>([])
  const [appointments, setAppointments] = React.useState<AppointmentHit[]>([])
  const [transactions, setTransactions] = React.useState<TxHit[]>([])

  React.useEffect(() => {
    if (!open) {
      setQuery("")
      setPatients([])
      setAppointments([])
      setTransactions([])
    }
  }, [open])

  React.useEffect(() => {
    const q = query.trim()
    if (!open) return

    const handle = window.setTimeout(async () => {
      if (q.length < 2) {
        setPatients([])
        setAppointments([])
        setTransactions([])
        return
      }
      setLoading(true)
      try {
        const patientPromise = supabase
          .from("patients")
          .select("id,name,cpf,phone,whatsapp")
          .or(`name.ilike.%${q}%,cpf.ilike.%${q}%,phone.ilike.%${q}%,whatsapp.ilike.%${q}%`)
          .limit(8)

        const appointmentPromise = supabase
          .from("appointments")
          .select("id,start_time,status,patient_id,patient:patients(name)")
          .gte("start_time", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order("start_time", { ascending: true })
          .limit(8)

        const txPromise = canFinance
          ? supabase
              .from("financial_transactions")
              .select("id,type,amount,due_date,status,patient_id,patient:patients(name)")
              .or(`description.ilike.%${q}%,category.ilike.%${q}%`)
              .order("due_date", { ascending: true, nullsFirst: false })
              .limit(8)
          : Promise.resolve({ data: [] })

        const [p, a, t] = await Promise.all([patientPromise, appointmentPromise, txPromise])

        setPatients(((p.data ?? []) as PatientHit[]).slice(0, 8))
        setAppointments(
          ((a.data ?? []) as unknown[]).slice(0, 8).map((row) => {
            const r = row as {
              id: string
              start_time: string
              status: Appointment["status"]
              patient_id: string
              patient?: { name: string } | Array<{ name: string }> | null
            }
            const patient = Array.isArray(r.patient) ? r.patient[0] ?? null : r.patient ?? null
            return { id: r.id, start_time: r.start_time, status: r.status, patient_id: r.patient_id, patient }
          }),
        )
        setTransactions(
          ((t.data ?? []) as unknown[]).slice(0, 8).map((row) => {
            const r = row as {
              id: string
              type: FinancialTransaction["type"]
              amount: number
              due_date: string | null
              status: FinancialTransaction["status"]
              patient_id: string | null
              patient?: { name: string } | Array<{ name: string }> | null
            }
            const patient = Array.isArray(r.patient) ? r.patient[0] ?? null : r.patient ?? null
            return { id: r.id, type: r.type, amount: r.amount, due_date: r.due_date, status: r.status, patient_id: r.patient_id, patient }
          }),
        )
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(handle)
  }, [open, query, canFinance])

  const hasResults = patients.length || appointments.length || transactions.length

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar paciente, consulta ou financeiro..." value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>{loading ? "Buscando..." : "Nenhum resultado encontrado."}</CommandEmpty>
        {hasResults ? (
          <>
            {patients.length ? (
              <CommandGroup heading="Pacientes">
                {patients.map((p) => (
                  <CommandItem key={p.id} onSelect={() => onNavigate(`/app/pacientes/${p.id}`)}>
                    <User className="mr-2 h-4 w-4" />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="ml-3 text-xs text-muted-foreground">{p.cpf ?? p.phone ?? p.whatsapp ?? ""}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            <CommandSeparator />
            {appointments.length ? (
              <CommandGroup heading="Consultas">
                {appointments.map((a) => (
                  <CommandItem key={a.id} onSelect={() => onNavigate(`/app/agenda?consulta=${a.id}`)}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    <span className="flex-1 truncate">{a.patient?.name ?? "Paciente"}</span>
                    <span className="ml-3 text-xs text-muted-foreground">{formatDateTime(a.start_time)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            <CommandSeparator />
            {transactions.length ? (
              <CommandGroup heading="Financeiro">
                {transactions.map((t) => (
                  <CommandItem key={t.id} onSelect={() => onNavigate(`/app/financeiro?tx=${t.id}`)}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span className="flex-1 truncate">{t.patient?.name ?? "Transação"}</span>
                    <span className="ml-3 text-xs text-muted-foreground">{formatMoneyBRL(Number(t.amount))}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
