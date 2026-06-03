import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { canAccess, useAuth } from "@/providers/AuthProvider"
import type { Procedure } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatMoneyBRL } from "@/lib/format"

const procedureSelect = "id,name,category,duration_minutes,base_price,active"

const categories = [
  "Diagnóstico",
  "Prevenção",
  "Dentística",
  "Endodontia",
  "Periodontia",
  "Cirurgia",
  "Ortodontia",
  "Implantes",
  "Prótese",
  "Radiologia",
]

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

function digitsOnly(value: string) {
  return value.replace(/\D/g, "")
}

function formatMoneyBRLFromCents(cents: number) {
  const safe = Number.isFinite(cents) ? Math.max(0, Math.trunc(cents)) : 0
  return formatMoneyBRL(safe / 100)
}

function parseMoneyBRLMaskedToNumber(value: string) {
  const digits = digitsOnly(value)
  if (!digits) return null
  const cents = Number(digits)
  if (!Number.isFinite(cents)) return null
  return cents / 100
}

function parseOptionalInt(value: string) {
  const v = value.trim()
  if (!v) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

export function ProceduresPage() {
  const { profile } = useAuth()
  const canWrite = canAccess(profile?.role, "procedimentos_write")
  const [loading, setLoading] = React.useState(true)
  const [items, setItems] = React.useState<Procedure[]>([])
  const [page, setPage] = React.useState(0)
  const [openForm, setOpenForm] = React.useState(false)
  const [editing, setEditing] = React.useState<Procedure | null>(null)

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase.from("procedures").select(procedureSelect).order("name", { ascending: true })
      setItems((data ?? []) as Procedure[])
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    void load()
  }, [])

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const pageSafe = Math.min(page, totalPages - 1)
  const pageItems = items.slice(pageSafe * pageSize, pageSafe * pageSize + pageSize)

  React.useEffect(() => {
    if (page !== pageSafe) setPage(pageSafe)
  }, [page, pageSafe])

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
          <div className="text-xl font-semibold">Procedimentos</div>
          <div className="text-sm text-muted-foreground">CRUD de procedimentos e tratamentos.</div>
        </div>
        {canWrite ? (
          <Button
            onClick={() => {
              setEditing(null)
              setOpenForm(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo procedimento
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lista</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden sm:table-cell">Duração</TableHead>
                  <TableHead>Preço base</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="hidden md:table-cell">{p.category ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell">{p.duration_minutes ? `${p.duration_minutes} min` : "—"}</TableCell>
                    <TableCell>{p.base_price != null ? formatMoneyBRL(Number(p.base_price)) : "—"}</TableCell>
                    <TableCell>{p.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                    <TableCell className="text-right">
                      {canWrite ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const { data, error } = await supabase
                                  .from("procedures")
                                  .update({ active: !p.active })
                                  .eq("id", p.id)
                                  .select(procedureSelect)
                                  .single()
                                if (error) throw error
                                setItems((prev) => prev.map((x) => (x.id === p.id ? (data as Procedure) : x)))
                              } catch {
                                toast.error("Não foi possível alterar o status.")
                              }
                            }}
                          >
                            {p.active ? "Desativar" : "Ativar"}
                          </Button>
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
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem permissão</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Nenhum procedimento cadastrado.</div>
          )}

          {items.length > pageSize ? (
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar procedimento" : "Novo procedimento"}</DialogTitle>
          </DialogHeader>
          <ProcedureForm
            procedure={editing}
            canWrite={canWrite}
            onCancel={() => setOpenForm(false)}
            onSaved={(saved) => {
              setItems((prev) => (prev.some((p) => p.id === saved.id) ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))))
              setOpenForm(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProcedureForm({
  procedure,
  canWrite,
  onCancel,
  onSaved,
}: {
  procedure: Procedure | null
  canWrite: boolean
  onCancel: () => void
  onSaved: (saved: Procedure) => void
}) {
  const [saving, setSaving] = React.useState(false)
  const [name, setName] = React.useState(procedure?.name ?? "")
  const [category, setCategory] = React.useState(procedure?.category ?? "")
  const [duration, setDuration] = React.useState(procedure?.duration_minutes?.toString() ?? "")
  const [price, setPrice] = React.useState(procedure?.base_price != null ? formatMoneyBRL(Number(procedure.base_price)) : "")
  const [description, setDescription] = React.useState(procedure?.description ?? "")

  async function onSubmit() {
    if (!canWrite) {
      toast.error("Você não tem permissão para alterar procedimentos.")
      return
    }
    if (name.trim().length < 2) {
      toast.error("Informe o nome.")
      return
    }
    setSaving(true)
    try {
      const parsedBasePrice = parseMoneyBRLMaskedToNumber(price)
      const parsedDuration = parseOptionalInt(duration)
      if (parsedDuration != null && (parsedDuration < 5 || parsedDuration > 12 * 60)) {
        toast.error("Duração inválida. Use entre 5 e 720 minutos.")
        return
      }
      const payload = {
        name: name.trim(),
        category: category || null,
        duration_minutes: parsedDuration,
        base_price: parsedBasePrice,
        description: description || null,
      }
      if (procedure?.id) {
        const { data, error } = await supabase
          .from("procedures")
          .update(payload)
          .eq("id", procedure.id)
          .select("id,name,category,duration_minutes,base_price,active,description,created_at,updated_at")
          .single()
        if (error) throw error
        toast.success("Procedimento atualizado.")
        onSaved(data as Procedure)
      } else {
        const { data, error } = await supabase
          .from("procedures")
          .insert(payload)
          .select("id,name,category,duration_minutes,base_price,active,description,created_at,updated_at")
          .single()
        if (error) throw error
        toast.success("Procedimento criado.")
        onSaved(data as Procedure)
      }
    } catch (e) {
      toast.error(`Não foi possível salvar. (${getErrorMessage(e)})`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Nome</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Categoria</Label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">(Sem categoria)</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label>Duração (min)</Label>
          <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Ex: 60" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Preço base (BRL)</Label>
          <Input
            value={price}
            inputMode="numeric"
            onChange={(e) => {
              const digits = digitsOnly(e.target.value)
              if (!digits) {
                setPrice("")
                return
              }
              setPrice(formatMoneyBRLFromCents(Number(digits)))
            }}
            placeholder="R$ 280,00"
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Descrição</Label>
        <textarea
          className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
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
