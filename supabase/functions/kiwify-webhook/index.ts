// Receives Kiwify webhook events. Public endpoint (verify_jwt = false): security
// comes from verifying the Kiwify HMAC signature. Idempotent via billing_events.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"
import { corsHeaders, json, onlyDigits, resolveTier, verifyKiwifySignature } from "../_shared/kiwify.ts"

const PROVIDER = "kiwify"

// Kiwify event types that confirm a successful (paid/approved) purchase.
const PAID_EVENTS = new Set(["order_approved", "order_paid", "subscription_renewed"])
// Event types that indicate a late / failed subscription charge.
const LATE_EVENTS = new Set(["subscription_late", "subscription_canceled", "order_refunded", "chargeback"])

type KiwifyPayload = {
  order_id?: string
  order_status?: string
  webhook_event_type?: string
  Customer?: { full_name?: string; first_name?: string; email?: string; CPF?: string; mobile?: string }
  Product?: { product_id?: string; product_name?: string }
  Subscription?: { id?: string; status?: string; plan?: { id?: string; name?: string } }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() })
  if (req.method !== "POST") return json(405, { error: "Método não permitido." })

  const token = Deno.env.get("KIWIFY_WEBHOOK_TOKEN") ?? ""
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!token || !supabaseUrl || !serviceRoleKey) return json(500, { error: "Servidor não configurado." })

  const raw = await req.text()
  const url = new URL(req.url)
  const signature = url.searchParams.get("signature") ?? req.headers.get("x-kiwify-signature") ?? ""
  const valid = await verifyKiwifySignature(raw, signature, token)
  if (!valid) return json(401, { error: "Assinatura inválida." })

  let payload: KiwifyPayload
  try {
    payload = JSON.parse(raw) as KiwifyPayload
  } catch {
    return json(400, { error: "JSON inválido." })
  }

  const eventType = String(payload.webhook_event_type ?? payload.order_status ?? "").trim()
  const orderId = String(payload.order_id ?? "").trim()
  const subscriptionId = String(payload.Subscription?.id ?? "").trim() || null
  const dedupeId = `${orderId || subscriptionId || crypto.randomUUID()}:${eventType}`

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  // Idempotency: insert the event key; a conflict means it was already processed.
  const { error: dupError } = await admin.from("billing_events").insert({ id: dedupeId, type: eventType })
  if (dupError) return json(200, { received: true, duplicate: true })

  try {
    if (PAID_EVENTS.has(eventType) || payload.order_status === "paid" || payload.order_status === "approved") {
      await handlePaid(admin, payload, subscriptionId)
    } else if (LATE_EVENTS.has(eventType)) {
      if (subscriptionId) {
        await admin.rpc("set_clinic_payment_status_by_subscription", {
          p_billing_subscription_id: subscriptionId,
          p_status: "past_due",
        })
      }
    }
  } catch (e) {
    console.error("kiwify-webhook handler error", e)
    return json(500, { error: e instanceof Error ? e.message : "Erro ao processar o evento." })
  }

  return json(200, { received: true })
})

async function handlePaid(admin: SupabaseClient, payload: KiwifyPayload, subscriptionId: string | null) {
  const customer = payload.Customer ?? {}
  const email = String(customer.email ?? "").trim().toLowerCase()
  if (!email) throw new Error("E-mail ausente no payload da Kiwify.")

  const document = onlyDigits(customer.CPF)
  const fullName = String(customer.full_name ?? customer.first_name ?? "").trim() || email.split("@")[0]
  const tier = resolveTier([payload.Subscription?.plan?.id, payload.Product?.product_id])
  const password = document.length >= 8 ? document : null

  // Create the auth user (or recover it if it already exists).
  let userId = ""
  const created = await admin.auth.admin.createUser({
    email,
    password: password ?? undefined,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (created.error) {
    const existingId = await findUserIdByEmail(admin, email)
    if (!existingId) throw new Error(`Falha ao criar/encontrar usuário: ${created.error.message}`)
    userId = existingId
  } else {
    userId = created.data.user?.id ?? ""
  }
  if (!userId) throw new Error("ID do usuário ausente após a criação.")

  const { error: rpcError } = await admin.rpc("provision_paid_clinic", {
    p_user_id: userId,
    p_clinic_name: "Minha Clínica",
    p_full_name: fullName,
    p_plan_tier: tier,
    p_billing_provider: PROVIDER,
    p_billing_subscription_id: subscriptionId,
  })
  if (rpcError) throw new Error(`Falha ao provisionar clínica: ${rpcError.message}`)

  await sendWelcomeEmail(email, document).catch(() => {})
}

async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data?.users?.length) return null
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email)
    if (found) return found.id
    if (data.users.length < 200) return null
  }
  return null
}

async function sendWelcomeEmail(email: string, document: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? ""
  if (!apiKey) return
  const from = Deno.env.get("RESEND_FROM") ?? "AMMI DentalFlow <onboarding@resend.dev>"
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "")
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Bem-vindo(a) ao AMMI DentalFlow — seus dados de acesso",
      html: `
        <p>Olá! Sua compra foi confirmada e seu acesso ao AMMI DentalFlow está pronto.</p>
        <p><strong>Seus dados de acesso:</strong></p>
        <ul>
          <li>E-mail: ${email}</li>
          <li>Senha inicial: o número do seu documento (CPF, ${document.length} dígitos, sem pontuação)</li>
        </ul>
        <p>Recomendamos alterar a senha após o primeiro acesso.</p>
        ${appUrl ? `<p><a href="${appUrl}/login">Acessar o sistema</a></p>` : ""}
      `,
    }),
  })
}
