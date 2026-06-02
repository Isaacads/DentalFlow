import * as React from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { PlanTier, Profile, ProfileRole } from "@/types/database"

const PROFILE_CACHE_KEY = "dentalflow.profile_cache_v1"

type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  isOwner: boolean
  planTier: PlanTier
  loading: boolean
}

type ProfileCache = {
  userId: string
  profile: Profile
  isOwner: boolean
  planTier: PlanTier
  savedAt: string
}

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  bootstrapClinic: (clinicName: string, fullName: string) => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

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

async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()
  if (error) throw error
  return (data ?? null) as Profile | null
}

type ProfileWithClinic = Profile & { clinic?: { owner_id?: string | null; plan_tier?: string | null } | null }

async function fetchProfileWithClinic(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*, clinic:clinics(owner_id, plan_tier)").eq("id", userId).maybeSingle()
  if (error) throw error
  return (data ?? null) as ProfileWithClinic | null
}

function normalizePlanTier(value: unknown): PlanTier {
  const tier = String(value ?? "essential")
  if (tier === "clinic" || tier === "management" || tier === "essential") return tier
  return "essential"
}

function readProfileCache(userId: string) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ProfileCache>
    if (parsed.userId !== userId) return null
    if (!parsed.profile) return null
    const savedAt = typeof parsed.savedAt === "string" ? Date.parse(parsed.savedAt) : NaN
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > 24 * 60 * 60 * 1000) return null
    const planTier = normalizePlanTier(parsed.planTier)
    return { profile: parsed.profile as Profile, isOwner: Boolean(parsed.isOwner), planTier }
  } catch {
    return null
  }
}

function writeProfileCache(userId: string, profile: Profile, isOwner: boolean, planTier: PlanTier) {
  try {
    const payload: ProfileCache = { userId, profile, isOwner, planTier, savedAt: new Date().toISOString() }
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(payload))
  } catch {
    return
  }
}

function clearProfileCache() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY)
  } catch {
    return
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    isOwner: false,
    planTier: "essential",
    loading: true,
  })

  const lastProfileRef = React.useRef<Profile | null>(null)
  const lastIsOwnerRef = React.useRef(false)
  const lastPlanTierRef = React.useRef<PlanTier>("essential")

  React.useEffect(() => {
    lastProfileRef.current = state.profile
    lastIsOwnerRef.current = state.isOwner
    lastPlanTierRef.current = state.planTier
  }, [state.isOwner, state.planTier, state.profile])

  React.useEffect(() => {
    if (!state.user?.id) return
    if (!state.profile) return
    writeProfileCache(state.user.id, state.profile, state.isOwner, state.planTier)
  }, [state.isOwner, state.planTier, state.profile, state.user?.id])

  const refreshProfile = React.useCallback(async () => {
    const user = state.user
    if (!user) {
      setState((s) => ({ ...s, profile: null, isOwner: false, planTier: "essential" }))
      return
    }
    try {
      const isOwnerFallback = lastProfileRef.current?.id === user.id ? lastIsOwnerRef.current : false
      const planTierFallback = lastProfileRef.current?.id === user.id ? lastPlanTierRef.current : "essential"
      let profile: Profile | null = null
      let isOwner = isOwnerFallback
      let planTier: PlanTier = planTierFallback
      try {
        const p = await withTimeout(fetchProfileWithClinic(user.id), 8000)
        profile = p as Profile | null
        if (p?.clinic_id) {
          isOwner = String(p.clinic?.owner_id ?? "") === String(user.id)
          planTier = normalizePlanTier(p.clinic?.plan_tier ?? planTierFallback)
        }
      } catch {
        profile = await fetchProfile(user.id)
      }
      setState((s) => ({ ...s, profile, isOwner, planTier }))
    } catch {
      const cached = readProfileCache(user.id)
      if (cached?.profile) {
        setState((s) => ({ ...s, profile: cached.profile, isOwner: cached.isOwner, planTier: cached.planTier }))
        return
      }
      if (lastProfileRef.current?.id === user.id && lastProfileRef.current) {
        setState((s) => ({ ...s, profile: lastProfileRef.current, isOwner: lastIsOwnerRef.current, planTier: lastPlanTierRef.current }))
        return
      }
      setState((s) => ({ ...s }))
    }
  }, [state.user])

  React.useEffect(() => {
    let mounted = true
    const hardTimeout = window.setTimeout(() => {
      if (!mounted) return
      setState((s) => ({ ...s, loading: false }))
    }, 12000)

    async function init() {
      const { data, error } = await withTimeout(supabase.auth.getSession(), 8000)
      if (error) throw error

      const session = data.session
      const user = session?.user ?? null
      const cached = user ? readProfileCache(user.id) : null
      if (user && cached?.profile) {
        setState((s) => ({ ...s, session, user, profile: cached.profile, isOwner: cached.isOwner, planTier: cached.planTier, loading: false }))
      }

      let profile!: Profile | null
      let profileWithClinic!: ProfileWithClinic | null
      if (user) {
        try {
          const p = await withTimeout(fetchProfileWithClinic(user.id), 8000)
          profileWithClinic = (p as ProfileWithClinic | null) as ProfileWithClinic | null
          profile = (profileWithClinic as Profile | null) as Profile | null
        } catch {
          profile = null
          profileWithClinic = null
        }
      } else {
        profile = null
        profileWithClinic = null
      }
      const lastForUser = user?.id && lastProfileRef.current?.id === user.id
      const isOwnerFallback = lastForUser ? lastIsOwnerRef.current : false
      const planTierFallback = lastForUser ? lastPlanTierRef.current : "essential"

      let finalProfile = profile
      let finalIsOwner = profileWithClinic?.clinic_id && user?.id ? String(profileWithClinic.clinic?.owner_id ?? "") === String(user.id) : isOwnerFallback
      let finalPlanTier = profileWithClinic?.clinic_id ? normalizePlanTier(profileWithClinic.clinic?.plan_tier ?? planTierFallback) : planTierFallback

      if (!finalProfile && user && cached?.profile) {
        finalProfile = cached.profile
        finalIsOwner = cached.isOwner
        finalPlanTier = cached.planTier
      }
      if (!finalProfile && lastForUser && lastProfileRef.current) {
        finalProfile = lastProfileRef.current
        finalIsOwner = lastIsOwnerRef.current
        finalPlanTier = lastPlanTierRef.current
      }

      if (!mounted) return
      setState({ session, user, profile: finalProfile, isOwner: finalIsOwner, planTier: finalPlanTier, loading: false })
    }

    init().catch(() => {
      if (!mounted) return
      setState({ session: null, user: null, profile: null, isOwner: false, planTier: "essential", loading: false })
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        if (!mounted) return
        clearProfileCache()
        setState({ session: null, user: null, profile: null, isOwner: false, planTier: "essential", loading: false })
        return
      }
      const user = session?.user ?? null
      let profileOk = false
      let profile: Profile | null = null
      let profileWithClinic: ProfileWithClinic | null = null
      if (user) {
        try {
          const p = await withTimeout(fetchProfileWithClinic(user.id), 8000)
          profileWithClinic = (p as ProfileWithClinic | null) as ProfileWithClinic | null
          profile = (profileWithClinic as Profile | null) as Profile | null
          profileOk = true
        } catch {
          profileOk = false
        }
      }
      if (user && profileOk && !profile) {
        const cached = readProfileCache(user.id)
        if (cached?.profile) {
          profile = cached.profile
          profileWithClinic = null
          profileOk = false
        }
      }
      if (user && !profileOk) {
        const fallback = lastProfileRef.current
        if (fallback && fallback.id === user.id) profile = fallback
        if (!profile) {
          const cached = readProfileCache(user.id)
          if (cached?.profile) profile = cached.profile
        }
      }
      const isOwner =
        profileWithClinic?.clinic_id && user?.id
          ? String(profileWithClinic.clinic?.owner_id ?? "") === String(user.id)
          : user && !profileOk && lastProfileRef.current?.id === user.id
            ? lastIsOwnerRef.current
            : false
      const planTier =
        profileWithClinic?.clinic_id
          ? normalizePlanTier(profileWithClinic.clinic?.plan_tier ?? (user && lastProfileRef.current?.id === user.id ? lastPlanTierRef.current : "essential"))
          : user && !profileOk && lastProfileRef.current?.id === user.id
            ? lastPlanTierRef.current
            : "essential"
      if (!mounted) return
      setState({ session, user, profile, isOwner, planTier, loading: false })
    })

    return () => {
      mounted = false
      window.clearTimeout(hardTimeout)
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = React.useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = React.useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }, [])

  const signOut = React.useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    clearProfileCache()
  }, [])

  const bootstrapClinic = React.useCallback(
    async (clinicName: string, fullName: string) => {
      const { error } = await supabase.rpc("bootstrap_clinic", { p_clinic_name: clinicName, p_full_name: fullName })
      if (error) throw error
      await refreshProfile()
    },
    [refreshProfile],
  )

  const value: AuthContextValue = {
    ...state,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    bootstrapClinic,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider")
  return ctx
}

export function roleIn(role: ProfileRole | null | undefined, allowed: readonly ProfileRole[]) {
  if (!role) return false
  return allowed.includes(role)
}

export function canAccess(role: ProfileRole | null | undefined, feature: "financeiro" | "equipe" | "configuracoes" | "procedimentos_write" | "pacientes_write" | "prontuario") {
  if (!role) return false
  if (role === "admin") return true
  if (feature === "equipe") return false
  if (feature === "configuracoes") return false
  if (feature === "financeiro") return role === "receptionist"
  if (feature === "procedimentos_write") return role === "dentist"
  if (feature === "pacientes_write") return role === "dentist" || role === "receptionist"
  if (feature === "prontuario") return role === "dentist"
  return false
}

export function planAllows(planTier: PlanTier | null | undefined, feature: "prontuario" | "retornos" | "financeiro") {
  const tier = planTier ?? "essential"
  if (tier === "management") return true
  if (tier === "clinic") return feature === "prontuario" || feature === "retornos"
  return false
}
