import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { supabase } from "@/lib/supabase"
import type { ClinicWorkingHours, Profile, ProfileRole, WorkingHourRange } from "@/types/database"
import { useAuth } from "@/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const roles: Array<{ value: ProfileRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "dentist", label: "Dentista" },
  { value: "receptionist", label: "Recepção" },
  { value: "assistant", label: "Auxiliar" },
]

function defaultWorkingHours(): ClinicWorkingHours {
  const weekday = [
    { start: "08:00", end: "12:00" },
    { start: "13:00", end: "18:00" },
  ]
  return {
    "1": weekday,
    "2": weekday,
    "3": weekday,
    "4": weekday,
    "5": weekday,
    "6": [{ start: "08:00", end: "12:00" }],
    "0": [],
  }
}

function isTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function minutesOf(value: string) {
  const [h, m] = value.split(":").map((x) => Number(x))
  return h * 60 + m
}

function normalizeWorkingHours(input: unknown): ClinicWorkingHours {
  const base = defaultWorkingHours()
  if (!input || typeof input !== "object") return base
  const obj = input as Record<string, unknown>
  const out: ClinicWorkingHours = { "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] }
  for (const k of Object.keys(out)) {
    const arr = Array.isArray(obj[k]) ? (obj[k] as unknown[]) : null
    if (!arr) continue
    const ranges: WorkingHourRange[] = []
    for (const it of arr) {
      if (!it || typeof it !== "object") continue
      const row = it as Record<string, unknown>
      const start = String(row.start ?? "").trim()
      const end = String(row.end ?? "").trim()
      if (!isTime(start) || !isTime(end)) continue
      if (minutesOf(start) >= minutesOf(end)) continue
      ranges.push({ start, end })
    }
    out[k] = ranges.slice(0, 4)
  }
  const hasAny = Object.values(out).some((r) => r.length)
  return hasAny ? out : base
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

async function readResponseBody(res: Response) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export function TeamPage() {
  const { profile, isOwner, refreshProfile } = useAuth()
  const [loading, setLoading] = React.useState(true)
  const [people, setPeople] = React.useState<Profile[]>([])
  const [ownerId, setOwnerId] = React.useState<string>("")
  const [openEdit, setOpenEdit] = React.useState(false)
  const [editing, setEditing] = React.useState<Profile | null>(null)
  const [page, setPage] = React.useState(0)
  const [openCreate, setOpenCreate] = React.useState(false)
  const [transferOpen, setTransferOpen] = React.useState(false)
  const [transferTarget, setTransferTarget] = React.useState<Profile | null>(null)
  const [transferring, setTransferring] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const clinicId = profile?.clinic_id ?? ""
      const profileSelect = "id,clinic_id,full_name,role,cro,specialty,phone,color,active,working_hours,avatar_url,created_at,updated_at"
      const [pRes, cRes] = await Promise.all([
        supabase.from("profiles").select(profileSelect).order("full_name", { ascending: true }),
        clinicId ? supabase.from("clinics").select("owner_id").eq("id", clinicId).maybeSingle() : Promise.resolve({ data: null }),
      ])
      const data = pRes.data
      setPeople((data ?? []) as Profile[])
      setOwnerId(String((cRes.data as { owner_id?: unknown } | null)?.owner_id ?? ""))
    } finally {
      setLoading(false)
    }
  }, [profile?.clinic_id])

  React.useEffect(() => {
    void load()
  }, [load])

  async function onConfirmTransfer() {
    if (!transferTarget?.id) return
    setTransferring(true)
    try {
      const { error } = await supabase.rpc("transfer_clinic_ownership", { p_new_owner_id: transferTarget.id })
      if (error) throw error
      toast.success("Titularidade transferida com sucesso.")
      setOwnerId(transferTarget.id)
      setTransferOpen(false)
      setTransferTarget(null)
      await refreshProfile()
    } catch (e) {
      toast.error(`Não foi possível transferir a titularidade. (${getErrorMessage(e)})`)
    } finally {
      setTransferring(false)
    }
  }

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(people.length / pageSize))
  const pageSafe = Math.min(page, totalPages - 1)
  const pageItems = people.slice(pageSafe * pageSize, pageSafe * pageSize + pageSize)

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Equipe</div>
          <div className="text-sm text-muted-foreground">Perfis e permissões por função.</div>
        </div>
        {profile?.role === "admin" ? (
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar profissional
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profissionais</CardTitle>
        </CardHeader>
        <CardContent>
          {people.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead className="hidden lg:table-cell">Especialidade</TableHead>
                  <TableHead className="hidden md:table-cell">Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name ?? p.id}</TableCell>
                    <TableCell>{roles.find((r) => r.value === p.role)?.label ?? p.role}</TableCell>
                    <TableCell className="hidden lg:table-cell">{p.specialty ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{p.phone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        {p.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                        {ownerId && p.id === ownerId ? <Badge variant="default">Titular</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isOwner && p.role === "admin" && ownerId && p.id !== ownerId ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTransferTarget(p)
                              setTransferOpen(true)
                            }}
                            disabled={transferring}
                          >
                            Transferir titularidade
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditing(p)
                            setOpenEdit(true)
                          }}
                          disabled={
                            !profile?.id ||
                            (profile?.role !== "admin" && profile?.id !== p.id) ||
                            (!isOwner && profile?.role === "admin" && p.role === "admin" && profile?.id !== p.id)
                          }
                        >
                          Editar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Nenhum perfil encontrado.</div>
          )}

          {people.length > pageSize ? (
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

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
          </DialogHeader>
          <ProfileForm
            profile={editing}
            canAdminEdit={profile?.role === "admin"}
            isOwner={isOwner}
            currentUserId={profile?.id ?? ""}
            onCancel={() => setOpenEdit(false)}
            onSaved={(saved) => {
              setPeople((prev) => prev.map((p) => (p.id === saved.id ? saved : p)))
              setOpenEdit(false)
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Cadastrar profissional</DialogTitle>
          </DialogHeader>
          <CreateProfessionalForm
            clinicId={profile?.clinic_id ?? ""}
            canCreate={profile?.role === "admin"}
            isOwner={isOwner}
            onCancel={() => setOpenCreate(false)}
            onCreated={(created) => {
              setPeople((prev) => [...prev, created].sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "")))
              setOpenCreate(false)
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open)
          if (!open) setTransferTarget(null)
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Transferir titularidade</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="text-sm text-muted-foreground">
              {transferTarget?.full_name
                ? `Deseja transferir a titularidade da clínica para ${transferTarget.full_name}?`
                : "Deseja transferir a titularidade da clínica?"}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setTransferOpen(false)
                  setTransferTarget(null)
                }}
                disabled={transferring}
              >
                Cancelar
              </Button>
              <Button onClick={() => void onConfirmTransfer()} disabled={transferring || !transferTarget?.id}>
                {transferring ? "Transferindo..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const createSchema = z
  .object({
    email: z.string().email("Informe um e-mail válido."),
    fullName: z.string().min(2, "Informe o nome."),
    accessType: z.enum(["admin", "staff"], { message: "Selecione o tipo de acesso." }),
    staffRole: z.enum(["dentist", "receptionist", "assistant"]).optional(),
    cro: z.string().optional().or(z.literal("")),
    specialty: z.string().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    color: z.string().min(4, "Informe a cor."),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.accessType === "staff" && !v.staffRole) {
      ctx.addIssue({ code: "custom", path: ["staffRole"], message: "Selecione a função do profissional." })
    }
  })

type CreateValues = z.infer<typeof createSchema>

function CreateProfessionalForm({
  clinicId,
  canCreate,
  isOwner,
  onCancel,
  onCreated,
}: {
  clinicId: string
  canCreate: boolean
  isOwner: boolean
  onCancel: () => void
  onCreated: (created: Profile) => void
}) {
  const [saving, setSaving] = React.useState(false)

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      email: "",
      fullName: "",
      accessType: "staff",
      staffRole: "dentist",
      cro: "",
      specialty: "",
      phone: "",
      color: "#1E3A5F",
      active: true,
    },
  })

  const active = useWatch({ control: form.control, name: "active" })
  const accessType = useWatch({ control: form.control, name: "accessType" })
  const color = useWatch({ control: form.control, name: "color" })

  async function onSubmit(values: CreateValues) {
    if (!canCreate) {
      toast.error("Apenas administradores podem cadastrar profissionais.")
      return
    }
    if (!clinicId) {
      toast.error("Clínica não identificada. Faça login novamente.")
      return
    }

    setSaving(true)
    try {
      const role: ProfileRole = values.accessType === "admin" ? "admin" : (values.staffRole as ProfileRole)
      if (role === "admin" && !isOwner) {
        toast.error("Apenas o titular da clínica pode cadastrar administradores.")
        return
      }

      const canInvoke = typeof (supabase as unknown as { functions?: { invoke?: unknown } }).functions?.invoke === "function"
      if (!canInvoke) {
        throw new Error("Convites não disponíveis no modo demo.")
      }

      const { data, error } = await (supabase as unknown as {
        functions: { invoke: (name: string, opts: { body: unknown }) => Promise<{ data: unknown; error: unknown }> }
      }).functions.invoke("invite-team-member", {
        body: {
          email: values.email,
          fullName: values.fullName,
          role,
          cro: values.cro ? values.cro : null,
          specialty: values.specialty ? values.specialty : null,
          phone: values.phone ? values.phone : null,
          color: values.color,
          active: values.active,
        },
      })
      if (error) throw error

      const created = (data as { profile: Profile } | null)?.profile
      if (!created?.id) throw new Error("Resposta inválida do servidor.")
      toast.success("Profissional cadastrado.")
      onCreated(created)
    } catch (e) {
      try {
        const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ""
        const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ""
        const host = supabaseUrl ? new URL(supabaseUrl).hostname : ""
        const ref = host.split(".")[0] ?? ""
        const fnUrl = ref ? `https://${ref}.functions.supabase.co/invite-team-member` : ""
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token ?? ""
        if (!fnUrl || !token || !anon) throw e

        const role: ProfileRole = values.accessType === "admin" ? "admin" : (values.staffRole as ProfileRole)
        const res = await fetch(fnUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: anon,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: values.email,
            fullName: values.fullName,
            role,
            cro: values.cro ? values.cro : null,
            specialty: values.specialty ? values.specialty : null,
            phone: values.phone ? values.phone : null,
            color: values.color,
            active: values.active,
          }),
        })
        const body = await readResponseBody(res)
        const detail =
          body == null
            ? `HTTP ${res.status}`
            : `HTTP ${res.status} • ${
                typeof body === "string"
                  ? body
                  : (() => {
                      try {
                        return JSON.stringify(body)
                      } catch {
                        return String(body)
                      }
                    })()
              }`
        toast.error(`Não foi possível cadastrar. (${detail})`)
      } catch (e2) {
        const msg = getErrorMessage(e2)
        const hint =
          msg.includes("Failed to send a request to the Edge Function") || msg.includes("Failed to fetch")
            ? " Verifique se o navegador/rede está bloqueando *.functions.supabase.co."
            : ""
        toast.error(`Não foi possível cadastrar. (${msg}${hint})`)
      }
    } finally {
      setSaving(false)
    }
  }

  const errors = form.formState.errors

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="rounded-lg border bg-secondary/30 p-3 text-sm text-muted-foreground">
        Um convite será enviado por e-mail para o profissional definir a senha e acessar o sistema.
      </div>
      <div className="grid gap-2">
        <Label>E-mail do usuário</Label>
        <Input placeholder="ex: joao@clinica.com" type="email" autoComplete="email" {...form.register("email")} />
        {errors.email?.message ? <div className="text-sm text-destructive">{errors.email.message}</div> : null}
      </div>
      <div className="grid gap-2">
        <Label>Nome</Label>
        <Input placeholder="Ex: Dra. Maria Silva" {...form.register("fullName")} />
        {errors.fullName?.message ? <div className="text-sm text-destructive">{errors.fullName.message}</div> : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Tipo de acesso</Label>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" {...form.register("accessType")}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          {errors.accessType?.message ? <div className="text-sm text-destructive">{errors.accessType.message}</div> : null}
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={active ? "active" : "inactive"}
            onChange={(e) => form.setValue("active", e.target.value === "active")}
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>
      {accessType === "staff" ? (
        <div className="grid gap-2">
          <Label>Função do staff</Label>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" {...form.register("staffRole")}>
            {roles
              .filter((r) => r.value !== "admin")
              .map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
          </select>
          {errors.staffRole?.message ? <div className="text-sm text-destructive">{errors.staffRole.message}</div> : null}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>CRO</Label>
          <Input placeholder="Ex: CRO-SP 12345" {...form.register("cro")} />
        </div>
        <div className="grid gap-2">
          <Label>Especialidade</Label>
          <Input placeholder="Ex: Ortodontia" {...form.register("specialty")} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Telefone</Label>
          <Input placeholder="(11) 99999-0000" {...form.register("phone")} />
        </div>
        <div className="grid gap-2">
          <Label>Cor na agenda</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => form.setValue("color", e.target.value)}
              className="h-10 w-14 rounded-md border"
            />
            <Input {...form.register("color")} />
          </div>
          {errors.color?.message ? <div className="text-sm text-destructive">{errors.color.message}</div> : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Cadastrar"}
        </Button>
      </div>
    </form>
  )
}

function ProfileForm({
  profile,
  canAdminEdit,
  isOwner,
  currentUserId,
  onCancel,
  onSaved,
}: {
  profile: Profile | null
  canAdminEdit: boolean
  isOwner: boolean
  currentUserId: string
  onCancel: () => void
  onSaved: (saved: Profile) => void
}) {
  const [saving, setSaving] = React.useState(false)
  const [fullName, setFullName] = React.useState(profile?.full_name ?? "")
  const [role, setRole] = React.useState<ProfileRole>(profile?.role ?? "dentist")
  const [cro, setCro] = React.useState(profile?.cro ?? "")
  const [specialty, setSpecialty] = React.useState(profile?.specialty ?? "")
  const [phone, setPhone] = React.useState(profile?.phone ?? "")
  const [color, setColor] = React.useState(profile?.color ?? "#1E3A5F")
  const [active, setActive] = React.useState(profile?.active ?? true)
  const [clinicHours, setClinicHours] = React.useState<ClinicWorkingHours>(defaultWorkingHours())
  const [useClinicHours, setUseClinicHours] = React.useState(true)
  const [workingHours, setWorkingHours] = React.useState<ClinicWorkingHours>(defaultWorkingHours())
  const canEditWorkingHours = role === "admin" || role === "dentist"

  React.useEffect(() => {
    let mounted = true
    async function loadClinicHours() {
      if (!profile?.clinic_id) return
      const { data } = await supabase.from("clinics").select("working_hours").eq("id", profile.clinic_id).maybeSingle()
      if (!mounted) return
      setClinicHours(normalizeWorkingHours((data as { working_hours?: unknown } | null)?.working_hours))
    }
    void loadClinicHours().catch(() => undefined)
    return () => {
      mounted = false
    }
  }, [profile?.clinic_id])

  React.useEffect(() => {
    const custom = (profile as unknown as { working_hours?: unknown } | null)?.working_hours
    if (custom && typeof custom === "object" && Object.keys(custom as object).length) {
      setUseClinicHours(false)
      setWorkingHours(normalizeWorkingHours(custom))
    } else {
      setUseClinicHours(true)
      setWorkingHours(defaultWorkingHours())
    }
  }, [profile])

  async function onSubmit() {
    if (!profile?.id) return
    setSaving(true)
    try {
      const payload: Partial<Profile> = {
        full_name: fullName || null,
        cro: cro || null,
        specialty: specialty || null,
        phone: phone || null,
        color: color || null,
        active,
      }
      if (canEditWorkingHours) {
        payload.working_hours = useClinicHours ? null : normalizeWorkingHours(workingHours)
      }
      const isEditingSelf = currentUserId && profile.id === currentUserId
      if (canAdminEdit && isOwner && !isEditingSelf) payload.role = role
      const profileSelect = "id,clinic_id,full_name,role,cro,specialty,phone,color,active,working_hours,avatar_url,created_at,updated_at"
      const { data, error } = await supabase.from("profiles").update(payload).eq("id", profile.id).select(profileSelect).single()
      if (error) throw error
      toast.success("Perfil atualizado.")
      onSaved(data as Profile)
    } catch {
      toast.error("Não foi possível salvar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Nome</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Função</Label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ProfileRole)}
            disabled={!canAdminEdit || !isOwner || (!!currentUserId && profile?.id === currentUserId)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-70"
          >
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <select
            value={active ? "active" : "inactive"}
            onChange={(e) => setActive(e.target.value === "active")}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>CRO</Label>
          <Input value={cro} onChange={(e) => setCro(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Especialidade</Label>
          <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Telefone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Cor na agenda</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 rounded-md border" />
            <Input value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
        </div>
      </div>

      {canEditWorkingHours ? (
        <div className="grid gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Horário de atendimento</div>
              <div className="text-xs text-muted-foreground">{useClinicHours ? "Usando o horário padrão da clínica." : "Usando horário próprio deste profissional."}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm">Usar horário da clínica</div>
              <input
                type="checkbox"
                checked={useClinicHours}
                onChange={(e) => {
                  const v = e.target.checked
                  setUseClinicHours(v)
                  if (v) setWorkingHours(defaultWorkingHours())
                }}
                className="h-4 w-4"
              />
            </div>
          </div>

          {!useClinicHours ? (
            <div className="grid gap-3">
              {(
                [
                  { key: "1", label: "Segunda" },
                  { key: "2", label: "Terça" },
                  { key: "3", label: "Quarta" },
                  { key: "4", label: "Quinta" },
                  { key: "5", label: "Sexta" },
                  { key: "6", label: "Sábado" },
                  { key: "0", label: "Domingo" },
                ] as const
              ).map((d) => {
                const ranges = workingHours[d.key] ?? []
                const enabled = ranges.length > 0
                return (
                  <div key={d.key} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-medium">{d.label}</div>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => {
                          const v = e.target.checked
                          setWorkingHours((prev) => {
                            const next = { ...prev }
                            if (!v) next[d.key] = []
                            else next[d.key] = d.key === "6" ? [{ start: "08:00", end: "12:00" }] : [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "18:00" }]
                            return next
                          })
                        }}
                        className="h-4 w-4"
                      />
                    </div>
                    {enabled ? (
                      <div className="mt-3 grid gap-2">
                        {ranges.map((r, idx) => (
                          <div key={`${d.key}-${idx}`} className="flex flex-wrap items-center gap-2">
                            <Input
                              type="time"
                              value={r.start}
                              onChange={(e) => {
                                const value = e.target.value
                                setWorkingHours((prev) => {
                                  const next = { ...prev }
                                  const arr = [...(next[d.key] ?? [])]
                                  arr[idx] = { ...arr[idx], start: value }
                                  next[d.key] = arr
                                  return next
                                })
                              }}
                              className="w-32"
                            />
                            <div className="text-sm text-muted-foreground">até</div>
                            <Input
                              type="time"
                              value={r.end}
                              onChange={(e) => {
                                const value = e.target.value
                                setWorkingHours((prev) => {
                                  const next = { ...prev }
                                  const arr = [...(next[d.key] ?? [])]
                                  arr[idx] = { ...arr[idx], end: value }
                                  next[d.key] = arr
                                  return next
                                })
                              }}
                              className="w-32"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setWorkingHours((prev) => {
                                  const next = { ...prev }
                                  next[d.key] = (next[d.key] ?? []).filter((_, i) => i !== idx)
                                  return next
                                })
                              }}
                            >
                              Remover
                            </Button>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setWorkingHours((prev) => {
                              const next = { ...prev }
                              const arr = [...(next[d.key] ?? [])]
                              if (arr.length >= 4) return next
                              arr.push({ start: "08:00", end: "12:00" })
                              next[d.key] = arr
                              return next
                            })
                          }}
                        >
                          Adicionar período
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-muted-foreground">Fechado</div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="grid gap-2">
              <div className="text-xs text-muted-foreground">Padrão da clínica:</div>
              <div className="grid gap-1 text-xs text-muted-foreground">
                {(["1", "2", "3", "4", "5", "6", "0"] as const).map((k) => (
                  <div key={k}>
                    {k === "1"
                      ? "Seg"
                      : k === "2"
                        ? "Ter"
                        : k === "3"
                          ? "Qua"
                          : k === "4"
                            ? "Qui"
                            : k === "5"
                              ? "Sex"
                              : k === "6"
                                ? "Sáb"
                                : "Dom"}
                    : {(clinicHours[k] ?? []).length ? (clinicHours[k] ?? []).map((r) => `${r.start}-${r.end}`).join(" • ") : "Fechado"}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

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
