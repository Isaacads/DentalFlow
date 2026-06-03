// Shared helpers for the Kiwify webhook edge function.

export type PlanTier = "essential" | "clinic" | "management"

// Maps a Kiwify identifier (product_id or plan id) to a plan tier.
// Configure via the KIWIFY_PLAN_MAP env var, a JSON object such as:
//   {"prod_essential":"essential","prod_clinic":"clinic","prod_mgmt":"management"}
// The same map can hold product ids and/or subscription plan ids.
export function kiwifyPlanMap(): Record<string, PlanTier> {
  const raw = Deno.env.get("KIWIFY_PLAN_MAP")
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    const out: Record<string, PlanTier> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (value === "essential" || value === "clinic" || value === "management") out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

export function resolveTier(ids: Array<string | null | undefined>): PlanTier {
  const map = kiwifyPlanMap()
  for (const id of ids) {
    if (id && map[id]) return map[id]
  }
  return "essential"
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() },
  })
}

export function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D+/g, "")
}

// Verifies the Kiwify webhook signature: HMAC-SHA1 of the raw body using the
// account webhook token, delivered as the `signature` query parameter (hex).
export async function verifyKiwifySignature(rawBody: string, signature: string, token: string): Promise<boolean> {
  if (!signature || !token) return false
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  )
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody))
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("")
  return timingSafeEqual(expected, signature.trim().toLowerCase())
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
