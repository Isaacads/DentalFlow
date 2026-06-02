import * as React from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/providers/AuthProvider"
import { Spinner } from "@/components/ui/spinner"

export function ProtectedRoute() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const location = useLocation()
  const [checkingProfile, setCheckingProfile] = React.useState(false)
  const [attemptedForUserId, setAttemptedForUserId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (loading) return
    if (!user?.id) return
    if (profile) return
    if (attemptedForUserId === user.id) return
    setAttemptedForUserId(user.id)
    setCheckingProfile(true)
    refreshProfile()
      .catch(() => undefined)
      .finally(() => setCheckingProfile(false))
  }, [attemptedForUserId, loading, profile, refreshProfile, user?.id])

  if (loading || checkingProfile)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  if (!profile) {
    if (attemptedForUserId !== user.id)
      return (
        <div className="flex min-h-dvh items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      )
    return <Navigate to="/onboarding" replace />
  }
  return <Outlet />
}
