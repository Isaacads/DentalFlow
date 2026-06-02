import * as React from "react"
import { LogOut, Moon, Search, Sun, UserRound } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/providers/AuthProvider"
import { useTheme } from "@/hooks/useTheme"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "U"
  const first = parts[0]?.[0] ?? "U"
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
  return (first + last).toUpperCase()
}

function roleLabel(role?: string | null) {
  if (role === "admin") return "Admin"
  if (role === "dentist") return "Dentista"
  if (role === "receptionist") return "Recepção"
  if (role === "assistant") return "Auxiliar"
  return role ?? "—"
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

export function Topbar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { user, profile, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const [accountOpen, setAccountOpen] = React.useState(false)
  const [clinicName, setClinicName] = React.useState<string>("")
  const [loadingClinic, setLoadingClinic] = React.useState(false)
  const [savingPassword, setSavingPassword] = React.useState(false)
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")

  React.useEffect(() => {
    let mounted = true
    async function loadClinic() {
      if (!accountOpen) return
      const clinicId = profile?.clinic_id ?? ""
      if (!clinicId) return
      setLoadingClinic(true)
      try {
        const { data, error } = await supabase.from("clinics").select("name").eq("id", clinicId).maybeSingle()
        if (error) throw error
        if (!mounted) return
        setClinicName(String((data as { name?: unknown } | null)?.name ?? ""))
      } catch {
        if (!mounted) return
        setClinicName("")
      } finally {
        if (mounted) setLoadingClinic(false)
      }
    }
    void loadClinic()
    return () => {
      mounted = false
    }
  }, [accountOpen, profile?.clinic_id])

  async function onChangePassword() {
    if (!user) return
    if (newPassword.trim().length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres.")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem.")
      return
    }

    const canUpdate = typeof (supabase as unknown as { auth?: { updateUser?: unknown } }).auth?.updateUser === "function"
    if (!canUpdate) {
      toast.error("Mudança de senha não disponível no modo demo.")
      return
    }

    setSavingPassword(true)
    try {
      const { error } = await (supabase as unknown as { auth: { updateUser: (args: { password: string }) => Promise<{ error: unknown }> } }).auth.updateUser({
        password: newPassword,
      })
      if (error) throw error
      toast.success("Senha atualizada com sucesso.")
      setNewPassword("")
      setConfirmPassword("")
      setAccountOpen(false)
    } catch (e) {
      toast.error(`Não foi possível atualizar a senha. (${getErrorMessage(e)})`)
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div className="flex-1" />
      <Button variant="outline" className="hidden gap-2 sm:inline-flex" onClick={onOpenSearch}>
        <Search className="h-4 w-4" />
        Buscar
        <span className="ml-2 rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">Ctrl K</span>
      </Button>
      <Button variant="outline" size="icon" className="sm:hidden" onClick={onOpenSearch} aria-label="Buscar">
        <Search className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 gap-2 px-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback>{initials(profile?.full_name ?? user?.email)}</AvatarFallback>
            </Avatar>
            <div className={cn("hidden min-w-0 text-left sm:block")}>
              <div className="truncate text-sm font-medium leading-tight">{profile?.full_name ?? user?.email ?? "Usuário"}</div>
              <div className="truncate text-xs text-muted-foreground">{roleLabel(profile?.role)}</div>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAccountOpen(true)}>
            <UserRound className="mr-2 h-4 w-4" />
            Perfil e senha
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={accountOpen}
        onOpenChange={(open) => {
          setAccountOpen(open)
          if (!open) {
            setNewPassword("")
            setConfirmPassword("")
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Minha conta</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
              <div className="grid gap-1">
                <div className="font-medium">{profile?.full_name ?? "Usuário"}</div>
                <div className="text-muted-foreground">{user?.email ?? "—"}</div>
                <div className="text-muted-foreground">{roleLabel(profile?.role)}</div>
                <div className="text-muted-foreground">{loadingClinic ? "Carregando clínica..." : clinicName ? clinicName : "—"}</div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="text-sm font-medium">Alterar senha</div>
              <div className="grid gap-2">
                <Label htmlFor="account-new-password">Nova senha</Label>
                <Input
                  id="account-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="account-confirm-password">Confirmar nova senha</Label>
                <Input
                  id="account-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAccountOpen(false)}
                  disabled={savingPassword}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={() => void onChangePassword()} disabled={savingPassword}>
                  {savingPassword ? "Salvando..." : "Salvar senha"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
