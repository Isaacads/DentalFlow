import * as React from "react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts"
import { supabase } from "@/lib/supabase"
import { planAllows, useAuth } from "@/providers/AuthProvider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { formatDateTime, formatMoneyBRL } from "@/lib/format"
import type { Appointment, FinancialTransaction, Patient, Procedure, ReturnControl } from "@/types/database"

type AppointmentRow = Appointment & {
  patient?: Pick<Patient, "name"> | null
  procedure?: Pick<Procedure, "name"> | null
}

type TxRow = FinancialTransaction & {
  patient?: Pick<Patient, "name"> | null
}

const apptSelect = "id,start_time,status,patient:patients(name),procedure:procedures(name)"
const txOverdueSelect = "id,amount,due_date,status,patient:patients(name)"
const returnSelect = "id,next_return_date,patient:patients(name)"

function startOfDayISO(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString()
}

function endOfDayISO(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x.toISOString()
}

function statusBadge(status: Appointment["status"]) {
  if (status === "confirmed") return <Badge variant="success">Confirmada</Badge>
  if (status === "completed") return <Badge variant="secondary">Realizada</Badge>
  if (status === "no_show") return <Badge variant="destructive">Faltou</Badge>
  if (status === "cancelled") return <Badge variant="warning">Cancelada</Badge>
  return <Badge variant="default">Agendada</Badge>
}

export function Dashboard() {
  const { planTier, paymentStatus } = useAuth()
  const canFinance = planAllows(planTier, "financeiro")
  const canReturns = planAllows(planTier, "retornos")
  const [loading, setLoading] = React.useState(true)
  const [patientCount, setPatientCount] = React.useState<number>(0)
  const [apptsToday, setApptsToday] = React.useState<AppointmentRow[]>([])
  const [apptsLast30, setApptsLast30] = React.useState<AppointmentRow[]>([])
  const [txOverdue, setTxOverdue] = React.useState<TxRow[]>([])
  const [returnOverdue, setReturnOverdue] = React.useState<(ReturnControl & { patient?: Pick<Patient, "name"> | null })[]>([])
  const [monthRevenue, setMonthRevenue] = React.useState<number>(0)
  const [todayPage, setTodayPage] = React.useState(0)

  React.useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      const now = new Date()
      const todayStart = startOfDayISO(now)
      const todayEnd = endOfDayISO(now)
      const d30 = new Date(now)
      d30.setDate(d30.getDate() - 30)
      const monthStart = new Date(now)
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const [patientsRes, apptTodayRes, appt30Res, txRes, returnRes, monthRevenueRes] = await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase
          .from("appointments")
          .select(apptSelect)
          .gte("start_time", todayStart)
          .lte("start_time", todayEnd)
          .order("start_time", { ascending: true }),
        supabase
          .from("appointments")
          .select(apptSelect)
          .gte("start_time", d30.toISOString())
          .order("start_time", { ascending: true }),
        canFinance
          ? supabase
              .from("financial_transactions")
              .select(txOverdueSelect)
              .eq("status", "overdue")
              .order("due_date", { ascending: true })
              .limit(10)
          : Promise.resolve({ data: [] }),
        canReturns
          ? supabase
              .from("return_controls")
              .select(returnSelect)
              .lte("next_return_date", new Date().toISOString().slice(0, 10))
              .order("next_return_date", { ascending: true })
              .limit(10)
          : Promise.resolve({ data: [] }),
        canFinance
          ? supabase
              .from("financial_transactions")
              .select("amount,type,status,paid_date")
              .eq("type", "income")
              .eq("status", "paid")
              .gte("paid_date", monthStart.toISOString().slice(0, 10))
          : Promise.resolve({ data: [] }),
      ])

      if (!mounted) return
      setPatientCount(patientsRes.count ?? 0)
      setApptsToday((apptTodayRes.data ?? []) as AppointmentRow[])
      setApptsLast30((appt30Res.data ?? []) as AppointmentRow[])
      setTxOverdue((txRes.data ?? []) as TxRow[])
      setReturnOverdue((returnRes.data ?? []) as (ReturnControl & { patient?: Pick<Patient, "name"> | null })[])
      setMonthRevenue(((monthRevenueRes.data ?? []) as Array<{ amount: number }>).reduce((acc, row) => acc + Number(row.amount), 0))
      setLoading(false)
    }
    load().catch(() => setLoading(false))
    return () => {
      mounted = false
    }
  }, [canFinance, canReturns])

  React.useEffect(() => {
    setTodayPage(0)
  }, [apptsToday.length])

  const weekStart = React.useMemo(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = (day === 0 ? 6 : day - 1)
    d.setDate(d.getDate() - diff)
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const apptsThisWeek = React.useMemo(() => apptsLast30.filter((a) => new Date(a.start_time) >= weekStart), [apptsLast30, weekStart])
  const noShowRate = React.useMemo(() => {
    const total = apptsLast30.length
    if (!total) return 0
    const noShow = apptsLast30.filter((a) => a.status === "no_show").length
    return Math.round((noShow / total) * 100)
  }, [apptsLast30])

  const apptByDay = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const a of apptsLast30) {
      const d = new Date(a.start_time)
      const key = d.toISOString().slice(0, 10)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date: date.slice(5).split("-").reverse().join("/"), count }))
  }, [apptsLast30])

  const proceduresPie = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const a of apptsLast30) {
      const name = a.procedure?.name ?? "Sem procedimento"
      map.set(name, (map.get(name) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }))
  }, [apptsLast30])

  const monthlyRevenueLabel = React.useMemo(() => {
    return formatMoneyBRL(monthRevenue)
  }, [monthRevenue])

  const apptsTodayPageSize = 5
  const apptsTodayTotalPages = React.useMemo(() => {
    return Math.max(1, Math.ceil(apptsToday.length / apptsTodayPageSize))
  }, [apptsToday.length])

  const apptsTodayPageItems = React.useMemo(() => {
    const start = todayPage * apptsTodayPageSize
    return apptsToday.slice(start, start + apptsTodayPageSize)
  }, [apptsToday, todayPage])

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )

  return (
    <div className="grid gap-6">
      {paymentStatus === "past_due" ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <div className="text-sm font-semibold">Não conseguimos processar sua última cobrança</div>
          <div className="mt-1 text-sm text-destructive/90">
            Identificamos uma falha no pagamento da sua assinatura. Seu acesso continua liberado, mas pedimos que regularize o
            pagamento para evitar interrupções. Verifique os dados do seu cartão ou tente novamente em alguns instantes.
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de pacientes</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{patientCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Consultas hoje</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{apptsToday.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Consultas na semana</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{apptsThisWeek.length}</CardContent>
        </Card>
        {canFinance ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receita do mês</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{monthlyRevenueLabel}</CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receita do mês</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Disponível no plano Gestão</CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de faltas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{noShowRate}%</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Consultas (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            {apptByDay.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={apptByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickMargin={8} />
                  <YAxis allowDecimals={false} />
                  <RTooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados no período.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por procedimento</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            {proceduresPie.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <RTooltip />
                  <Pie data={proceduresPie} dataKey="value" nameKey="name" outerRadius={110} innerRadius={60}>
                    {proceduresPie.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? "hsl(var(--primary))" : "hsl(var(--accent))"} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados no período.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Próximas consultas hoje</CardTitle>
          </CardHeader>
          <CardContent>
            {apptsToday.length ? (
              <div className="grid gap-3">
                {apptsTodayPageItems.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{a.patient?.name ?? "Paciente"}</div>
                      <div className="truncate text-xs text-muted-foreground">{formatDateTime(a.start_time)}</div>
                    </div>
                    <div className="shrink-0">{statusBadge(a.status)}</div>
                  </div>
                ))}
                {apptsTodayTotalPages > 1 ? (
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="text-xs text-muted-foreground">
                      Página {todayPage + 1} de {apptsTodayTotalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setTodayPage((p) => Math.max(0, p - 1))}
                        disabled={todayPage <= 0}
                      >
                        Anterior
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setTodayPage((p) => Math.min(apptsTodayTotalPages - 1, p + 1))}
                        disabled={todayPage >= apptsTodayTotalPages - 1}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Nenhuma consulta para hoje.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-sm font-medium">Pagamentos vencidos</div>
              {!canFinance ? (
                <div className="text-sm text-muted-foreground">Disponível no plano Gestão.</div>
              ) : txOverdue.length ? (
                <div className="grid gap-2">
                  {txOverdue.slice(0, 4).map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">{t.patient?.name ?? "—"}</div>
                        <div className="truncate text-[11px] text-muted-foreground">Venc.: {t.due_date ?? "—"}</div>
                      </div>
                      <div className="text-xs font-semibold">{formatMoneyBRL(Number(t.amount))}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Nenhum vencimento em aberto.</div>
              )}
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Retornos vencidos</div>
              {!canReturns ? (
                <div className="text-sm text-muted-foreground">Disponível no plano Clínica.</div>
              ) : returnOverdue.length ? (
                <div className="grid gap-2">
                  {returnOverdue.slice(0, 4).map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">{r.patient?.name ?? "Paciente"}</div>
                        <div className="truncate text-[11px] text-muted-foreground">Próx.: {r.next_return_date ?? "—"}</div>
                      </div>
                      <Badge variant="warning">Pendente</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Nenhum retorno vencido.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
