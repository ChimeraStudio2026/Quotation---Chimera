import type { Item, Section, Version } from './types'

const n = (v: unknown) => Number(v) || 0

export const itemTotal = (i: Item) => n(i.qty) * n(i.days) * n(i.unit_price) * (1 + n(i.nic_pct) / 100)

export const sectionTotal = (s: Section) => s.items.reduce((sum, i) => sum + itemTotal(i), 0)

export function versionTotals(v: Version) {
  const subtotal = v.sections.reduce((sum, s) => sum + sectionTotal(s), 0)
  const extras = v.sections.reduce((sum, s) => sum + n(s.extras), 0)
  const fee = subtotal * n(v.production_fee_pct) / 100
  const total = subtotal + fee - n(v.discount)
  const totalVat = total * (1 + n(v.vat_pct) / 100)
  return { subtotal, extras, fee, total, totalVat }
}

// Una sezione è "inclusa" se ha voci o una nota
export const isIncluded = (s: Section) => s.items.length > 0 || !!s.note?.trim()

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
const eurRound = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export const money = (v: number) => eur.format(v)
export const moneyRound = (v: number) => eurRound.format(v)

export const fmtDate = (d: string) => new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
