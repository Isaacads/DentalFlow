export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "").slice(0, 11)
}

export function formatCpf(value: string) {
  const v = normalizeCpf(value)
  if (v.length <= 3) return v
  if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`
  if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`
  return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`
}

export function isValidCpf(value: string) {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11) return false
  if (/^(\d)\1+$/.test(cpf)) return false

  const digits = cpf.split("").map((c) => Number(c))
  let sum1 = 0
  for (let i = 0; i < 9; i++) sum1 += digits[i] * (10 - i)
  let d1 = 11 - (sum1 % 11)
  if (d1 >= 10) d1 = 0
  if (d1 !== digits[9]) return false

  let sum2 = 0
  for (let i = 0; i < 10; i++) sum2 += digits[i] * (11 - i)
  let d2 = 11 - (sum2 % 11)
  if (d2 >= 10) d2 = 0
  if (d2 !== digits[10]) return false

  return true
}
