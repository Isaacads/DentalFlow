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
  X,
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
  mobileOpen = false,
  onCloseMobile,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen?: boolean
  onCloseMobile?: () => void
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
      {/* Backdrop só no mobile, quando o drawer está aberto */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden="true"
        onClick={onCloseMobile}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-[272px] shrink-0 flex-col border-r bg-card shadow-xl transition-transform duration-200 ease-in-out",
          "lg:sticky lg:top-0 lg:z-30 lg:bg-card/60 lg:shadow-none lg:backdrop-blur lg:supports-[backdrop-filter]:bg-card/40 lg:transition-[width]",
          collapsed ? "lg:w-[72px]" : "lg:w-[272px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center gap-1 px-4 py-4">
          <div className="flex items-center">
            <img src={brandLogo} alt={brandName} className="h-12 w-12 shrink-0" />
          </div>
          <div className={cn("min-w-0", collapsed && "lg:hidden")}>
            <div className="truncate text-base font-semibold leading-tight">{brandName}</div>
            <div className="truncate text-xs text-muted-foreground">{brandSlogan}</div>
          </div>
          <div className="ml-auto flex items-center">
            {/* Fechar drawer (mobile) */}
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onCloseMobile} aria-label="Fechar menu">
              <X className="h-4 w-4" />
            </Button>
            {/* Recolher/expandir (desktop) */}
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggleCollapsed} aria-label="Alternar sidebar">
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2">
          <ul className="grid gap-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon
              const link = (
                <NavLink
                  to={item.to}
                  end={item.to === "/app"}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                      collapsed && "lg:justify-center lg:px-2",
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
                </NavLink>
              )

              return (
                <li key={item.to}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right" className="hidden lg:block">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className={cn("border-t p-3", collapsed && "lg:px-2")}>
          <div className={cn("text-center text-xs text-muted-foreground", collapsed ? "hidden lg:block" : "hidden")}>AMMI</div>
          <div className={cn("flex flex-wrap items-center gap-2 text-xs text-muted-foreground", collapsed && "lg:hidden")}>
            <span>v1</span>
            <span>AMMI-Tech</span>
            <span>ammisoftware@outlook.com</span>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
