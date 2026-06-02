import * as React from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useAuth } from "@/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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

const schema = z.object({
  clinicName: z.string().min(2, "Informe o nome da clínica."),
  fullName: z.string().min(2, "Informe seu nome."),
})

type FormValues = z.infer<typeof schema>

export function Onboarding() {
  const { user, profile, bootstrapClinic } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { clinicName: "", fullName: "" },
  })

  if (!user) return <Navigate to="/login" replace />
  if (profile) return <Navigate to="/app" replace />

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      await bootstrapClinic(values.clinicName, values.fullName)
      toast.success("Clínica configurada com sucesso.")
      navigate("/app", { replace: true })
    } catch (e) {
      const msg = getErrorMessage(e)
      if (msg.includes("bootstrap_clinic") || msg.toLowerCase().includes("rpc")) {
        toast.error(`Falha ao salvar a clínica. Verifique se você rodou as migrations. (${msg})`)
      } else {
        toast.error(`Não foi possível configurar sua clínica. (${msg})`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Finalizar cadastro</CardTitle>
            <CardDescription>Acesso liberado após compra. Complete os dados para iniciar.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-2">
                <Label htmlFor="clinicName">Nome da clínica</Label>
                <Input id="clinicName" placeholder="Ex: Clínica Sorriso" {...form.register("clinicName")} />
                {form.formState.errors.clinicName?.message ? (
                  <div className="text-sm text-destructive">{form.formState.errors.clinicName.message}</div>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fullName">Seu nome</Label>
                <Input id="fullName" placeholder="Ex: Dra. Maria Silva" {...form.register("fullName")} />
                {form.formState.errors.fullName?.message ? (
                  <div className="text-sm text-destructive">{form.formState.errors.fullName.message}</div>
                ) : null}
              </div>
              <Button
                type="button"
                disabled={loading}
                onClick={form.handleSubmit(onSubmit, () => {
                  toast.error("Verifique os campos do formulário.")
                })}
              >
                {loading ? "Salvando..." : "Concluir"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
