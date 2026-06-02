import * as React from "react"
import type { ToothMap, ToothStatus } from "@/types/database"
import { cn } from "@/lib/utils"

const adultTeeth = Array.from({ length: 32 }, (_, i) => String(i + 1))
const childTeeth = Array.from({ length: 20 }, (_, i) => `I${i + 1}`)

const statuses: Array<{ value: ToothStatus; label: string; color: string }> = [
  { value: "saudavel", label: "Saudável", color: "#10B981" },
  { value: "carie", label: "Cárie", color: "#F59E0B" },
  { value: "restaurado", label: "Restaurado", color: "#1E3A5F" },
  { value: "ausente", label: "Ausente", color: "#EF4444" },
  { value: "coroa", label: "Coroa", color: "#A3A3A3" },
  { value: "implante", label: "Implante", color: "#0EA5E9" },
  { value: "fraturado", label: "Fraturado", color: "#FB7185" },
  { value: "canal", label: "Canal", color: "#8B5CF6" },
]

function getColor(status?: ToothStatus) {
  return statuses.find((s) => s.value === status)?.color ?? "#E5E7EB"
}

export function Odontogram({
  value,
  onChange,
}: {
  value: ToothMap
  onChange: (next: ToothMap) => void
}) {
  const [mode, setMode] = React.useState<"adulto" | "infantil">("adulto")
  const [selected, setSelected] = React.useState<string | null>(null)

  const teeth = mode === "adulto" ? adultTeeth : childTeeth
  const selectedStatus = selected ? value[selected]?.status : undefined
  const selectedTreatment = selected ? value[selected]?.treatment ?? "" : ""

  function setToothStatus(tooth: string, status: ToothStatus) {
    onChange({ ...value, [tooth]: { status, treatment: value[tooth]?.treatment } })
  }

  function setToothTreatment(tooth: string, treatment: string) {
    onChange({ ...value, [tooth]: { status: value[tooth]?.status ?? "saudavel", treatment } })
  }

  function clearTooth(tooth: string) {
    const next = { ...value }
    delete next[tooth]
    onChange(next)
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Odontograma interativo</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn("h-9 rounded-md border px-3 text-sm", mode === "adulto" ? "bg-secondary" : "bg-background")}
            onClick={() => setMode("adulto")}
          >
            Adulto (32)
          </button>
          <button
            type="button"
            className={cn("h-9 rounded-md border px-3 text-sm", mode === "infantil" ? "bg-secondary" : "bg-background")}
            onClick={() => setMode("infantil")}
          >
            Infantil (20)
          </button>
        </div>
      </div>

      <svg viewBox="0 0 800 220" className="w-full rounded-lg border bg-card">
        {teeth.map((tooth, idx) => {
          const col = idx % 16
          const row = Math.floor(idx / 16)
          const x = 10 + col * 48
          const y = 20 + row * 90
          const status = value[tooth]?.status
          const isSelected = selected === tooth
          return (
            <g key={tooth} onClick={() => setSelected(tooth)} style={{ cursor: "pointer" }}>
              <rect x={x} y={y} width={40} height={60} rx={10} fill={getColor(status)} opacity={status ? 0.95 : 0.5} stroke={isSelected ? "hsl(var(--ring))" : "hsl(var(--border))"} strokeWidth={isSelected ? 3 : 1} />
              <text x={x + 20} y={y + 35} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill={status ? "#ffffff" : "#111827"}>
                {tooth}
              </text>
              <text x={x + 20} y={y + 52} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={status ? "#ffffff" : "#6b7280"}>
                {status ? status : "—"}
              </text>
            </g>
          )
        })}
      </svg>

      {selected ? (
        <div className="grid gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Dente selecionado: {selected}</div>
            <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => clearTooth(selected)}>
              Limpar
            </button>
          </div>
          <div className="grid gap-2">
            <div className="text-sm text-muted-foreground">Status</div>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setToothStatus(selected, s.value)}
                  className={cn("rounded-md border px-3 py-1 text-xs", selectedStatus === s.value ? "bg-secondary" : "bg-background")}
                >
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <div className="text-sm text-muted-foreground">Tratamento</div>
            <input
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedTreatment}
              onChange={(e) => setToothTreatment(selected, e.target.value)}
              placeholder="Ex: restauração, canal, coroa..."
            />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Selecione um dente para registrar status e tratamento.</div>
      )}
    </div>
  )
}

