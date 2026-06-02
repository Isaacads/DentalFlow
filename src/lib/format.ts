import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export function formatDate(iso: string) {
  return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR })
}

export function formatDateTime(iso: string) {
  return format(new Date(iso), "dd/MM 'às' HH:mm", { locale: ptBR })
}

export function formatDateTimeWithYear(iso: string) {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function formatMoneyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}
