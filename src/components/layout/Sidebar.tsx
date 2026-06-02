import * as React from "react"
import { NavLink } from "react-router-dom"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cog,
  CreditCard,
  LayoutDashboard,
  Stethoscope,
  Users,
} from "lucide-react"
import logoDentalFlow from "@/assets/logoDentalFlow.png"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { canAccess, planAllows, useAuth } from "@/providers/AuthProvider"

type NavItem = {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/app/pacientes", label: "Pacientes", icon: Users },
  { to: "/app/procedimentos", label: "Procedimentos", icon: ClipboardList },
  { to: "/app/financeiro", label: "Financeiro", icon: CreditCard },
  { to: "/app/equipe", label: "Equipe", icon: Stethoscope },
  { to: "/app/configuracoes", label: "Configurações", icon: Cog },
]

export function Sidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const { profile } = useAuth()
  const { planTier } = useAuth()
  const role = profile?.role
  const [clinicBrand, setClinicBrand] = React.useState<{ name: string; slogan: string; logo_url: string } | null>(null)
  const visibleNavItems = React.useMemo(() => {
    return navItems.filter((item) => {
      if (item.to === "/app/financeiro") return canAccess(role, "financeiro") && planAllows(planTier, "financeiro")
      if (item.to === "/app/equipe") return canAccess(role, "equipe")
      if (item.to === "/app/configuracoes") return canAccess(role, "configuracoes")
      return true
    })
  }, [role, planTier])

  React.useEffect(() => {
    let mounted = true
    async function loadClinicBrand() {
      const clinicId = profile?.clinic_id
      if (!clinicId) {
        if (mounted) setClinicBrand(null)
        return
      }
      const { data } = await supabase.from("clinics").select("name,slogan,logo_url").eq("id", clinicId).maybeSingle()
      if (!mounted) return
      const name = String(data?.name ?? "").trim()
      const slogan = String((data as unknown as { slogan?: unknown } | null)?.slogan ?? "").trim()
      const logoUrl = String(data?.logo_url ?? "").trim()
      if (!name && !slogan && !logoUrl) {
        setClinicBrand(null)
        return
      }
      setClinicBrand({ name, slogan, logo_url: logoUrl })
    }
    void loadClinicBrand().catch(() => {
      if (mounted) setClinicBrand(null)
    })
    return () => {
      mounted = false
    }
  }, [profile?.clinic_id])

  const brandName = clinicBrand?.name || "AMMI DentalFlow"
  const brandSlogan = clinicBrand?.slogan || "Gestão odontológica"
  const brandLogo = clinicBrand?.logo_url || logoDentalFlow

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "sticky top-0 flex h-dvh shrink-0 flex-col border-r bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40",
          collapsed ? "w-[72px]" : "w-[272px]",
        )}
      >
        <div className="flex items-center gap-1 px-4 py-4">
          <div className="flex items-center">
            <img src={brandLogo} alt={brandName} className="h-12 w-12 shrink-0" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-base font-semibold leading-tight">{brandName}</div>
              <div className="truncate text-xs text-muted-foreground">{brandSlogan}</div>
            </div>
          )}
          <div className="ml-auto">
            <Button variant="ghost" size="icon" onClick={onToggleCollapsed} aria-label="Alternar sidebar">
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <nav className="flex-1 px-2 py-2">
          <ul className="grid gap-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon
              const link = (
                <NavLink
                  to={item.to}
                  end={item.to === "/app"}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                      collapsed && "justify-center px-2",
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              )

              return (
                <li key={item.to}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className={cn("border-t p-3", collapsed && "px-2")}>
          {collapsed ? (
            <div className={cn("text-xs text-muted-foreground", collapsed && "text-center")}>AMMI</div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>v1</span>
              <span>AMMI-Tech</span>
              <span>ammisoftware@outlook.com</span>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
