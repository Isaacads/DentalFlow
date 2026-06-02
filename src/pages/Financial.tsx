import * as React from "react"
import { Download, FileText, Plus } from "lucide-react"
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useReactToPrint } from "react-to-print"
import { supabase } from "@/lib/supabase"
import { canAccess, useAuth } from "@/providers/AuthProvider"
import type { FinancialTransaction, Patient, TransactionStatus, TransactionType } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatMoneyBRL } from "@/lib/format"

type TxRow = FinancialTransaction & { patient?: Pick<Patient, "name"> | null }

const txSelect = "id,type,category,description,amount,due_date,paid_date,status,patient_id,created_at,patient:patients(name)"

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isIsoMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value)
}

function toYmd(d: Date) {
  return format(d, "yyyy-MM-dd", { locale: ptBR })
}

function rangeFromPreset(kind: "daily" | "weekly" | "monthly", baseYmd: string) {
  const base = isIsoDate(baseYmd) ? new Date(`${baseYmd}T00:00:00.000Z`) : new Date()
  if (kind === "daily") {
    const from = toYmd(base)
    const to = toYmd(base)
    return { from, to }
  }
  if (kind === "weekly") {
    const from = toYmd(startOfWeek(base, { weekStartsOn: 1 }))
    const to = toYmd(endOfWeek(base, { weekStartsOn: 1 }))
    return { from, to }
  }
  const from = toYmd(startOfMonth(base))
  const to = toYmd(endOfMonth(base))
  return { from, to }
}

function rangeFromPicker(kind: "daily" | "weekly" | "monthly", dayYmd: string, monthYm: string) {
  if (kind === "monthly") {
    const base = isIsoMonth(monthYm) ? new Date(`${monthYm}-01T00:00:00.000Z`) : new Date()
    const from = toYmd(startOfMonth(base))
    const to = toYmd(endOfMonth(base))
    return { from, to }
  }
  return rangeFromPreset(kind, dayYmd)
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function Financial() {
  const { profile } = useAuth()
  const canUse = canAccess(profile?.role, "financeiro")
  const navigate = useNavigate()
  const [loading, setLoading] = React.useState(true)
  const [tx, setTx] = React.useState<TxRow[]>([])
  const [status, setStatus] = React.useState<TransactionStatus | "all">("all")
  const [type, setType] = React.useState<TransactionType | "all">("all")
  const [page, setPage] = React.useState(0)
  const [openForm, setOpenForm] = React.useState(false)
  const [editingTx, setEditingTx] = React.useState<TxRow | null>(null)
  const [openReport, setOpenReport] = React.useState(false)
  const [reportKind, setReportKind] = React.useState<"daily" | "weekly" | "monthly">("monthly")
  const [reportDay, setReportDay] = React.useState(() => new Date().toISOString().slice(0, 10))
  const [reportMonth, setReportMonth] = React.useState(() => new Date().toISOString().slice(0, 7))

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase.from("financial_transactions").select(txSelect).order("created_at", { ascending: false })
      if (status !== "all") q = q.eq("status", status)
      if (type !== "all") q = q.eq("type", type)
      const { data } = await q.limit(200)
      setTx((data ?? []) as TxRow[])
    } finally {
      setLoading(false)
    }
  }, [status, type])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    setPage(0)
  }, [status, type])

  React.useEffect(() => {
    if (!profile?.clinic_id) return
    const canRealtime = typeof (supabase as unknown as { channel?: unknown }).channel === "function"
    if (!canRealtime) return

    type RealtimeChannelLike = {
      on: (type: string, filter: Record<string, unknown>, cb: () => void) => RealtimeChannelLike
      subscribe: () => RealtimeChannelLike
      unsubscribe: () => void
    }

    const channel = (supabase as unknown as { channel: (name: string) => RealtimeChannelLike })
      .channel(`financial_transactions:${profile.clinic_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_transactions", filter: `clinic_id=eq.${profile.clinic_id}` },
        () => void load(),
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [profile?.clinic_id, load])

  const summary = React.useMemo(() => {
    const income = tx.filter((t) => t.type === "income").reduce((acc, t) => acc + Number(t.amount), 0)
    const expense = tx.filter((t) => t.type === "expense").reduce((acc, t) => acc + Number(t.amount), 0)
    return { income, expense, balance: income - expense }
  }, [tx])

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(tx.length / pageSize))
  const pageSafe = Math.min(page, totalPages - 1)
  const pageItems = tx.slice(pageSafe * pageSize, pageSafe * pageSize + pageSize)

  React.useEffect(() => {
    if (page !== pageSafe) setPage(pageSafe)
  }, [page, pageSafe])

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )

  if (!canUse) return <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Sem permissão para acessar o financeiro.</div>

  async function updateTx(id: string, patch: Partial<FinancialTransaction>) {
    const { data, error } = await supabase.from("financial_transactions").update(patch).eq("id", id).select(txSelect).single()
    if (error) throw error
    setTx((prev) => prev.map((row) => (row.id === id ? (data as unknown as TxRow) : row)))
  }

  async function markAsPaid(row: TxRow) {
    const today = new Date().toISOString().slice(0, 10)
    await updateTx(row.id, {
      status: "paid",
      paid_date: today,
      due_date: row.due_date ?? today,
    })
  }

  async function cancelTx(row: TxRow) {
    await updateTx(row.id, { status: "cancelled", paid_date: null })
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Financeiro</div>
          <div className="text-sm text-muted-foreground">Receitas, despesas e controle de inadimplência.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const header = ["tipo", "paciente", "descricao", "categoria", "valor", "status", "vencimento", "pagamento"].join(";")
              const rows = tx
                .map((t) =>
                  [
                    t.type,
                    t.patient?.name ?? "",
                    t.description ?? "",
                    t.category ?? "",
                    Number(t.amount).toFixed(2).replace(".", ","),
                    t.status,
                    t.due_date ?? "",
                    t.paid_date ?? "",
                  ].join(";"),
                )
                .join("\n")
              downloadText("dentalflow-financeiro.csv", `${header}\n${rows}`)
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setOpenReport(true)
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            Relatório
          </Button>
          <Button
            onClick={() => {
              setEditingTx(null)
              setOpenForm(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo lançamento
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMoneyBRL(summary.income)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMoneyBRL(summary.expense)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMoneyBRL(summary.balance)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Movimentações</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType | "all")}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">Todos os tipos</option>
                <option value="income">Receitas</option>
                <option value="expense">Despesas</option>
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TransactionStatus | "all")}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">Todos os status</option>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="overdue">Vencido</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tx.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.type === "income" ? <Badge variant="success">Receita</Badge> : <Badge variant="secondary">Despesa</Badge>}</TableCell>
                    <TableCell className="text-sm">{t.patient?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{t.description ?? t.category ?? "—"}</TableCell>
                    <TableCell className="text-sm">{t.due_date ?? "—"}</TableCell>
                    <TableCell>
                      {t.status === "paid" ? (
                        <Badge variant="success">Pago</Badge>
                      ) : t.status === "overdue" ? (
                        <Badge variant="destructive">Vencido</Badge>
                      ) : t.status === "pending" ? (
                        <Badge variant="warning">Pendente</Badge>
                      ) : (
                        <Badge variant="secondary">Cancelado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatMoneyBRL(Number(t.amount))}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {t.status !== "paid" && t.status !== "cancelled" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-[11px]"
                            onClick={() =>
                              void (async () => {
                                try {
                                  await markAsPaid(t)
                                  toast.success("Marcado como pago.")
                                } catch (e) {
                                  toast.error(`Não foi possível marcar como pago. (${String((e as { message?: unknown }).message ?? "Erro")})`)
                                }
                              })()
                            }
                          >
                            Marcar pago
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-[11px]"
                          onClick={() => {
                            setEditingTx(t)
                            setOpenForm(true)
                          }}
                        >
                          Editar
                        </Button>
                        {t.status !== "cancelled" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-[11px]"
                            onClick={() =>
                              void (async () => {
                                if (!window.confirm("Cancelar este lançamento?")) return
                                try {
                                  await cancelTx(t)
                                  toast.success("Lançamento cancelado.")
                                } catch (e) {
                                  toast.error(`Não foi possível cancelar. (${String((e as { message?: unknown }).message ?? "Erro")})`)
                                }
                              })()
                            }
                          >
                            Cancelar
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Nenhuma movimentação encontrada.</div>
          )}

          {tx.length > pageSize ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
              <div className="text-xs text-muted-foreground">
                Página {pageSafe + 1} de {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={pageSafe === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pageSafe >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingTx ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          </DialogHeader>
          <TransactionForm
            tx={editingTx}
            onCancel={() => {
              setOpenForm(false)
              setEditingTx(null)
            }}
            onSaved={(saved) => {
              setTx((prev) => {
                const exists = prev.some((x) => x.id === saved.id)
                if (exists) return prev.map((x) => (x.id === saved.id ? saved : x))
                return [saved, ...prev]
              })
              setOpenForm(false)
              setEditingTx(null)
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openReport} onOpenChange={setOpenReport}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Relatório financeiro</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Período</Label>
              <select
                value={reportKind}
                onChange={(e) => setReportKind(e.target.value as "daily" | "weekly" | "monthly")}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>{reportKind === "monthly" ? "Mês de referência" : reportKind === "weekly" ? "Semana (escolha um dia)" : "Dia"}</Label>
              {reportKind === "monthly" ? (
                <Input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} />
              ) : (
                <Input type="date" value={reportDay} onChange={(e) => setReportDay(e.target.value)} />
              )}
              <div className="text-xs text-muted-foreground">
                {(() => {
                  const r = rangeFromPicker(reportKind, reportDay, reportMonth)
                  return `Período: ${r.from.split("-").reverse().join("/")} até ${r.to.split("-").reverse().join("/")}.`
                })()}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenReport(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  const r = rangeFromPicker(reportKind, reportDay, reportMonth)
                  setOpenReport(false)
                  navigate(`/app/financeiro/relatorio?kind=${encodeURIComponent(reportKind)}&from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`)
                }}
              >
                Gerar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function FinancialReportPage() {
  const { profile } = useAuth()
  const canUse = canAccess(profile?.role, "financeiro")
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const printableRef = React.useRef<HTMLDivElement>(null)

  const [loading, setLoading] = React.useState(true)
  const [clinicBrand, setClinicBrand] = React.useState<{ name: string; slogan: string; logo_url: string } | null>(null)
  const [rows, setRows] = React.useState<TxRow[]>([])

  const kind = (params.get("kind") ?? "monthly") as "daily" | "weekly" | "monthly"
  const fromYmd = (params.get("from") ?? "").trim()
  const toYmd = (params.get("to") ?? "").trim()
  const safeFrom = isIsoDate(fromYmd) ? fromYmd : toYmd && isIsoDate(toYmd) ? toYmd : new Date().toISOString().slice(0, 10)
  const safeTo = isIsoDate(toYmd) ? toYmd : safeFrom
  const safeKind: "daily" | "weekly" | "monthly" = kind === "daily" || kind === "weekly" || kind === "monthly" ? kind : "monthly"

  const onPrint = useReactToPrint({
    contentRef: printableRef,
    documentTitle: `Relatório Financeiro - ${clinicBrand?.name ?? "Clínica"} - ${safeFrom} a ${safeTo}`,
  })

  React.useEffect(() => {
    let mounted = true
    async function load() {
      if (!profile?.clinic_id) return
      setLoading(true)
      try {
        const fromIso = new Date(`${safeFrom}T00:00:00.000Z`).toISOString()
        const toExclusiveIso = addDays(new Date(`${safeTo}T00:00:00.000Z`), 1).toISOString()
        const [clinicRes, txRes] = await Promise.all([
          supabase.from("clinics").select("name,slogan,logo_url").eq("id", profile.clinic_id).maybeSingle(),
          canUse
            ? supabase.from("financial_transactions").select(txSelect).gte("created_at", fromIso).lt("created_at", toExclusiveIso).order("created_at", { ascending: true })
            : Promise.resolve({ data: [] as unknown[] }),
        ])
        if (!mounted) return
        const name = String(clinicRes.data?.name ?? "").trim()
        const slogan = String((clinicRes.data as unknown as { slogan?: unknown } | null)?.slogan ?? "").trim()
        const logoUrl = String(clinicRes.data?.logo_url ?? "").trim()
        setClinicBrand({ name, slogan, logo_url: logoUrl })
        setRows((txRes.data ?? []) as TxRow[])
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
  }, [canUse, profile?.clinic_id, safeFrom, safeTo])

  const totals = React.useMemo(() => {
    const income = rows.filter((r) => r.type === "income" && r.status !== "cancelled").reduce((acc, r) => acc + Number(r.amount), 0)
    const expense = rows.filter((r) => r.type === "expense" && r.status !== "cancelled").reduce((acc, r) => acc + Number(r.amount), 0)
    return { income, expense, balance: income - expense }
  }, [rows])

  const title =
    safeKind === "daily" ? "Relatório diário" : safeKind === "weekly" ? "Relatório semanal" : safeKind === "monthly" ? "Relatório mensal" : "Relatório"

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-1">
          <div className="text-xl font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground">
            Período: {safeFrom.split("-").reverse().join("/")} a {safeTo.split("-").reverse().join("/")}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/app/financeiro")}>
            Voltar
          </Button>
          <Button onClick={() => onPrint()}>
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
              <div>Emitido em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm text-muted-foreground">Receitas</div>
              <div className="mt-1 text-2xl font-semibold">{formatMoneyBRL(totals.income)}</div>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm text-muted-foreground">Despesas</div>
              <div className="mt-1 text-2xl font-semibold">{formatMoneyBRL(totals.expense)}</div>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm text-muted-foreground">Saldo</div>
              <div className="mt-1 text-2xl font-semibold">{formatMoneyBRL(totals.balance)}</div>
            </div>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{String(t.created_at ?? "").slice(0, 10).split("-").reverse().join("/")}</TableCell>
                    <TableCell>{t.type === "income" ? "Receita" : "Despesa"}</TableCell>
                    <TableCell className="text-sm">{t.patient?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{t.description ?? t.category ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {t.status === "paid" ? "Pago" : t.status === "overdue" ? "Vencido" : t.status === "pending" ? "Pendente" : "Cancelado"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatMoneyBRL(Number(t.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}

function TransactionForm({
  tx,
  onCancel,
  onSaved,
}: {
  tx: TxRow | null
  onCancel: () => void
  onSaved: (saved: TxRow) => void
}) {
  const [saving, setSaving] = React.useState(false)
  const [type, setType] = React.useState<TransactionType>("income")
  const [amount, setAmount] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [category, setCategory] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [paidDate, setPaidDate] = React.useState("")
  const [status, setStatus] = React.useState<TransactionStatus>("pending")
  const [patientQuery, setPatientQuery] = React.useState("")
  const [patientOptions, setPatientOptions] = React.useState<Array<Pick<Patient, "id" | "name">>>([])
  const [patientId, setPatientId] = React.useState<string | null>(null)

  function formatAmountMasked(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 13)
    const value = digits ? Number(digits) / 100 : 0
    return formatMoneyBRL(value)
  }

  function parseAmountMasked(masked: string) {
    const digits = masked.replace(/\D/g, "")
    if (!digits) return 0
    return Number(digits) / 100
  }

  React.useEffect(() => {
    if (!tx) {
      setType("income")
      setAmount(formatMoneyBRL(0))
      setDescription("")
      setCategory("")
      setDueDate("")
      setPaidDate("")
      setStatus("pending")
      setPatientQuery("")
      setPatientOptions([])
      setPatientId(null)
      return
    }
    setType(tx.type)
    setAmount(formatMoneyBRL(Number(tx.amount)))
    setDescription(tx.description ?? "")
    setCategory(tx.category ?? "")
    setDueDate(tx.due_date ?? "")
    setPaidDate(tx.paid_date ?? "")
    setStatus(tx.status)
    setPatientId(tx.patient_id ?? null)
    setPatientQuery(tx.patient?.name ?? "")
    setPatientOptions([])
  }, [tx])

  React.useEffect(() => {
    if (status !== "paid") return
    const today = new Date().toISOString().slice(0, 10)
    if (!paidDate) setPaidDate(today)
    if (!dueDate) setDueDate(today)
  }, [dueDate, paidDate, status])

  React.useEffect(() => {
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
  }, [patientQuery])

  async function onSubmit() {
    const parsed = parseAmountMasked(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Informe um valor válido.")
      return
    }
    setSaving(true)
    try {
      const paid = status === "paid"
      const paidIso = paid ? (paidDate || new Date().toISOString().slice(0, 10)) : null
      const payload = {
        type,
        amount: parsed,
        description: description || null,
        category: category || null,
        due_date: dueDate || null,
        paid_date: paidIso,
        status: status,
        patient_id: patientId,
      }
      const q = tx?.id
        ? supabase.from("financial_transactions").update(payload).eq("id", tx.id).select(txSelect).single()
        : supabase.from("financial_transactions").insert(payload).select(txSelect).single()
      const { data, error } = await q
      if (error) throw error
      toast.success("Lançamento salvo.")
      onSaved(data as unknown as TxRow)
    } catch {
      toast.error("Não foi possível salvar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Tipo</Label>
          <select value={type} onChange={(e) => setType(e.target.value as TransactionType)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="income">Receita</option>
            <option value="expense">Despesa</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <select value={status} onChange={(e) => setStatus(e.target.value as TransactionStatus)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="pending">Pendente</option>
            <option value="paid">Pago</option>
            <option value="overdue">Vencido</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Valor (BRL)</Label>
          <Input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(formatAmountMasked(e.target.value))}
            placeholder={formatMoneyBRL(0)}
          />
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

      <div className="grid gap-2">
        <Label>Paciente (opcional)</Label>
        <Input value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Buscar paciente..." />
        {patientOptions.length ? (
          <div className="grid gap-1 rounded-md border p-2">
            {patientOptions.map((p) => (
              <button
                key={p.id}
                type="button"
                className="rounded px-2 py-1 text-left text-sm hover:bg-secondary"
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
        <Label>Categoria</Label>
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Prevenção, Materiais..." />
      </div>
      <div className="grid gap-2">
        <Label>Descrição</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Profilaxia, Compra de materiais..." />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  )
}
