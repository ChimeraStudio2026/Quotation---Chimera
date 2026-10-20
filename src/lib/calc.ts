import type { Item, Section, Version } from './types'

const n = (v: unknown) => Number(v) || 0

export const itemTotal = (i: Item) => n(i.qty) * n(i.days) * n(i.unit_price) * (1 + n(i.nic_pct) / 100)

export const sectionTotal = (s: Section) => s.items.reduce((sum, i) => sum + itemTotal(i), 0)

// Costo interno di una voce; null se non è stato indicato (voce libera senza costo)
export const itemCost = (i: Item) => (i.unit_cost === null || i.unit_cost === undefined ? null : n(i.qty) * n(i.days) * n(i.unit_cost))

// Margine di una versione: totale venduto (fee e sconto compresi, IVA esclusa) meno i costi interni
export function versionMargin(v: Version) {
  const items = v.sections.flatMap(s => s.items)
  const cost = items.reduce((sum, i) => sum + (itemCost(i) ?? 0), 0)
  const missingCost = items.filter(i => itemCost(i) === null).length
  const { total } = versionTotals(v)
  const margin = total - cost
  return { cost, margin, marginPct: total > 0 ? margin / total : 0, missingCost }
}

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
