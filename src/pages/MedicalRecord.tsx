import * as React from "react"
import { useNavigate, useSearchParams, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { canAccess, useAuth } from "@/providers/AuthProvider"
import type { MedicalRecord, Patient, ToothMap } from "@/types/database"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Odontogram } from "@/components/odontogram/Odontogram"
import { formatDateTimeWithYear } from "@/lib/format"

function asToothMap(v: unknown): ToothMap {
  if (!v || typeof v !== "object") return {}
  return v as ToothMap
}

export function MedicalRecordPage() {
  const { id } = useParams()
  const patientId = id ?? ""
  const [params, setParams] = useSearchParams()
  const recordId = params.get("record")
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canUse = canAccess(profile?.role, "prontuario")

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [patient, setPatient] = React.useState<Patient | null>(null)
  const [record, setRecord] = React.useState<MedicalRecord | null>(null)
  const [chiefComplaint, setChiefComplaint] = React.useState("")
  const [clinicalNotes, setClinicalNotes] = React.useState("")
  const [diagnosis, setDiagnosis] = React.useState("")
  const [treatmentPlan, setTreatmentPlan] = React.useState("")
  const [toothMap, setToothMap] = React.useState<ToothMap>({})
  const [attachments, setAttachments] = React.useState<string[]>([])
  const [signedUrls, setSignedUrls] = React.useState<Record<string, string>>({})
  const printableRef = React.useRef<HTMLDivElement>(null)

  const onPrint = useReactToPrint({
    contentRef: printableRef,
    documentTitle: `AMMI DentalFlow - Prontuário - ${patient?.name ?? "Paciente"}`,
  })

  React.useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      const pRes = await supabase.from("patients").select("*").eq("id", patientId).maybeSingle()
      const rRes = canUse && recordId ? await supabase.from("medical_records").select("*").eq("id", recordId).maybeSingle() : null

      if (!mounted) return
      setPatient((pRes.data ?? null) as Patient | null)
      const rec = (rRes?.data ?? null) as MedicalRecord | null
      setRecord(rec)
      setChiefComplaint(rec?.chief_complaint ?? "")
      setClinicalNotes(rec?.clinical_notes ?? "")
      setDiagnosis(rec?.diagnosis ?? "")
      setTreatmentPlan(rec?.treatment_plan ?? "")
      setToothMap(asToothMap(rec?.tooth_map))
      setAttachments((rec?.attachments ?? []).map((x) => String(x)))
      setLoading(false)
    }
    if (patientId) load().catch(() => setLoading(false))
    return () => {
      mounted = false
    }
  }, [patientId, recordId, canUse])

  React.useEffect(() => {
    let cancelled = false
    async function hydrateSignedUrls() {
      const pending = attachments.filter((p) => !signedUrls[p])
      if (!pending.length) return
      const next: Record<string, string> = {}
      for (const path of pending) {
        const { data, error } = await supabase.storage.from("medical-attachments").createSignedUrl(path, 60 * 60)
        if (!error && data?.signedUrl) next[path] = data.signedUrl
      }
      if (!cancelled) setSignedUrls((prev) => ({ ...prev, ...next }))
    }
    void hydrateSignedUrls()
    return () => {
      cancelled = true
    }
  }, [attachments, signedUrls])

  async function uploadFiles(files: FileList) {
    if (!profile?.clinic_id) throw new Error("clinic")
    const targetRecordId = record?.id ?? crypto.randomUUID()
    const uploaded: string[] = []
    for (const file of Array.from(files)) {
      const path = `${profile.clinic_id}/${patientId}/${targetRecordId}/${crypto.randomUUID()}-${file.name}`
      const { error } = await supabase.storage.from("medical-attachments").upload(path, file, { upsert: false })
      if (error) throw error
      uploaded.push(path)
    }
    return { uploaded, targetRecordId }
  }

  async function onSave() {
    if (!canUse) {
      toast.error("Você não tem permissão para acessar o prontuário.")
      return
    }
    if (!profile?.id) return
    setSaving(true)
    try {
      const payload = {
        patient_id: patientId,
        dentist_id: profile.id,
        chief_complaint: chiefComplaint || null,
        clinical_notes: clinicalNotes || null,
        diagnosis: diagnosis || null,
        treatment_plan: treatmentPlan || null,
        tooth_map: toothMap,
        attachments: attachments as unknown as string[],
      }

      if (record?.id) {
        const { data, error } = await supabase.from("medical_records").update(payload).eq("id", record.id).select("*").single()
        if (error) throw error
        setRecord(data as MedicalRecord)
        toast.success("Prontuário atualizado.")
      } else {
        const { data, error } = await supabase.from("medical_records").insert(payload).select("*").single()
        if (error) throw error
        setRecord(data as MedicalRecord)
        params.set("record", data.id)
        setParams(params, { replace: true })
        toast.success("Prontuário criado.")
      }
    } catch {
      toast.error("Não foi possível salvar o prontuário.")
    } finally {
      setSaving(false)
    }
  }

  async function onSign() {
    if (!record?.id || !profile?.id) return
    try {
      const { data, error } = await supabase
        .from("medical_records")
        .update({ signed_by: profile.id, signed_at: new Date().toISOString() })
        .eq("id", record.id)
        .select("*")
        .single()
      if (error) throw error
      setRecord(data as MedicalRecord)
      toast.success("Prontuário assinado.")
    } catch {
      toast.error("Não foi possível assinar o prontuário.")
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )

  if (!canUse) return <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Sem permissão para acessar prontuários.</div>

  if (!patient) return <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Paciente não encontrado.</div>

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5"
            onClick={() => {
              if (window.history.length > 1) navigate(-1)
              else navigate(`/app/pacientes/${patientId}`)
            }}
            aria-label="Voltar"
          >
            <ArrowLeft />
          </Button>
          <div>
            <div className="text-xl font-semibold">Prontuário • {patient.name}</div>
            <div className="text-sm text-muted-foreground">{record?.created_at ? `Criado em ${formatDateTimeWithYear(record.created_at)}` : "Novo prontuário"}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => onPrint()}>
            Imprimir / PDF
          </Button>
          <Button variant="outline" onClick={() => onSign()} disabled={!record?.id}>
            Assinar
          </Button>
          <Button onClick={() => onSave()} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div ref={printableRef} className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Odontograma</CardTitle>
          </CardHeader>
          <CardContent>
            <Odontogram value={toothMap} onChange={setToothMap} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registro clínico</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>Queixa principal</Label>
              <Input value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Anotações clínicas</Label>
              <textarea
                className="min-h-32 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Diagnóstico</Label>
              <Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Plano de tratamento</Label>
              <textarea
                className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={treatmentPlan}
                onChange={(e) => setTreatmentPlan(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anexos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              <Label>Upload de imagens/radiografias</Label>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,application/pdf"
                onChange={async (e) => {
                  if (!e.target.files?.length) return
                  try {
                    const { uploaded, targetRecordId } = await uploadFiles(e.target.files)
                    setAttachments((prev) => [...uploaded, ...prev])
                    if (!record?.id) params.set("record", targetRecordId)
                    setParams(params, { replace: true })
                    toast.success("Arquivos enviados. Salve o prontuário para registrar os anexos.")
                  } catch {
                    toast.error("Falha no upload.")
                  } finally {
                    e.target.value = ""
                  }
                }}
              />
            </div>
            {attachments.length ? (
              <div className="grid gap-2">
                {attachments.map((path) => (
                  <a
                    key={path}
                    href={signedUrls[path] ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate rounded-lg border p-3 text-sm hover:bg-secondary/50"
                  >
                    {path.split("/").slice(-1)[0]}
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Nenhum anexo.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assinatura</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {record?.signed_at ? (
              <div className="grid gap-1">
                <div>Assinado em: {formatDateTimeWithYear(record.signed_at)}</div>
                <div className="text-muted-foreground">Dentista responsável: {record.signed_by ?? "—"}</div>
              </div>
            ) : (
              <div className="text-muted-foreground">Ainda não assinado.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
