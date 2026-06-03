import * as React from "react"
import { Link } from "react-router-dom"
import { Plus, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Patient } from "@/types/database"
import { canAccess, planAllows, useAuth } from "@/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PatientForm } from "@/components/patients/PatientForm"

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "P"
  const first = parts[0]?.[0] ?? "P"
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
  return (first + last).toUpperCase()
}

export function Patients() {
  const { profile, planTier } = useAuth()
  const canWrite = canAccess(profile?.role, "pacientes_write")
  const canReturns = planAllows(planTier, "retornos")
  const [loading, setLoading] = React.useState(true)
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<"ativos" | "inativos" | "retorno">("ativos")
  const [page, setPage] = React.useState(0)
  const [patients, setPatients] = React.useState<Patient[]>([])
  const [returnPendingIds, setReturnPendingIds] = React.useState<Set<string>>(new Set())
  const [openForm, setOpenForm] = React.useState(false)
  const [editing, setEditing] = React.useState<Patient | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [pRes, rRes] = await Promise.all([
        supabase
          .from("patients")
          .select("id,name,cpf,birth_date,phone,whatsapp,email,gender,blood_type,observations,active,address")
          .order("name", { ascending: true }),
        canReturns ? supabase.from("return_controls").select("patient_id").lte("next_return_date", today).limit(500) : Promise.resolve({ data: [] }),
      ])
      setPatients((pRes.data ?? []) as Patient[])
      setReturnPendingIds(new Set(((rRes.data ?? []) as Array<{ patient_id: string }>).map((r) => r.patient_id)))
    } finally {
      setLoading(false)
    }
  }, [canReturns])

  React.useEffect(() => {
    void load()
  }, [load])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return patients.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.cpf ?? "").toLowerCase().includes(q) ||
        (p.phone ?? "").toLowerCase().includes(q) ||
        (p.whatsapp ?? "").toLowerCase().includes(q)

      const matchesFilter =
        filter === "ativos"
          ? p.active
          : filter === "inativos"
            ? !p.active
            : filter === "retorno"
              ? returnPendingIds.has(p.id)
              : true

      return matchesQuery && matchesFilter
    })
  }, [patients, query, filter, returnPendingIds])

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageSafe = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(pageSafe * pageSize, pageSafe * pageSize + pageSize)

  React.useEffect(() => {
    setPage(0)
  }, [filter, query])

  React.useEffect(() => {
    if (page !== pageSafe) setPage(pageSafe)
  }, [page, pageSafe])

  React.useEffect(() => {
    if (filter === "retorno" && !canReturns) setFilter("ativos")
  }, [filter, canReturns])

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Pacientes</div>
          <div className="text-sm text-muted-foreground">Cadastro, busca e histórico clínico.</div>
        </div>
        {canWrite ? (
          <Button
            onClick={() => {
              setEditing(null)
              setOpenForm(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo paciente
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lista</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome, CPF, telefone..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as "ativos" | "inativos" | "retorno")}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ativos">Ativos</option>
                <option value="inativos">Inativos</option>
                {canReturns ? <option value="retorno">Retorno pendente</option> : null}
              </select>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">{filtered.length} resultado(s)</div>
          </div>

          {filtered.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead className="hidden md:table-cell">CPF</TableHead>
                  <TableHead className="hidden sm:table-cell">Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                          {initials(p.name)}
                        </div>
                        <div className="min-w-0">
                          <Link to={`/app/pacientes/${p.id}`} className="truncate font-medium hover:underline">
                            {p.name}
                          </Link>
                          {returnPendingIds.has(p.id) ? (
                            <div className="text-xs text-warning">Retorno vencido</div>
                          ) : (
                            <div className="text-xs text-muted-foreground">—</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">{p.cpf ?? "—"}</TableCell>
                    <TableCell className="hidden text-sm sm:table-cell">{p.whatsapp ?? p.phone ?? "—"}</TableCell>
                    <TableCell>{p.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                    <TableCell className="text-right">
                      {canWrite ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditing(p)
                            setOpenForm(true)
                          }}
                        >
                          Editar
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem permissão</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Nenhum paciente encontrado.</div>
          )}

          {filtered.length > pageSize ? (
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

      <Dialog
        open={openForm}
        onOpenChange={(open) => {
          if (!open) {
            setOpenForm(false)
            setEditing(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar paciente" : "Novo paciente"}</DialogTitle>
          </DialogHeader>
          <PatientForm
            patient={editing}
            onCancel={() => setOpenForm(false)}
            onSaved={(saved) => {
              setPatients((prev) => (prev.some((p) => p.id === saved.id) ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]))
              setOpenForm(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
