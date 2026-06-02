import * as React from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { GlobalSearch } from "@/components/search/GlobalSearch"
import { Spinner } from "@/components/ui/spinner"

export function AppShell() {
  const [collapsed, setCollapsed] = React.useState<boolean>(() => localStorage.getItem("dentalflow.sidebar") === "collapsed")
  const [openSearch, setOpenSearch] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes("mac")
      const isCtrlK = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k"
      if (isCtrlK) {
        e.preventDefault()
        setOpenSearch(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem("dentalflow.sidebar", next ? "collapsed" : "expanded")
      return next
    })
  }, [])

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenSearch={() => setOpenSearch(true)} />
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center py-24">
                <Spinner className="h-8 w-8" />
              </div>
            }
          >
            <Outlet />
          </React.Suspense>
        </main>
      </div>
      <GlobalSearch
        open={openSearch}
        onOpenChange={setOpenSearch}
        onNavigate={(to) => {
          setOpenSearch(false)
          navigate(to)
        }}
      />
    </div>
  )
}
