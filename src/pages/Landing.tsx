import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarDays, Check, ClipboardList, CreditCard, Globe, MessageCircle, Sparkles, Users } from "lucide-react"
import logoDentalFlow from "@/assets/logoDentalFlow.png"

const features = [
  { icon: CalendarDays, title: "Agenda por profissional", desc: "Semana com cores por dentista, status (Agendada/Confirmada/Realizada) e bloqueios de horário." },
  { icon: Globe, title: "Agendamento online", desc: "Página pública para paciente solicitar horários ou autoagendar, configurável pela clínica." },
  { icon: MessageCircle, title: "WhatsApp com mensagem pronta", desc: "Envio manual via wa.me com texto pronto e links para confirmar/cancelar (RSVP)." },
  { icon: ClipboardList, title: "Prontuário e odontograma", desc: "Registro clínico com odontograma, anamnese estruturada e anexos (imagem/PDF)." },
  { icon: CreditCard, title: "Financeiro e cobranças", desc: "Receitas/despesas, status (Pendente/Pago/Vencido) e exportação CSV." },
  { icon: Users, title: "Equipe e permissões", desc: "Acesso por função (admin, dentista, recepção, auxiliar) e separação por clínica (RLS)." },
]

const plans = [
  {
    name: "Essencial",
    tag: "PARA COMEÇAR",
    price: "R$ 69",
    period: "/mês",
    details: [
      "Agenda por profissional (semana, status e bloqueios)",
      "Pacientes (cadastro, busca e ficha)",
      "Procedimentos (duração e preço base)",
      "Agendamento online (opcional) e WhatsApp com mensagem pronta",
      "Até 2 usuários por clínica",
    ],
    highlight: false,
    cta: "Comprar",
    href: "https://pay.kiwify.com.br/H5dS2gh",
  },
  {
    name: "Clínica",
    tag: "MAIS POPULAR",
    price: "R$ 119",
    period: "/mês",
    details: [
      "Tudo do Essencial",
      "Prontuário eletrônico + odontograma",
      "Anamnese estruturada e documentos/anexos (imagem/PDF)",
      "Retornos: lista de pacientes com retorno pendente",
      "Até 3 usuários por clínica",
    ],
    highlight: true,
    cta: "Comprar",
    href: "https://pay.kiwify.com.br/sFrgbbp",
  },
  {
    name: "Gestão",
    tag: "PARA CLÍNICAS QUE CRESCEM",
    price: "R$ 179",
    period: "/mês",
    details: [
      "Tudo do Clínica",
      "Financeiro: receitas/despesas + status (Pendente/Pago/Vencido/Cancelado)",
      "Gerar cobrança ao marcar consulta como Realizada",
      "Exportação CSV",
      "Usuários ilimitados por clínica",
    ],
    highlight: false,
    cta: "Comprar",
    href: "https://pay.kiwify.com.br/PcLem1U",
  },
]

export function Landing() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-0.5">
            <div className="flex h-16 w-16 items-center justify-center">
              <img src={logoDentalFlow} alt="AMMI DentalFlow" className="h-14 w-auto" />
            </div>
            <div className="text-sm font-semibold">AMMI DentalFlow</div>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a className="hover:text-foreground" href="#funcionalidades">
              Funcionalidades
            </a>
            <a className="hover:text-foreground" href="#planos">
              Planos
            </a>
            <a className="hover:text-foreground" href="#seguranca">
              Segurança
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/login">Entrar</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4">
        <section className="grid gap-10 py-12 lg:grid-cols-2 lg:py-16">
          <div className="grid gap-5">
            <div>
              <Badge variant="warning" className="bg-warning/15 text-foreground">
                <span className="px-2 py-1 text-base font-semibold tracking-wide sm:text-lg">SOFTWARE ODONTOLÓGICO</span>
              </Badge>
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Gerencie sua clínica com <span className="text-accent">inteligência</span> e praticidade
            </h1>
            <p className="text-pretty text-base text-muted-foreground sm:text-lg">
              O <span className="font-semibold text-foreground">AMMI DentalFlow</span> reúne agenda, pacientes, procedimentos, prontuário, retornos e financeiro (por plano) em um único sistema.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="lg">
                <a href="#planos">Ver planos</a>
              </Button>
            </div>
            <div className="grid gap-2 rounded-xl border bg-card p-4 text-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-warning" />
                <span className="font-medium">Feito para o fluxo real de uma clínica</span>
              </div>
              <div className="text-muted-foreground">Agenda, confirmação via WhatsApp, prontuário com anexos e controle por usuário — com separação por clínica.</div>
            </div>
          </div>

          <div className="grid content-start gap-4">
            <div className="grid gap-3 rounded-2xl border bg-card p-6 shadow-soft">
              <div className="grid grid-cols-2 gap-3">
                {features.slice(0, 4).map((f) => {
                  const Icon = f.icon
                  return (
                    <div key={f.title} className="rounded-xl border bg-background p-4">
                      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="text-sm font-medium">{f.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{f.desc}</div>
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {features.slice(4).map((f) => {
                  const Icon = f.icon
                  return (
                    <div key={f.title} className="rounded-xl border bg-background p-4">
                      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="text-sm font-medium">{f.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{f.desc}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="funcionalidades" className="grid gap-6 py-10">
          <div className="grid gap-2">
            <div className="text-sm font-medium text-muted-foreground">Tudo em um só lugar</div>
            <div className="text-2xl font-semibold tracking-tight">Funcionalidades que aceleram sua rotina</div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <Card key={f.title}>
                  <CardHeader className="pb-3">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{f.desc}</CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section id="planos" className="grid gap-6 py-10">
          <div className="text-center">
            <div className="text-2xl font-semibold tracking-tight">Escolha seu plano</div>
            <div className="text-sm text-muted-foreground">Três níveis por maturidade: do básico ao controle completo da clínica.</div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((p) => (
              <Card key={p.name} className={p.highlight ? "border-warning shadow-soft" : ""}>
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-muted-foreground">{p.tag}</div>
                    {p.highlight ? <Badge variant="warning">Mais popular</Badge> : null}
                  </div>
                  <CardTitle className="text-xl">{p.name}</CardTitle>
                  <div className="flex items-end gap-2">
                    <div className="text-3xl font-semibold text-warning">{p.price}</div>
                    <div className="pb-1 text-sm text-muted-foreground">{p.period}</div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-2">
                    {p.details.map((d) => (
                      <div key={d} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-accent" />
                        <span className="text-muted-foreground">{d}</span>
                      </div>
                    ))}
                  </div>
                  <Button asChild variant={p.highlight ? "default" : "outline"}>
                    <a href={p.href}>
                      {p.cta}
                    </a>
                  </Button>
                  <div className="text-xs text-muted-foreground">Acesso liberado após login. Planos comerciais podem ser configurados na venda.</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="seguranca" className="grid gap-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Segurança e privacidade</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-accent" />
                <div>Isolamento por clínica com Row Level Security (RLS).</div>
              </div>
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-accent" />
                <div>Controle de acesso por função (admin, dentista, recepção, auxiliar).</div>
              </div>
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-accent" />
                <div>Armazenamento de anexos com políticas por clínica.</div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span>© {new Date().getFullYear()} AMMI DentalFlow</span>
            <span>•</span>
            <span>ammisoftware@outlook.com</span>
          </div>
          <div className="flex items-center gap-3">
            <a className="hover:text-foreground" href="#planos">
              Planos
            </a>
            <Link className="hover:text-foreground" to="/login">
              Entrar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
