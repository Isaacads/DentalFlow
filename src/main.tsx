import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"
import { isSupabaseConfigured } from "./lib/supabase"

function ConfigError() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6">
        <div className="text-xl font-semibold">Configuração incompleta</div>
        <div className="mt-2 text-sm text-muted-foreground">
          O Supabase não está configurado. Defina as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente de produção (NEXANO) e faça novo deploy.
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>{import.meta.env.PROD && !isSupabaseConfigured ? <ConfigError /> : <App />}</StrictMode>,
)
