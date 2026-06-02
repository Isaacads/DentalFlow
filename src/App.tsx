import * as React from "react"
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom"
import { Toaster } from "sonner"
import { AuthProvider } from "@/providers/AuthProvider"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AppShell } from "@/components/layout/AppShell"
import { Landing } from "@/pages/Landing"
import { Login } from "@/pages/Login"
import { BookingPage } from "@/pages/Booking"
import { Onboarding } from "@/pages/Onboarding"
import { supabase } from "@/lib/supabase"
import { canAccess, planAllows, useAuth } from "@/providers/AuthProvider"

const Dashboard = React.lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })))
const Agenda = React.lazy(() => import("@/pages/Agenda").then((m) => ({ default: m.Agenda })))
const Patients = React.lazy(() => import("@/pages/Patients").then((m) => ({ default: m.Patients })))
const PatientDetail = React.lazy(() => import("@/pages/PatientDetail").then((m) => ({ default: m.PatientDetail })))
const PatientAnamnesisReportPage = React.lazy(() => import("@/pages/PatientDetail").then((m) => ({ default: m.PatientAnamnesisReportPage })))
const MedicalRecordPage = React.lazy(() => import("@/pages/MedicalRecord").then((m) => ({ default: m.MedicalRecordPage })))
const Financial = React.lazy(() => import("@/pages/Financial").then((m) => ({ default: m.Financial })))
const FinancialReportPage = React.lazy(() => import("@/pages/Financial").then((m) => ({ default: m.FinancialReportPage })))
const ProceduresPage = React.lazy(() => import("@/pages/Procedures").then((m) => ({ default: m.ProceduresPage })))
const TeamPage = React.lazy(() => import("@/pages/Team").then((m) => ({ default: m.TeamPage })))
const SettingsPage = React.lazy(() => import("@/pages/Settings").then((m) => ({ default: m.SettingsPage })))

function RequireAccess({
  feature,
  children,
}: {
  feature: "financeiro" | "equipe" | "configuracoes" | "prontuario"
  children: React.ReactNode
}) {
  const { profile, planTier } = useAuth()
  if (!canAccess(profile?.role, feature)) return <Navigate to="/app" replace />
  if (feature === "financeiro" && !planAllows(planTier, "financeiro")) return <Navigate to="/app" replace />
  if (feature === "prontuario" && !planAllows(planTier, "prontuario")) return <Navigate to="/app" replace />
  return <>{children}</>
}

function RsvpPage() {
  const [params] = useSearchParams()
  const token = (params.get("token") ?? "").trim()
  const action = (params.get("action") ?? "").trim()
  const [state, setState] = React.useState<{ status: "loading" | "done" | "error"; message: string }>({
    status: "loading",
    message: "Processando sua resposta...",
  })

  React.useEffect(() => {
    let mounted = true
    async function run() {
      if (!token || !action) {
        if (mounted) setState({ status: "error", message: "Link inválido." })
        return
      }
      const { data, error } = await supabase.rpc("rsvp_appointment", { p_token: token, p_action: action })
      if (!mounted) return
      if (error) {
        setState({ status: "error", message: `Não foi possível atualizar sua resposta. (${String((error as { message?: unknown }).message ?? "Erro")})` })
        return
      }
      const result = String(data ?? "")
      if (result === "confirmed") setState({ status: "done", message: "Consulta confirmada. Obrigado!" })
      else if (result === "cancelled") setState({ status: "done", message: "Consulta cancelada." })
      else if (result === "expired_token") setState({ status: "error", message: "Este link expirou. Entre em contato com a clínica." })
      else if (result === "already_used") setState({ status: "error", message: "Este link já foi utilizado." })
      else setState({ status: "error", message: "Não foi possível validar este link." })
    }
    void run()
    return () => {
      mounted = false
    }
  }, [token, action])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-soft">
        <div className="text-lg font-semibold">AMMI DentalFlow</div>
        <div className="mt-3 text-sm text-muted-foreground">{state.message}</div>
        <a className="mt-5 inline-flex text-sm font-medium text-accent hover:underline" href="/">
          Voltar ao site
        </a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/rsvp" element={<RsvpPage />} />
          <Route path="/booking/:slug" element={<BookingPage />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="pacientes" element={<Patients />} />
              <Route path="pacientes/:id" element={<PatientDetail />} />
              <Route path="pacientes/:id/anamnese/relatorio" element={<PatientAnamnesisReportPage />} />
              <Route
                path="prontuario/:id"
                element={
                  <RequireAccess feature="prontuario">
                    <MedicalRecordPage />
                  </RequireAccess>
                }
              />
              <Route
                path="financeiro"
                element={
                  <RequireAccess feature="financeiro">
                    <Financial />
                  </RequireAccess>
                }
              />
              <Route
                path="financeiro/relatorio"
                element={
                  <RequireAccess feature="financeiro">
                    <FinancialReportPage />
                  </RequireAccess>
                }
              />
              <Route path="procedimentos" element={<ProceduresPage />} />
              <Route
                path="equipe"
                element={
                  <RequireAccess feature="equipe">
                    <TeamPage />
                  </RequireAccess>
                }
              />
              <Route
                path="configuracoes"
                element={
                  <RequireAccess feature="configuracoes">
                    <SettingsPage />
                  </RequireAccess>
                }
              />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  )
}
