import type { ParsedQuote } from './cerberoParser'
import type { Category, Quote, Version } from './types'
import { DEFAULT_VERSIONS } from './quoteData'
import { findListino } from '../../supabase/functions/_shared/listino'

// Trasforma un PDF letto nella versione della quotation (posizione 1, 2 o 3)
export function versionFromPdf(p: ParsedQuote, position: number, cats: Category[], name?: string): Version {
  const base = DEFAULT_VERSIONS.find(v => v.position === position)!
  return {
    position,
    name: name ?? base.name,
    tagline: p.versionLabel ? p.versionLabel[0].toUpperCase() + p.versionLabel.slice(1) : base.tagline,
    production_fee_pct: p.production_fee_pct,
    discount: p.discount,
    vat_pct: p.vat_pct,
    sections: p.sections.flatMap(s => {
      const cat = cats.find(c => c.letter === s.letter)
      if (!cat) return []
      return [{
        category_code: cat.code,
        note: s.note,
        extras: s.extras,
        items: s.items.map((i, idx) => ({ ...i, position: idx, unit_cost: findListino(i.job)?.dailyCost ?? null })),
      }]
    }),
  }
}

// Dati del cliente e del progetto presi dal PDF
export function headerFromPdf(p: ParsedQuote): Partial<Quote> {
  return {
    code: p.code,
    title: p.title || 'Quotation',
    client_name: p.client_name || 'Cliente',
    client_vat: p.client_vat,
    client_address: p.client_address,
    ...(p.quote_date ? { quote_date: p.quote_date } : {}),
    ...(p.validity_days ? { validity_days: p.validity_days } : {}),
  }
}
