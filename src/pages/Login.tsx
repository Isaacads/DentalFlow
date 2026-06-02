import * as React from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/providers/AuthProvider"
import logoDentalFlow from "@/assets/logoDentalFlow.png"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function getErrorMessage(err: unknown) {
  if (typeof err === "string") return err
  if (err && typeof err === "object" && "message" in err) return String((err as { message?: unknown }).message ?? "Erro")
  return "Erro"
}

function getAuthHashType(hash: string) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  const type = (params.get("type") ?? "").trim()
  return type
}

async function withTimeout<T>(promise: Promise<T>, ms: number) {
  let t: number | undefined
  const timeout = new Promise<never>((_, reject) => {
    t = window.setTimeout(() => reject(new Error("Tempo limite excedido ao conectar no Supabase.")), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (t != null) window.clearTimeout(t)
  }
}

const schema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
})

type FormValues = z.infer<typeof schema>

const passwordSchema = z
  .object({
    password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
    confirmPassword: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "As senhas não conferem." })
    }
  })

type PasswordValues = z.infer<typeof passwordSchema>

export function Login() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = React.useState(false)

  const authType = React.useMemo(() => getAuthHashType(location.hash), [location.hash])
  const isPasswordFlow = authType === "recovery" || authType === "invite"
  const from = (location.state as { from?: string } | null)?.from

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  if (user && !isPasswordFlow) return <Navigate to={from ?? "/app"} replace />

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const { error } = await withTimeout(supabase.auth.signInWithPassword({ email: values.email, password: values.password }), 15000)
      if (error) throw error
      toast.success("Bem-vindo(a) ao AMMI DentalFlow!")
      navigate(from ?? "/app", { replace: true })
    } catch (e) {
      toast.error(`Não foi possível entrar. (${getErrorMessage(e)})`)
    } finally {
      setLoading(false)
    }
  }

  async function onForgotPassword() {
    const email = form.getValues("email")
    if (!email) {
      toast.error("Informe seu e-mail para recuperar a senha.")
      return
    }
    try {
      const redirectTo = `${window.location.origin}/login`
      const { error } = await withTimeout(supabase.auth.resetPasswordForEmail(email, { redirectTo }), 15000)
      if (error) throw error
      toast.success("E-mail de recuperação enviado (se o e-mail estiver cadastrado).")
    } catch (e) {
      toast.error(`Não foi possível enviar o e-mail de recuperação. (${getErrorMessage(e)})`)
    }
  }

  async function onSetPassword(values: PasswordValues) {
    setLoading(true)
    try {
      const { error } = await withTimeout(supabase.auth.updateUser({ password: values.password }), 15000)
      if (error) throw error
      toast.success("Senha definida com sucesso.")
      navigate("/app", { replace: true })
    } catch (e) {
      toast.error(`Não foi possível definir a senha. (${getErrorMessage(e)})`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="space-y-0">
            <div className="flex flex-col items-center">
              <img src={logoDentalFlow} alt="AMMI DentalFlow" className="block h-56 w-auto" />
              <div className="-mt-6 text-center text-sm text-muted-foreground">Entre para gerenciar sua clínica com eficiência.</div>
            </div>
          </CardHeader>
          <CardContent>
            {isPasswordFlow ? (
              <form className="grid gap-4" onSubmit={passwordForm.handleSubmit(onSetPassword)}>
                <div className="rounded-lg border bg-secondary/30 p-3 text-sm text-muted-foreground">
                  Defina uma senha para acessar o AMMI DentalFlow usando e-mail e senha.
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input id="new-password" type="password" autoComplete="new-password" {...passwordForm.register("password")} />
                  {passwordForm.formState.errors.password?.message ? (
                    <div className="text-sm text-destructive">{passwordForm.formState.errors.password.message}</div>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirmar senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    {...passwordForm.register("confirmPassword")}
                  />
                  {passwordForm.formState.errors.confirmPassword?.message ? (
                    <div className="text-sm text-destructive">{passwordForm.formState.errors.confirmPassword.message}</div>
                  ) : null}
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : "Definir senha"}
                </Button>
              </form>
            ) : (
              <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
                  {form.formState.errors.email?.message ? (
                    <div className="text-sm text-destructive">{form.formState.errors.email.message}</div>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    <Button type="button" variant="ghost" className="h-auto px-2 py-1 text-xs" onClick={onForgotPassword}>
                      Esqueci minha senha
                    </Button>
                  </div>
                  <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
                  {form.formState.errors.password?.message ? (
                    <div className="text-sm text-destructive">{form.formState.errors.password.message}</div>
                  ) : null}
                </div>
                <Button type="submit" disabled={loading} className="mb-4">
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
