import { supabase } from './supabase'
import type { Category, Quote, Reference, Version, Work, PublicQuote } from './types'

export const DEFAULT_VERSIONS = [
  { position: 1, name: 'Essential', tagline: "L'essenziale per partire" },
  { position: 2, name: 'Signature', tagline: 'La scelta che consigliamo' },
  { position: 3, name: 'Premium', tagline: 'Tutto, al massimo livello' },
]

export async function loadCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('position')
  if (error) throw error
  return data
}

export async function loadQuote(id: string) {
  const { data: quote, error } = await supabase.from('quotes').select('*').eq('id', id).single()
  if (error) throw error
  const { data: versions, error: vErr } = await supabase
    .from('quote_versions')
    .select('*, sections:quote_sections(*, items:quote_items(*))')
    .eq('quote_id', id)
    .order('position')
  if (vErr) throw vErr
  const { data: picked } = await supabase.from('quote_works').select('work_id').eq('quote_id', id)
  const { data: refs } = await supabase.from('quote_references').select('*').eq('quote_id', id).order('position').order('created_at')
  for (const v of versions) v.references = (refs ?? []).filter(r => r.version_position === v.position) as Reference[]
  for (const v of versions) for (const s of v.sections) s.items.sort((a: { position: number }, b: { position: number }) => a.position - b.position)
  return {
    quote: quote as Quote,
    versions: versions as (Version & { id: string })[],
    pickedWorks: (picked ?? []).map(p => p.work_id as string),
  }
}

export async function createQuote(fields: Partial<Quote>) {
  const { data, error } = await supabase.from('quotes').insert(fields).select().single()
  if (error) throw error
  const { error: vErr } = await supabase
    .from('quote_versions')
    .insert(DEFAULT_VERSIONS.map(v => ({ ...v, quote_id: data.id })))
  if (vErr) throw vErr
  return data as Quote
}

// Salva testata, versioni, sezioni e voci. Le sezioni vengono riscritte da zero a ogni salvataggio.
// Le richieste sono raggruppate e le versioni salvate in parallelo, così il salvataggio resta veloce.
export async function saveQuote(quote: Quote, versions: Version[], pickedWorks: string[]) {
  const { id, code, title, client_name, client_vat, client_address, client_email, intro, services, quote_date, validity_days } = quote
  const header = supabase
    .from('quotes')
    .update({ code, title, client_name, client_vat, client_address, client_email: client_email?.trim() || null, intro, services, quote_date, validity_days })
    .eq('id', id)
    .then(check)
  const works = supabase.from('quote_works').delete().eq('quote_id', id).then(check).then(() =>
    pickedWorks.length
      ? supabase.from('quote_works').insert(pickedWorks.map(work_id => ({ quote_id: id, work_id }))).then(check)
      : undefined,
  )
  await Promise.all([header, works, ...versions.map(v => saveVersion(id, v))])
}

function check<T extends { error: unknown }>(res: T) {
  if (res.error) throw res.error
  return res
}

async function saveVersion(quoteId: string, v: Version) {
  const { data: saved } = check(
    await supabase
      .from('quote_versions')
      .upsert({
        quote_id: quoteId,
        position: v.position,
        name: v.name,
        tagline: v.tagline,
        production_fee_pct: v.production_fee_pct,
        discount: v.discount,
        vat_pct: v.vat_pct,
      }, { onConflict: 'quote_id,position' })
      .select('id')
      .single(),
  )
  check(await supabase.from('quote_sections').delete().eq('version_id', saved!.id))

  const keep = v.sections.filter(s => s.items.length > 0 || s.note?.trim() || Number(s.extras))
  if (!keep.length) return
  const { data: sections } = check(
    await supabase
      .from('quote_sections')
      .insert(keep.map(s => ({ version_id: saved!.id, category_code: s.category_code, note: s.note || null, extras: Number(s.extras) || 0 })))
      .select('id, category_code'),
  )
  const items = keep.flatMap(s => {
    const sectionId = sections!.find(x => x.category_code === s.category_code)!.id
    return s.items.map((i, idx) => ({
      section_id: sectionId,
      position: idx,
      code: i.code || null,
      job: i.job || '—',
      note: i.note || null,
      qty: Number(i.qty) || 0,
      days: Number(i.days) || 0,
      unit_price: Number(i.unit_price) || 0,
      nic_pct: Number(i.nic_pct) || 0,
    }))
  })
  if (items.length) check(await supabase.from('quote_items').insert(items))
}

export async function loadWorks(): Promise<Work[]> {
  const { data, error } = await supabase.from('works').select('*').order('featured', { ascending: false }).order('position')
  if (error) throw error
  return data
}

// Ricostruisce lo stesso formato della vista pubblica, per l'anteprima dell'account
export async function buildPreview(id: string): Promise<PublicQuote> {
  const [{ quote, versions, pickedWorks }, categories, works] = await Promise.all([loadQuote(id), loadCategories(), loadWorks()])
  const used = new Set(versions.flatMap(v => v.sections.filter(s => s.items.length || s.note?.trim()).map(s => s.category_code)))
  const shown = pickedWorks.length
    ? works.filter(w => pickedWorks.includes(w.id))
    : quote.services?.length
      ? works.filter(w => w.service && quote.services.includes(w.service))
      : works.filter(w => w.categories.some(c => used.has(c)))
  return { quote, categories, versions, works: shown }
}

// Carica un file (immagine o video) nello storage e restituisce il link pubblico
export async function uploadMedia(file: File, folder: string) {
  const path = `${folder}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`
  const { error } = await supabase.storage.from('works').upload(path, file, { contentType: file.type })
  if (error) throw error
  return supabase.storage.from('works').getPublicUrl(path).data.publicUrl
}

export async function addReference(ref: Omit<Reference, 'id'> & { quote_id: string; version_position: number }) {
  const { data, error } = await supabase.from('quote_references').insert(ref).select().single()
  if (error) throw error
  return data as Reference
}

export async function deleteReference(id: string) {
  const { error } = await supabase.from('quote_references').delete().eq('id', id)
  if (error) throw error
}
