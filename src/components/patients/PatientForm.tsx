import * as React from "react"
import { z } from "zod"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf"
import type { Patient } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const schema = z.object({
  name: z.string().min(2, "Informe o nome do paciente."),
  cpf: z
    .string()
    .optional()
    .refine((v) => !v || isValidCpf(v), "CPF inválido."),
  birth_date: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().optional().refine((v) => !v || z.string().email().safeParse(v).success, "E-mail inválido."),
  gender: z.string().optional(),
  blood_type: z.string().optional(),
  observations: z.string().optional(),
  active: z.boolean(),
  address: z.object({
    street: z.string().optional(),
    number: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }),
})

export type PatientFormValues = z.infer<typeof schema>

const BR_STATES = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
] as const

const citiesCache = new Map<string, string[]>()
const cepCache = new Map<string, { street: string; neighborhood: string; city: string; state: string }>()

async function fetchCitiesByUf(uf: string) {
  const key = uf.trim().toUpperCase()
  if (!key) return []
  const cached = citiesCache.get(key)
  if (cached) return cached
  const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(key)}/municipios?orderBy=nome`)
  if (!res.ok) throw new Error("Não foi possível carregar as cidades.")
  const json = (await res.json()) as Array<{ nome?: unknown }>
  const list = json.map((x) => String(x.nome ?? "").trim()).filter(Boolean)
  citiesCache.set(key, list)
  return list
}

async function fetchAddressByCep(cep: string) {
  const key = digitsOnly(cep).slice(0, 8)
  if (key.length !== 8) return null
  const cached = cepCache.get(key)
  if (cached) return cached
  const res = await fetch(`https://viacep.com.br/ws/${encodeURIComponent(key)}/json/`)
  if (!res.ok) throw new Error("Não foi possível buscar o CEP.")
  const json = (await res.json()) as Record<string, unknown>
  if (json.erro) return null
  const street = String(json.logradouro ?? "").trim()
  const neighborhood = String(json.bairro ?? "").trim()
  const city = String(json.localidade ?? "").trim()
  const state = String(json.uf ?? "").trim().toUpperCase()
  const out = { street, neighborhood, city, state }
  cepCache.set(key, out)
  return out
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function isValidYmd(y: number, m: number, d: number) {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false
  if (y < 1900 || y > 2100) return false
  if (m < 1 || m > 12) return false
  if (d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function parseBirthDate(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!isValidYmd(y, mo, d)) return null
  return { y, m: mo, d }
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "")
}

function formatBrPhoneLocal(digits: string) {
  const d = digitsOnly(digits).slice(0, 11)
  if (!d) return ""
  if (d.length <= 2) return `(${d}`
  const ddd = d.slice(0, 2)
  const num = d.slice(2)
  if (!num) return `(${ddd}) `
  if (num.length <= 4) return `(${ddd}) ${num}`
  if (num.length <= 8) return `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`
  return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5, 9)}`
}

function formatBrPhone(value: string) {
  const d = digitsOnly(value).slice(0, 13)
  if (!d) return ""
  if (d.startsWith("55") && d.length > 11) {
    const local = d.slice(2)
    const formatted = formatBrPhoneLocal(local)
    return formatted ? `+55 ${formatted}` : "+55"
  }
  return formatBrPhoneLocal(d)
}

function formatCep(value: string) {
  const d = digitsOnly(value).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function PatientForm({
  patient,
  onSaved,
  onCancel,
}: {
  patient?: Patient | null
  onSaved: (saved: Patient) => void
  onCancel: () => void
}) {
  const [saving, setSaving] = React.useState(false)

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: patient?.name ?? "",
      cpf: patient?.cpf ?? "",
      birth_date: patient?.birth_date ?? "",
      phone: patient?.phone ?? "",
      whatsapp: patient?.whatsapp ?? "",
      email: patient?.email ?? "",
      gender: patient?.gender ?? "",
      blood_type: patient?.blood_type ?? "",
      observations: patient?.observations ?? "",
      active: patient?.active ?? true,
      address: {
        street: patient?.address?.street ?? "",
        number: patient?.address?.number ?? "",
        neighborhood: patient?.address?.neighborhood ?? "",
        city: patient?.address?.city ?? "",
        state: patient?.address?.state ?? "",
        zip: patient?.address?.zip ?? "",
      },
    },
  })

  const active = useWatch({ control: form.control, name: "active" })
  const [cpfMasked, setCpfMasked] = React.useState("")
  const [phoneMasked, setPhoneMasked] = React.useState("")
  const [whatsappMasked, setWhatsappMasked] = React.useState("")
  const [zipMasked, setZipMasked] = React.useState("")
  const [birthDay, setBirthDay] = React.useState<string>("")
  const [birthMonth, setBirthMonth] = React.useState<string>("")
  const [birthYear, setBirthYear] = React.useState<string>("")
  const uf = useWatch({ control: form.control, name: "address.state" })
  const [cities, setCities] = React.useState<string[]>([])
  const [citiesLoading, setCitiesLoading] = React.useState(false)
  const [citiesError, setCitiesError] = React.useState("")
  const lastUfRef = React.useRef<string>("")
  const zip = useWatch({ control: form.control, name: "address.zip" })
  const [zipLoading, setZipLoading] = React.useState(false)
  const [zipError, setZipError] = React.useState("")
  const lastZipRef = React.useRef<string>("")

  React.useEffect(() => {
    const iso = form.getValues("birth_date")
    const parsed = iso ? parseBirthDate(iso) : null
    if (!parsed) {
      setBirthDay("")
      setBirthMonth("")
      setBirthYear("")
      return
    }
    setBirthDay(pad2(parsed.d))
    setBirthMonth(pad2(parsed.m))
    setBirthYear(String(parsed.y))
  }, [patient?.id, form])

  React.useEffect(() => {
    const cpf = String(form.getValues("cpf") ?? "")
    const phone = String(form.getValues("phone") ?? "")
    const whatsapp = String(form.getValues("whatsapp") ?? "")
    const zip = String(form.getValues("address.zip") ?? "")
    setCpfMasked(formatCpf(cpf))
    setPhoneMasked(formatBrPhone(phone))
    setWhatsappMasked(formatBrPhone(whatsapp))
    setZipMasked(formatCep(zip))
  }, [patient?.id, form])

  React.useEffect(() => {
    const nextUf = String(uf ?? "").trim().toUpperCase()
    if (!nextUf) {
      lastUfRef.current = ""
      setCities([])
      setCitiesError("")
      setCitiesLoading(false)
      return
    }
    if (nextUf !== uf) {
      form.setValue("address.state", nextUf, { shouldDirty: true, shouldValidate: true })
      return
    }
    if (lastUfRef.current && lastUfRef.current !== nextUf) {
      form.setValue("address.city", "", { shouldDirty: true, shouldValidate: true })
    }
    lastUfRef.current = nextUf
    setCitiesLoading(true)
    setCitiesError("")
    void fetchCitiesByUf(nextUf)
      .then((list) => setCities(list))
      .catch((e: unknown) => setCitiesError(e instanceof Error ? e.message : "Não foi possível carregar as cidades."))
      .finally(() => setCitiesLoading(false))
  }, [uf, form])

  React.useEffect(() => {
    const digits = digitsOnly(String(zip ?? "")).slice(0, 8)
    if (!digits) {
      lastZipRef.current = ""
      setZipLoading(false)
      setZipError("")
      return
    }
    if (digits.length < 8) {
      setZipLoading(false)
      setZipError("")
      return
    }
    if (lastZipRef.current === digits) return
    lastZipRef.current = digits
    setZipLoading(true)
    setZipError("")

    const controller = new AbortController()
    const t = window.setTimeout(() => {
      void fetchAddressByCep(digits)
        .then((addr) => {
          if (!addr) {
            setZipError("CEP não encontrado.")
            return
          }
          const currentStreet = String(form.getValues("address.street") ?? "").trim()
          const currentNeighborhood = String(form.getValues("address.neighborhood") ?? "").trim()
          const currentCity = String(form.getValues("address.city") ?? "").trim()
          const currentState = String(form.getValues("address.state") ?? "").trim().toUpperCase()

          if (!currentStreet && addr.street) form.setValue("address.street", addr.street, { shouldDirty: true, shouldValidate: true })
          if (!currentNeighborhood && addr.neighborhood) form.setValue("address.neighborhood", addr.neighborhood, { shouldDirty: true, shouldValidate: true })
          if (addr.city && currentCity !== addr.city) form.setValue("address.city", addr.city, { shouldDirty: true, shouldValidate: true })
          if (addr.state && currentState !== addr.state) form.setValue("address.state", addr.state, { shouldDirty: true, shouldValidate: true })
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return
          setZipError(e instanceof Error ? e.message : "Não foi possível buscar o CEP.")
        })
        .finally(() => {
          if (controller.signal.aborted) return
          setZipLoading(false)
        })
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(t)
    }
  }, [zip, form])

  function setBirthValue(next: { d?: string; m?: string; y?: string }) {
    const d = next.d ?? birthDay
    const m = next.m ?? birthMonth
    const y = next.y ?? birthYear
    if (!d || !m || !y) {
      form.setValue("birth_date", "", { shouldDirty: true, shouldValidate: true })
      return
    }
    const yy = Number(y)
    const mm = Number(m)
    const dd = Number(d)
    if (!isValidYmd(yy, mm, dd)) {
      form.setValue("birth_date", "", { shouldDirty: true, shouldValidate: true })
      return
    }
    form.setValue("birth_date", `${y}-${m}-${d}`, { shouldDirty: true, shouldValidate: true })
  }

  async function onSubmit(values: PatientFormValues) {
    setSaving(true)
    try {
      const payload = {
        name: values.name,
        cpf: values.cpf ? normalizeCpf(values.cpf) : null,
        birth_date: values.birth_date || null,
        phone: values.phone || null,
        whatsapp: values.whatsapp || null,
        email: values.email || null,
        gender: values.gender || null,
        blood_type: values.blood_type || null,
        observations: values.observations || null,
        active: values.active,
        address: values.address,
      }

      if (patient?.id) {
        const { data, error } = await supabase.from("patients").update(payload).eq("id", patient.id).select("*").single()
        if (error) throw error
        toast.success("Paciente atualizado.")
        onSaved(data as Patient)
      } else {
        const { data, error } = await supabase.from("patients").insert(payload).select("*").single()
        if (error) throw error
        toast.success("Paciente cadastrado.")
        onSaved(data as Patient)
      }
    } catch {
      toast.error("Não foi possível salvar o paciente.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-2">
        <Label>Nome</Label>
        <Input {...form.register("name")} />
        {form.formState.errors.name?.message ? <div className="text-sm text-destructive">{form.formState.errors.name.message}</div> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>CPF</Label>
          <Input
            inputMode="numeric"
            value={cpfMasked}
            onChange={(e) => {
              const next = formatCpf(e.target.value)
              setCpfMasked(next)
              form.setValue("cpf", next, { shouldDirty: true, shouldValidate: true })
            }}
            placeholder="000.000.000-00"
          />
          <input type="hidden" {...form.register("cpf")} />
          {form.formState.errors.cpf?.message ? <div className="text-sm text-destructive">{form.formState.errors.cpf.message as string}</div> : null}
        </div>
        <div className="grid gap-2">
          <Label>Data de nascimento</Label>
          <div className="grid grid-cols-3 gap-2">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={birthDay}
              onChange={(e) => {
                const v = e.target.value
                setBirthDay(v)
                setBirthValue({ d: v })
              }}
            >
              <option value="">Dia</option>
              {Array.from({ length: 31 }, (_, i) => pad2(i + 1)).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={birthMonth}
              onChange={(e) => {
                const v = e.target.value
                setBirthMonth(v)
                setBirthValue({ m: v })
              }}
            >
              <option value="">Mês</option>
              {[
                ["01", "Jan"],
                ["02", "Fev"],
                ["03", "Mar"],
                ["04", "Abr"],
                ["05", "Mai"],
                ["06", "Jun"],
                ["07", "Jul"],
                ["08", "Ago"],
                ["09", "Set"],
                ["10", "Out"],
                ["11", "Nov"],
                ["12", "Dez"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={birthYear}
              onChange={(e) => {
                const v = e.target.value
                setBirthYear(v)
                setBirthValue({ y: v })
              }}
            >
              <option value="">Ano</option>
              {(() => {
                const now = new Date().getFullYear()
                const years = []
                for (let y = now; y >= now - 120; y--) years.push(String(y))
                return years
              })().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" {...form.register("birth_date")} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Telefone</Label>
          <Input
            inputMode="numeric"
            value={phoneMasked}
            onChange={(e) => {
              const next = formatBrPhone(e.target.value)
              setPhoneMasked(next)
              form.setValue("phone", next, { shouldDirty: true, shouldValidate: true })
            }}
            placeholder="(11) 99999-9999"
          />
          <input type="hidden" {...form.register("phone")} />
        </div>
        <div className="grid gap-2">
          <Label>WhatsApp</Label>
          <Input
            inputMode="numeric"
            value={whatsappMasked}
            onChange={(e) => {
              const next = formatBrPhone(e.target.value)
              setWhatsappMasked(next)
              form.setValue("whatsapp", next, { shouldDirty: true, shouldValidate: true })
            }}
            placeholder="(11) 99999-9999"
          />
          <input type="hidden" {...form.register("whatsapp")} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>E-mail</Label>
        <Input type="email" {...form.register("email")} />
        {form.formState.errors.email?.message ? <div className="text-sm text-destructive">{form.formState.errors.email.message}</div> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label>Gênero</Label>
          <select {...form.register("gender")} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">(Não informado)</option>
            <option value="Feminino">Feminino</option>
            <option value="Masculino">Masculino</option>
            <option value="Não-binário">Não-binário</option>
            <option value="Outro">Outro</option>
            <option value="Prefiro não informar">Prefiro não informar</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label>Tipo sanguíneo</Label>
          <select {...form.register("blood_type")} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">(Não informado)</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <select
            value={active ? "active" : "inactive"}
            onChange={(e) => form.setValue("active", e.target.value === "active")}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Endereço</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input placeholder="Rua" {...form.register("address.street")} />
          <Input placeholder="Número" {...form.register("address.number")} />
          <Input placeholder="Bairro" {...form.register("address.neighborhood")} />
          <div className="grid gap-1">
            <Input placeholder="Cidade" list="patient-city-list" {...form.register("address.city")} />
            {citiesLoading ? <div className="text-xs text-muted-foreground">Carregando cidades…</div> : null}
            {!citiesLoading && citiesError ? <div className="text-xs text-destructive">{citiesError}</div> : null}
            <datalist id="patient-city-list">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <select {...form.register("address.state")} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">UF</option>
            {BR_STATES.map((s) => (
              <option key={s.uf} value={s.uf}>
                {s.uf} — {s.name}
              </option>
            ))}
          </select>
          <div className="grid gap-1">
            <Input
              placeholder="CEP"
              inputMode="numeric"
              value={zipMasked}
              onChange={(e) => {
                const next = formatCep(e.target.value)
                setZipMasked(next)
                form.setValue("address.zip", next, { shouldDirty: true, shouldValidate: true })
              }}
            />
            <input type="hidden" {...form.register("address.zip")} />
            {zipLoading ? <div className="text-xs text-muted-foreground">Buscando CEP…</div> : null}
            {!zipLoading && zipError ? <div className="text-xs text-destructive">{zipError}</div> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Observações</Label>
        <textarea
          className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...form.register("observations")}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  )
}
