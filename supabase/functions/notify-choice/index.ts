// Mail quando il cliente sceglie una versione: avviso a Chimera e conferma al cliente (via Resend).
// La chiama la pagina cliente subito dopo submit_quote_choice; manda una sola volta per scelta.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://jeck-svg.github.io/preventivi-chimera'
const FROM = Deno.env.get('MAIL_FROM') ?? 'Chimera Studio <onboarding@resend.dev>'
const NOTIFY_TO = (Deno.env.get('NOTIFY_TO') ?? 'jeck@chimerastudioss.com').split(',').map(s => s.trim()).filter(Boolean)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const n = (v: unknown) => Number(v) || 0
const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

type Item = { qty: number; days: number; unit_price: number; nic_pct: number }
type Section = { category_code: string; note: string | null; quote_items: Item[] }

function totals(v: { production_fee_pct: number; discount: number; vat_pct: number; quote_sections: Section[] }) {
  const sub = v.quote_sections.reduce((s, sec) => s + sec.quote_items.reduce((a, i) => a + n(i.qty) * n(i.days) * n(i.unit_price) * (1 + n(i.nic_pct) / 100), 0), 0)
  const total = sub + sub * n(v.production_fee_pct) / 100 - n(v.discount)
  return { total, totalVat: total * (1 + n(v.vat_pct) / 100) }
}

async function send(key: string, to: string[], subject: string, html: string, replyTo?: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  })
  return r.ok ? null : `${r.status} ${await r.text()}`
}

const shell = (body: string) => `<div style="font-family:Helvetica,Arial,sans-serif;color:#1d1b18;max-width:560px;margin:0 auto;padding:24px;background:#fefdf9">${body}<p style="color:#8a8378;font-size:12px;margin-top:32px">Chimera Studio · chimerastudioss.com</p></div>`

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
    .select('id, code, title, client_name, client_note, client_email, chosen_email, share_token, selected_version_id').maybeSingle()
  if (!q) return json({ sent: false })

  const [{ data: v }, { data: cats }] = await Promise.all([
    db.from('quote_versions').select('name, production_fee_pct, discount, vat_pct, quote_sections(category_code, note, quote_items(qty, days, unit_price, nic_pct))').eq('id', q.selected_version_id).single(),
    db.from('categories').select('code, name'),
  ])
  if (!v) return json({ sent: false })
  const t = totals(v as never)
  const catName = (c: string) => cats?.find(x => x.code === c)?.name ?? c
  const included = (v.quote_sections as Section[]).filter(s => s.quote_items.length || s.note?.trim())
  const list = included.map(s => `<li><strong>${esc(catName(s.category_code))}</strong>${s.note ? ` · ${esc(s.note)}` : ''}</li>`).join('')
  const head = `${q.code ? `${esc(q.code)} · ` : ''}${esc(q.title)}`
  const clientEmail = q.chosen_email ?? q.client_email
  const errors: string[] = []

  const toChimera = shell(`
    <p style="font-size:12px;font-weight:700;letter-spacing:.04em;color:#5b2a78">QUOTATION APPROVATA</p>
    <h1 style="font-size:24px;margin:8px 0">${esc(q.client_name ?? 'Il cliente')} ha scelto ${esc(v.name)}</h1>
    <p style="font-size:18px;margin:0 0 16px"><strong>${eur.format(t.total)}</strong> +IVA · ${eur.format(t.totalVat)} IVA inclusa</p>
    <p style="margin:0 0 8px">${head}</p>
    <ul>${list}</ul>
    ${q.client_note ? `<p><strong>Nota del cliente:</strong><br>${esc(q.client_note).replace(/\n/g, '<br>')}</p>` : ''}
    ${clientEmail ? `<p>Email del cliente: <a href="mailto:${esc(clientEmail)}">${esc(clientEmail)}</a></p>` : '<p>Il cliente non ha lasciato la sua email.</p>'}
    <p><a href="${APP_URL}/quotation/${q.id}" style="display:inline-block;background:#df84ff;color:#1d1b18;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">Apri la quotation</a></p>`)
  const e1 = await send(key, NOTIFY_TO, `✅ ${q.client_name ?? 'Cliente'} ha scelto ${v.name} · ${q.title}`, toChimera, clientEmail ?? undefined)
  if (e1) errors.push(`chimera: ${e1}`)

  if (clientEmail) {
    const toClient = shell(`
      <p style="font-size:12px;font-weight:700;letter-spacing:.04em;color:#5b2a78">SCELTA RICEVUTA</p>
      <h1 style="font-size:24px;margin:8px 0">Grazie! Hai scelto ${esc(v.name)}</h1>
      <p style="margin:0 0 8px">${head}</p>
      <p style="font-size:18px;margin:0 0 16px"><strong>${eur.format(t.total)}</strong> +IVA · ${eur.format(t.totalVat)} IVA inclusa</p>
      <ul>${list}</ul>
      <p>Il tuo account Chimera ti ricontatta a breve per la conferma d'ordine e i prossimi passi.</p>
      <p><a href="${APP_URL}/p/${q.share_token}" style="color:#5b2a78">Rivedi la quotation</a></p>`)
    const e2 = await send(key, [clientEmail], `Abbiamo ricevuto la tua scelta · ${q.title}`, toClient, NOTIFY_TO[0])
    if (e2) errors.push(`cliente: ${e2}`)
  }
  if (errors.length) console.error(errors.join(' | '))
  return json({ sent: true, errors })
})
