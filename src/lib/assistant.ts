import { findListino } from '../../supabase/functions/_shared/listino'
import { versionTotals } from './calc'
import { DEFAULT_VERSIONS } from './quoteData'
import { supabase } from './supabase'
import type { Category, Quote, Section, Version } from './types'

// Stesso formato dello schema della funzione quote-assistant
export type DraftItem = {
  category: string
  catalogName: string
  job: string
  note: string
  qty: number
  days: number
  customUnitPrice: number | null
}

export type DraftVersion = {
  position: number
  name: string
  tagline: string
  productionFeePct: number
  targetTotal: number | null
  sectionNotes: { category: string; note: string }[]
  items: DraftItem[]
}

export type Draft = {
  title: string
  clientName: string
  clientVat: string
  clientAddress: string
  versions: DraftVersion[]
}

export type AssistantResult = { reply: string; openQuestions: string[]; quote: Draft }

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

const n = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0)

// La quotation attuale nel formato che Claude legge e restituisce
export function quoteToDraft(quote: Quote, versions: Version[]): Draft {
  return {
    title: quote.title,
    clientName: quote.client_name,
    clientVat: quote.client_vat ?? '',
    clientAddress: quote.client_address ?? '',
    versions: versions.map(v => {
      const total = versionTotals(v).total
      return {
        position: v.position,
        name: v.name,
        tagline: v.tagline ?? '',
        productionFeePct: Number(v.production_fee_pct),
        // Uno sconto vuol dire che il totale è stato fissato: lo ripassiamo come obiettivo
        targetTotal: Number(v.discount) > 0 ? Math.round(total * 100) / 100 : null,
        sectionNotes: v.sections.filter(s => s.note?.trim()).map(s => ({ category: s.category_code, note: s.note! })),
        items: v.sections.flatMap(s => s.items.map(i => {
          const entry = findListino(i.job)
          return {
            category: s.category_code,
            catalogName: entry?.name ?? '',
            job: i.job,
            note: i.note ?? '',
            qty: Number(i.qty),
            days: Number(i.days),
            customUnitPrice: entry && entry.dailyPrice === Number(i.unit_price) ? null : Number(i.unit_price),
          }
        })),
      }
    }),
  }
}

// Applica la bozza di Claude. I prezzi delle voci di listino vengono dal listino, mai dal modello.
export function draftToVersions(draft: Draft, cats: Category[], current: Version[]): Version[] {
  const byPosition = new Map<number, DraftVersion>()
  for (const dv of draft.versions) if (dv.position >= 1 && dv.position <= 3) byPosition.set(dv.position, dv)
  return [...byPosition.values()].sort((a, b) => a.position - b.position).map(dv => {
    const old = current.find(v => v.position === dv.position)
    const base = DEFAULT_VERSIONS.find(d => d.position === dv.position)!
    const sections: Section[] = cats.flatMap(cat => {
      const items = dv.items.filter(i => i.category === cat.code)
      const note = dv.sectionNotes.find(s => s.category === cat.code)?.note?.trim() || null
      if (!items.length && !note) return []
      return [{
        category_code: cat.code,
        note,
        extras: old?.sections.find(s => s.category_code === cat.code)?.extras ?? 0,
        items: items.map((i, idx) => {
          const entry = findListino(i.catalogName)
          return {
            position: idx,
            code: null,
            job: i.job || entry?.name || '—',
            note: i.note || null,
            qty: n(i.qty) || 1,
            days: n(i.days) || 1,
            unit_price: i.customUnitPrice !== null ? n(i.customUnitPrice) : entry?.dailyPrice ?? 0,
            nic_pct: entry?.defaultNic ?? 0,
            // Costo interno dal listino; le voci libere (budget) restano senza costo finché non lo metti a mano
            unit_cost: entry ? entry.dailyCost : null,
          }
        }),
      }]
    })
    const version: Version = {
      ...(old ?? {}),
      position: dv.position,
      name: dv.name || old?.name || base.name,
      tagline: dv.tagline || old?.tagline || base.tagline,
      production_fee_pct: Number.isFinite(dv.productionFeePct) ? dv.productionFeePct : 15,
      discount: 0,
      vat_pct: old?.vat_pct ?? 22,
      sections,
    }
    // Lo sconto porta la versione al totale chiesto (solo verso il basso)
    if (dv.targetTotal !== null) {
      const diff = versionTotals(version).total - dv.targetTotal
      version.discount = diff > 0 ? Math.round(diff * 100) / 100 : 0
    }
    return version
  })
}

export async function askAssistant(message: string, draft: Draft, history: ChatTurn[]): Promise<AssistantResult> {
  const { data, error } = await supabase.functions.invoke('quote-assistant', { body: { message, draft, history } })
  if (error) {
    // Il messaggio leggibile sta nel corpo della risposta della funzione
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(detail?.error ?? error.message)
  }
  if (!data?.result) throw new Error(data?.error ?? 'Risposta non valida dall\'assistente.')
  return data.result as AssistantResult
}

export function formatReply(r: AssistantResult) {
  if (!r.openQuestions.length) return r.reply
  return `${r.reply}\n\nDa confermare:\n${r.openQuestions.map(q => `• ${q}`).join('\n')}`
}
