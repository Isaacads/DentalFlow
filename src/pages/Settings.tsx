import * as React from "react"
import { toast } from "sonner"
import { ChevronDown, ChevronUp } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { planAllows, useAuth } from "@/providers/AuthProvider"
import type { Clinic, ClinicWorkingHours, WorkingHourRange } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { useTheme } from "@/hooks/useTheme"

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

function publicBaseUrl() {
  const env = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ?? ""
  const raw = (env || window.location.origin).trim()
  return raw.endsWith("/") ? raw.slice(0, -1) : raw
}

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

export function SettingsPage() {
  const { profile, isOwner, planTier, refreshProfile } = useAuth()
  const { theme, toggle } = useTheme()
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [clinic, setClinic] = React.useState<Clinic | null>(null)
  const [name, setName] = React.useState("")
  const [logoUrl, setLogoUrl] = React.useState("")
  const [slogan, setSlogan] = React.useState("")
  const [logoUploading, setLogoUploading] = React.useState(false)
  const [cnpj, setCnpj] = React.useState("")
  const [whatsTemplate, setWhatsTemplate] = React.useState("")
  const [whatsAutoBookingTemplate, setWhatsAutoBookingTemplate] = React.useState("")
  const [plan, setPlan] = React.useState<"essential" | "clinic" | "management">("essential")
  const [bookingEnabled, setBookingEnabled] = React.useState(false)
  const [bookingSlug, setBookingSlug] = React.useState("")
  const [bookingWindowDays, setBookingWindowDays] = React.useState<number>(14)
  const [bookingLeadHours, setBookingLeadHours] = React.useState<number>(2)
  const [bookingMode, setBookingMode] = React.useState<"request" | "auto">("request")
  const [workingHours, setWorkingHours] = React.useState<ClinicWorkingHours>(defaultWorkingHours())
  const [workingHoursOpen, setWorkingHoursOpen] = React.useState(false)
  const [returnEnabled, setReturnEnabled] = React.useState(true)
  const [returnDefaultDays, setReturnDefaultDays] = React.useState<number>(180)
  const [street, setStreet] = React.useState("")
  const [number, setNumber] = React.useState("")
  const [neighborhood, setNeighborhood] = React.useState("")
  const [city, setCity] = React.useState("")
  const [state, setState] = React.useState("")
  const [zip, setZip] = React.useState("")

  React.useEffect(() => {
    let mounted = true
    async function load() {
      if (!profile?.clinic_id) return
      setLoading(true)
      const { data } = await supabase.from("clinics").select("*").eq("id", profile.clinic_id).maybeSingle()
      if (!mounted) return
      const c = (data ?? null) as Clinic | null
      setClinic(c)
      setName(c?.name ?? "")
      setLogoUrl(c?.logo_url ?? "")
      setSlogan(c?.slogan ?? "")
      setCnpj(c?.cnpj ?? "")
      setWhatsTemplate(c?.whatsapp_confirmation_template ?? "")
      setWhatsAutoBookingTemplate(
        ((c as unknown as { whatsapp_auto_booking_template?: unknown } | null)?.whatsapp_auto_booking_template as string | undefined) ??
          c?.whatsapp_confirmation_template ??
          ""
      )
      setPlan(((c as unknown as { plan_tier?: unknown } | null)?.plan_tier as "essential" | "clinic" | "management" | undefined) ?? "essential")
      setBookingEnabled(Boolean((c as unknown as { booking_enabled?: unknown } | null)?.booking_enabled))
      setBookingSlug(String((c as unknown as { booking_slug?: unknown } | null)?.booking_slug ?? ""))
      setBookingWindowDays(Number((c as unknown as { booking_window_days?: unknown } | null)?.booking_window_days ?? 14))
      setBookingLeadHours(Number((c as unknown as { booking_lead_time_hours?: unknown } | null)?.booking_lead_time_hours ?? 2))
      setBookingMode(((c as unknown as { booking_mode?: unknown } | null)?.booking_mode as "request" | "auto" | undefined) ?? "request")
      setWorkingHours(normalizeWorkingHours((c as unknown as { working_hours?: unknown } | null)?.working_hours))
      setReturnEnabled(c?.return_enabled == null ? true : Boolean(c.return_enabled))
      setReturnDefaultDays(c?.return_default_days == null ? 180 : Number(c.return_default_days))
      setStreet(c?.address?.street ?? "")
      setNumber(c?.address?.number ?? "")
      setNeighborhood(c?.address?.neighborhood ?? "")
      setCity(c?.address?.city ?? "")
      setState(c?.address?.state ?? "")
      setZip(c?.address?.zip ?? "")
      setLoading(false)
    }
    void load().catch(() => setLoading(false))
    return () => {
      mounted = false
    }
  }, [profile?.clinic_id])

  const effectivePlan = isOwner ? plan : planTier
  const canReturns = planAllows(effectivePlan, "retornos")

  async function uploadClinicLogo(file: File) {
    const clinicId = profile?.clinic_id
    if (!clinicId) return
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB.")
      return
    }
    setLogoUploading(true)
    try {
      const ext = file.name.includes(".") ? file.name.split(".").slice(-1)[0] : "png"
      const safeExt = String(ext ?? "png").replace(/[^a-z0-9]/gi, "").toLowerCase() || "png"
      const path = `${clinicId}/logo-${crypto.randomUUID()}.${safeExt}`
      const { error } = await supabase.storage.from("clinic-assets").upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const publicUrl = supabase.storage.from("clinic-assets").getPublicUrl(path).data.publicUrl
      setLogoUrl(publicUrl)
      toast.success("Logo enviada. Clique em Salvar para aplicar.")
    } catch (e) {
      const msg = getErrorMessage(e)
      if (msg.toLowerCase().includes("bucket not found")) {
        toast.error("Não foi possível enviar a logo. Bucket clinic-assets não existe no Supabase Storage.")
      } else if (msg.toLowerCase().includes("row-level security")) {
        toast.error("Não foi possível enviar a logo. Falta permissão (RLS) no Storage para clinic-assets.")
      } else {
        toast.error(`Não foi possível enviar a logo. (${msg})`)
      }
    } finally {
      setLogoUploading(false)
    }
  }

  async function onSave() {
    if (!clinic?.id) return
    setSaving(true)
    try {
      const safeSlug = bookingSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")
      const payload = {
        name,
        logo_url: logoUrl || null,
        slogan: slogan || null,
        cnpj: cnpj || null,
        whatsapp_confirmation_template: whatsTemplate,
        whatsapp_auto_booking_template: whatsAutoBookingTemplate,
        booking_enabled: isOwner ? bookingEnabled : undefined,
        booking_slug: isOwner ? (safeSlug || undefined) : undefined,
        booking_window_days: isOwner ? Math.max(1, Math.min(60, Math.trunc(bookingWindowDays))) : undefined,
        booking_lead_time_hours: isOwner ? Math.max(0, Math.min(168, Math.trunc(bookingLeadHours))) : undefined,
        booking_mode: isOwner ? bookingMode : undefined,
        working_hours: isOwner ? normalizeWorkingHours(workingHours) : undefined,
        return_enabled: returnEnabled,
        return_default_days: Number.isFinite(returnDefaultDays) ? Math.max(0, Math.trunc(returnDefaultDays)) : 180,
        address: { street, number, neighborhood, city, state, zip },
      }
      const { data, error } = await supabase.from("clinics").update(payload).eq("id", clinic.id).select("*").single()
      if (error) throw error
      setClinic(data as Clinic)
      toast.success("Configurações salvas.")
      await refreshProfile()
    } catch (e) {
      toast.error(`Não foi possível salvar. (${getErrorMessage(e)})`)
    } finally {
      setSaving(false)
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
      <div>
        <div className="text-xl font-semibold">Configurações</div>
        <div className="text-sm text-muted-foreground">Dados da clínica e preferências.</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da clínica</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>CNPJ</Label>
            <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div className="grid gap-2">
            <Label>Endereço</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input placeholder="Rua" value={street} onChange={(e) => setStreet(e.target.value)} />
              <Input placeholder="Número" value={number} onChange={(e) => setNumber(e.target.value)} />
              <Input placeholder="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
              <Input placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
              <Input placeholder="UF" value={state} onChange={(e) => setState(e.target.value)} />
              <Input placeholder="CEP" value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Mensagem WhatsApp (confirmação)</Label>
            <textarea
              className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={whatsTemplate}
              onChange={(e) => setWhatsTemplate(e.target.value)}
            />
            <div className="text-xs text-muted-foreground">Variáveis: {"{nome}"} {"{data}"} {"{hora}"}</div>
            <div className="text-xs text-muted-foreground">Usado no botão WhatsApp da Agenda (abre wa.me com a mensagem pronta).</div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Plano</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>Plano atual</Label>
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-medium">
                {plan === "management" ? "Gestão (financeiro e gestão completa)" : plan === "clinic" ? "Clínica (prontuário e retornos)" : "Essencial (agenda e pacientes)"}
              </div>
              <div className="text-xs text-muted-foreground">O plano é definido pela sua assinatura. Para alterar, gerencie a assinatura na área de cobrança.</div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Agendamento online</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <div className="text-sm font-medium">Ativar agendamento online</div>
              <div className="text-sm text-muted-foreground">Libera uma página pública para o paciente agendar.</div>
            </div>
            <Switch checked={bookingEnabled} onCheckedChange={(v) => setBookingEnabled(v)} disabled={!isOwner} />
          </div>

          <div className="grid gap-2">
            <Label>Modo</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={bookingMode}
              onChange={(e) => setBookingMode(e.target.value as "request" | "auto")}
              disabled={!isOwner}
            >
              <option value="request">Solicitação (a clínica confirma)</option>
              <option value="auto">Autoagendamento (marca direto)</option>
            </select>
            <div className="text-xs text-muted-foreground">No autoagendamento, o paciente escolhe 1 horário e o sistema cria a consulta automaticamente.</div>
          </div>

          <div className="grid gap-2">
            <Label>Slug do link</Label>
            <Input value={bookingSlug} onChange={(e) => setBookingSlug(e.target.value)} disabled={!isOwner} placeholder="ex.: minha-clinica" />
            <div className="text-xs text-muted-foreground">Somente letras, números e hífen. O Titular controla esse link.</div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Janela (dias)</Label>
              <Input type="number" min={1} max={60} value={String(bookingWindowDays)} onChange={(e) => setBookingWindowDays(Number(e.target.value))} disabled={!isOwner} />
            </div>
            <div className="grid gap-2">
              <Label>Antecedência mínima (horas)</Label>
              <Input type="number" min={0} max={168} value={String(bookingLeadHours)} onChange={(e) => setBookingLeadHours(Number(e.target.value))} disabled={!isOwner} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Link público</Label>
            <Input readOnly value={bookingSlug ? `${publicBaseUrl()}/booking/${bookingSlug}` : ""} />
            {!isOwner ? <div className="text-xs text-muted-foreground">Apenas o Titular pode alterar as configurações.</div> : null}
          </div>

          <div className="grid gap-2">
            <Label>Mensagem WhatsApp (autoagendamento)</Label>
            <textarea
              className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={whatsAutoBookingTemplate}
              onChange={(e) => setWhatsAutoBookingTemplate(e.target.value)}
              disabled={!isOwner}
            />
            <div className="text-xs text-muted-foreground">Variáveis: {"{nome}"} {"{data}"} {"{hora}"}</div>
            <div className="text-xs text-muted-foreground">Usada quando o paciente agenda no modo Autoagendamento (entra na fila “Confirmações WhatsApp pendentes”).</div>
            {!isOwner ? <div className="text-xs text-muted-foreground">Apenas o Titular pode alterar a mensagem.</div> : null}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button onClick={onSave} disabled={saving || !isOwner}>
              {saving ? "Salvando..." : "Salvar agendamento online"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Horário de funcionamento</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setWorkingHoursOpen((v) => !v)}
            className="gap-2"
            aria-expanded={workingHoursOpen}
          >
            {workingHoursOpen ? "Recolher" : "Expandir"}
            {workingHoursOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="text-sm text-muted-foreground">Define os dias e períodos em que a clínica atende. Isso afeta os horários exibidos no agendamento online.</div>
          {workingHoursOpen ? (
            <>
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
                  <div key={d.key} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-medium">{d.label}</div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(v) => {
                          setWorkingHours((prev) => {
                            const next = { ...prev }
                            if (!v) next[d.key] = []
                            else next[d.key] = d.key === "6" ? [{ start: "08:00", end: "12:00" }] : [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "18:00" }]
                            return next
                          })
                        }}
                        disabled={!isOwner}
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
                              disabled={!isOwner}
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
                              disabled={!isOwner}
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
                              disabled={!isOwner}
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
                          disabled={!isOwner}
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
              {!isOwner ? <div className="text-xs text-muted-foreground">Apenas o Titular pode alterar o horário de funcionamento.</div> : null}
            </>
          ) : (
            <div className="text-xs text-muted-foreground">Clique em “Expandir” para editar.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retornos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          {!canReturns ? <div className="text-sm text-muted-foreground">Disponível a partir do plano Clínica.</div> : null}
          <div className="grid gap-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Retornos automáticos</div>
                <div className="text-sm text-muted-foreground">Gera retorno quando a consulta é marcada como Realizada.</div>
              </div>
              <Switch checked={returnEnabled} onCheckedChange={(v) => setReturnEnabled(v)} disabled={!canReturns} />
            </div>
            <div className="grid gap-2">
              <Label>Padrão de dias para retorno</Label>
              <Input
                type="number"
                min={0}
                value={String(returnDefaultDays)}
                onChange={(e) => setReturnDefaultDays(Number(e.target.value))}
                disabled={!canReturns}
              />
              <div className="text-xs text-muted-foreground">Usado quando o procedimento não define um retorno específico.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>Logo (arquivo)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                disabled={logoUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file) void uploadClinicLogo(file)
                }}
              />
            </div>
            <div className="text-xs text-muted-foreground">PNG/JPG/WEBP • até 5MB.</div>
          </div>

          <div className="grid gap-2">
            <Label>Logo (URL)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
              <Button type="button" variant="outline" onClick={() => setLogoUrl("")} disabled={!logoUrl}>
                Limpar
              </Button>
            </div>
            {logoUrl ? (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <img src={logoUrl} alt="Logo da clínica" className="h-12 w-12 rounded object-contain" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">Prévia</div>
                  <div className="truncate text-xs text-muted-foreground">{logoUrl}</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label>Nome da clínica</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>Slogan</Label>
            <Input value={slogan} onChange={(e) => setSlogan(e.target.value)} placeholder="Ex.: Gestão odontológica" />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <div className="text-sm font-medium">Tema escuro</div>
              <div className="text-sm text-muted-foreground">Alterna entre claro e escuro.</div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={theme === "dark"} onCheckedChange={() => toggle()} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button onClick={onSave} disabled={saving || logoUploading}>
              {saving ? "Salvando..." : logoUploading ? "Enviando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
