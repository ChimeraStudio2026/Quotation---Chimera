// Mail quando il cliente sceglie una versione: avviso a Chimera e conferma al cliente (via Resend).
// La chiama la pagina cliente subito dopo submit_quote_choice; manda una sola volta per scelta.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { clientMail, teamMail, type MailData } from './mail.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://quotation.chimerastudioss.com'
const FROM = Deno.env.get('MAIL_FROM') ?? 'Chimera Studio <chimera@chimerastudioss.com>'
// Finché chimerastudioss.com non è verificato su Resend si usa il mittente di prova
const FALLBACK_FROM = 'Chimera Studio <onboarding@resend.dev>'
const NOTIFY_TO = (Deno.env.get('NOTIFY_TO') ?? 'jeck@chimerastudioss.com').split(',').map(s => s.trim()).filter(Boolean)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const n = (v: unknown) => Number(v) || 0
const eurRound = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions)

type Item = { qty: number; days: number; unit_price: number; nic_pct: number }
type Section = { category_code: string; note: string | null; quote_items: Item[] }
type Version = { name: string; position: number; tagline: string | null; production_fee_pct: number; discount: number; vat_pct: number; quote_sections: Section[] }

const sectionTotal = (s: Section) => s.quote_items.reduce((a, i) => a + n(i.qty) * n(i.days) * n(i.unit_price) * (1 + n(i.nic_pct) / 100), 0)

function totals(v: Version) {
  const sub = v.quote_sections.reduce((s, sec) => s + sectionTotal(sec), 0)
  const total = sub + sub * n(v.production_fee_pct) / 100 - n(v.discount)
  return { total, totalVat: total * (1 + n(v.vat_pct) / 100) }
}

async function send(key: string, to: string[], subject: string, html: string, replyTo?: string) {
  const post = (from: string) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  })
  let r = await post(FROM)
  if (r.status === 403 && /not verified/i.test(await r.clone().text())) r = await post(FALLBACK_FROM)
  return r.ok ? null : `${r.status} ${await r.text()}`
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return json({ error: 'RESEND_API_KEY mancante' }, 500)
  const { token } = await req.json().catch(() => ({}))
  if (typeof token !== 'string' || token.length < 16) return json({ error: 'token' }, 400)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  // Prendo la scelta solo se è appena stata fatta e non è già stata notificata
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: q } = await db.from('quotes').update({ notified_at: new Date().toISOString() })
    .eq('share_token', token).is('notified_at', null).gt('selected_at', since).not('selected_version_id', 'is', null)
    .select('id, code, title, client_name, client_note, client_email, chosen_email, share_token, selected_version_id, selected_at, services').maybeSingle()
  if (!q) return json({ sent: false })

  const [{ data: v }, { data: cats }, { data: picked }, { data: allWorks }] = await Promise.all([
    db.from('quote_versions').select('name, position, tagline, production_fee_pct, discount, vat_pct, quote_sections(category_code, note, quote_items(qty, days, unit_price, nic_pct))').eq('id', q.selected_version_id).single(),
    db.from('categories').select('code, name, position'),
    db.from('quote_works').select('work_id').eq('quote_id', q.id),
    db.from('works').select('id, brand, title, poster_url, link_url, service, featured, position').not('poster_url', 'is', null).order('featured', { ascending: false }).order('position'),
  ])
  if (!v) return json({ sent: false })
  const version = v as unknown as Version
  const t = totals(version)
  const cat = (c: string) => cats?.find(x => x.code === c)
  const items = version.quote_sections
    .filter(s => s.quote_items.length || s.note?.trim())
    .sort((a, b) => (cat(a.category_code)?.position ?? 0) - (cat(b.category_code)?.position ?? 0))
    .map(s => ({ name: cat(s.category_code)?.name ?? s.category_code, note: s.note, price: sectionTotal(s) || null }))

  // Lavori: quelli scelti a mano, altrimenti quelli dei servizi della quotation
  const ids = (picked ?? []).map(p => p.work_id)
  const services: string[] = q.services ?? []
  const works = (allWorks ?? []).filter(w => (ids.length ? ids.includes(w.id) : !services.length || services.includes(w.service))).slice(0, 3)

  const clientEmail = q.chosen_email ?? q.client_email
  const data: MailData = {
    appUrl: APP_URL, code: q.code, title: q.title, clientName: q.client_name ?? 'Il cliente', clientEmail, clientNote: q.client_note,
    versionName: version.name, versionPosition: version.position, tagline: version.tagline, total: t.total, totalVat: t.totalVat,
    items, works, quoteUrl: `${APP_URL}/quotation/${q.id}`, publicUrl: `${APP_URL}/p/${q.share_token}`, chosenAt: new Date(q.selected_at),
  }
  const errors: string[] = []

  const e1 = await send(key, NOTIFY_TO, `✅ ${data.clientName} ha scelto ${version.name} · ${q.title} · ${eurRound.format(t.total)}`, teamMail(data), clientEmail ?? undefined)
  if (e1) errors.push(`chimera: ${e1}`)

  if (clientEmail) {
    const e2 = await send(key, [clientEmail], `Abbiamo ricevuto la tua scelta · ${q.title}`, clientMail(data), NOTIFY_TO[0])
    if (e2) errors.push(`cliente: ${e2}`)
  }
  if (errors.length) console.error(errors.join(' | '))
  return json({ sent: true, errors })
})
