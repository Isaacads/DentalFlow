import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

type InvitePayload = {
  email: string
  fullName: string
  role: "admin" | "dentist" | "receptionist" | "assistant"
  cro?: string | null
  specialty?: string | null
  phone?: string | null
  color?: string | null
  active?: boolean | null
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true })
  if (req.method !== "POST") return json(405, { error: "Método não permitido." })

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Supabase não configurado no servidor." })

  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : ""
  if (!token) return json(401, { error: "Não autenticado." })

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: authData, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !authData?.user) return json(401, { error: "Sessão inválida." })

  const requesterId = authData.user.id
  const { data: requesterProfile, error: requesterErr } = await admin
    .from("profiles")
    .select("id,clinic_id,role")
    .eq("id", requesterId)
    .maybeSingle()

  if (requesterErr || !requesterProfile?.clinic_id) return json(403, { error: "Perfil da clínica não encontrado." })
  if (requesterProfile.role !== "admin") return json(403, { error: "Apenas administradores podem cadastrar usuários." })

  const { data: clinicRow, error: clinicErr } = await admin
    .from("clinics")
    .select("owner_id")
    .eq("id", requesterProfile.clinic_id)
    .maybeSingle()
  if (clinicErr) return json(400, { error: clinicErr.message })
  const isOwner = String((clinicRow as { owner_id?: unknown } | null)?.owner_id ?? "") === requesterId

  let payload: InvitePayload
  try {
    payload = (await req.json()) as InvitePayload
  } catch {
    return json(400, { error: "JSON inválido." })
  }

  const email = String(payload.email ?? "").trim().toLowerCase()
  const fullName = String(payload.fullName ?? "").trim()
  const role = payload.role

  const allowedRoles = new Set(["admin", "dentist", "receptionist", "assistant"])
  if (!email || !email.includes("@")) return json(400, { error: "E-mail inválido." })
  if (fullName.length < 2) return json(400, { error: "Nome inválido." })
  if (!allowedRoles.has(role)) return json(400, { error: "Função inválida." })
  if (role === "admin" && !isOwner) return json(403, { error: "Apenas o titular da clínica pode cadastrar administradores." })

  const redirectTo = `${req.headers.get("origin") ?? ""}/login`
  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (inviteErr || !inviteData?.user) return json(400, { error: inviteErr?.message ?? "Falha ao convidar usuário." })

  const userId = inviteData.user.id
  const profileRow = {
    id: userId,
    clinic_id: requesterProfile.clinic_id,
    full_name: fullName,
    role,
    cro: payload.cro ? String(payload.cro).trim() : null,
    specialty: payload.specialty ? String(payload.specialty).trim() : null,
    phone: payload.phone ? String(payload.phone).trim() : null,
    color: payload.color ? String(payload.color).trim() : null,
    active: payload.active == null ? true : Boolean(payload.active),
    avatar_url: null,
  }

  const { data: savedProfile, error: saveErr } = await admin.from("profiles").upsert(profileRow, { onConflict: "id" }).select("*").single()
  if (saveErr) return json(400, { error: saveErr.message })

  return json(200, { profile: savedProfile })
})
