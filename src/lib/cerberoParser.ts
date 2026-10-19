// Lettura dei preventivi PDF esportati da Cerbero.
// Riceve il testo di ogni pagina con le coordinate (da pdf.js) e ricostruisce testata, sezioni A–O e voci.
// Logica pura, senza dipendenze: si prova anche fuori dal browser.

export type Tok = { x: number; y: number; h: number; s: string }
export type PdfPage = { width: number; height: number; toks: Tok[] }

export type ParsedItem = { code: string | null; job: string; note: string | null; qty: number; days: number; unit_price: number; nic_pct: number }
export type ParsedSection = { letter: string; note: string | null; extras: number; items: ParsedItem[]; summary?: { name: string | null; price: number }; noteUnreadable?: { page: number; x0: number; x1: number; y: number; h: number } }
export type ParsedQuote = {
  code: string | null
  title: string
  versionLabel: string | null
  client_name: string | null
  client_vat: string | null
  client_address: string | null
  quote_date: string | null
  validity_days: number | null
  production_fee_pct: number
  discount: number
  vat_pct: number
  totals: { subtotal: number | null; total: number | null; totalVat: number | null }
  sections: ParsedSection[]
  warnings: string[]
}

// Le righe del riepilogo Cerbero, sempre in quest'ordine
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M', 'N', 'O']

type Line = { y: number; toks: Tok[]; text: string }

function lines(page: PdfPage): Line[] {
  const sorted = page.toks.filter(t => t.s.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
  const out: Line[] = []
  for (const t of sorted) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.y - t.y) <= 4) last.toks.push(t)
    else out.push({ y: t.y, toks: [t], text: '' })
  }
  for (const l of out) {
    l.toks.sort((a, b) => a.x - b.x)
    l.text = l.toks.map(t => t.s.trim()).join(' ')
  }
  return out
}

// "4.500,00 €" → 4500 ; "15%" → 15 ; "-51,25 €" → -51.25
export function num(s: string | undefined | null): number | null {
  if (!s) return null
  const m = s.replace(/\s/g, '').match(/-?[\d.]*\d(,\d+)?/)
  if (!m) return null
  const v = Number(m[0].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(v) ? v : null
}

const isNum = (s: string) => /^-?[\d.]+(,\d+)?\s*(€|%)?$/.test(s.trim())

function valueAfter(line: Line | undefined, label: string): string | null {
  if (!line) return null
  const i = line.toks.findIndex(t => t.s.trim().startsWith(label))
  if (i < 0) return null
  const own = line.toks[i].s.trim().slice(label.length).trim()
  if (own) return own
  return line.toks[i + 1]?.s.trim() ?? null
}

const findLine = (ls: Line[], re: RegExp) => ls.find(l => re.test(l.text))

function itDate(s: string | null): string | null {
  const m = s?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}

function parseTitle(text: string) {
  // "CS1453 || Publicis Media - Nutella tour italia - V1_basati in italia"
  const [codePart, rest = ''] = text.split('||').map(s => s.trim())
  const v = rest.match(/^(.*?)\s+-\s+(V\d+[_\s-]?.*)$/i)
  const title = (v ? v[1] : rest).trim()
  const versionLabel = v ? v[2].replace(/^V\d+[_\s-]*/i, '').trim() || null : null
  return { code: codePart || null, title: title || text, versionLabel }
}

function parseSummary(page: PdfPage, pageIndex: number, q: ParsedQuote) {
  const ls = lines(page)
  const W = page.width

  const titleLine = ls.find(l => l.text.includes('||'))
  if (titleLine) Object.assign(q, parseTitle(titleLine.toks.filter(t => t.x < W * 0.8).map(t => t.s.trim()).join(' ')))

  q.quote_date = itDate(valueAfter(findLine(ls, /Quote Date:/), 'Quote Date:'))
  q.client_name = valueAfter(ls.find(l => /^Client:/.test(l.text)), 'Client:')
  q.validity_days = num(valueAfter(findLine(ls, /Validity:/), 'Validity:'))

  // Blocco destinatario in alto a destra: ragione sociale, P. IVA, indirizzo
  const spett = ls.findIndex(l => /Spett\.?\s*le/i.test(l.text))
  const header = ls.findIndex(l => /\bITEM\b/.test(l.text) && /\bNOTE\b/.test(l.text))
  if (spett >= 0 && header > spett) {
    const right = ls.slice(spett + 1, header).flatMap(l => l.toks.filter(t => t.x > W * 0.6).map(t => t.s.trim())).filter(Boolean)
    q.client_name = right[0] ?? q.client_name
    const vat = right.find(s => /^\d{11}$/.test(s.replace(/\s/g, '')))
    q.client_vat = vat ?? null
    q.client_address = right.filter(s => s !== right[0] && s !== vat).join(', ') || null
  }

  // Totali in fondo
  const subLine = findLine(ls, /SUB TOTAL/)
  q.totals.subtotal = num(subLine?.toks.find(t => /€/.test(t.s))?.s)
  const subIdx = subLine ? ls.indexOf(subLine) : -1
  const feeLine = ls.slice(subIdx + 1, subIdx + 4).find(l => l.toks.some(t => /^\d+([.,]\d+)?%$/.test(t.s.trim())))
  const feeTok = feeLine?.toks.find(t => /%$/.test(t.s.trim()))
  q.discount = Math.abs(num(findLine(ls, /DISCOUNT/)?.toks.find(t => /€/.test(t.s))?.s) ?? 0)
  const totalLine = ls.find(l => /^TOTAL\b/.test(l.text) && !/TOTAL\+IVA/.test(l.text))
  q.totals.total = num(totalLine?.toks.find(t => /€/.test(t.s))?.s)
  if (feeTok) q.production_fee_pct = num(feeTok.s) ?? q.production_fee_pct
  // Senza riga della fee la ricavo dai totali (spesso è 0: totale = subtotale − sconto)
  else if (q.totals.subtotal && q.totals.total != null) {
    q.production_fee_pct = Math.max(0, Math.round(((q.totals.total + q.discount - q.totals.subtotal) / q.totals.subtotal) * 10000) / 100)
  }
  q.totals.totalVat = num(findLine(ls, /TOTAL\+IVA/)?.toks.find(t => /€/.test(t.s))?.s)
  if (q.totals.total && q.totals.totalVat) q.vat_pct = Math.round((q.totals.totalVat / q.totals.total - 1) * 100)

  // Righe A–O: quali sono incluse e con che nota
  if (header < 0) return
  const h = ls[header]
  const itemX = h.toks.find(t => t.s.trim() === 'ITEM')?.x ?? 0
  const noteX = h.toks.find(t => t.s.trim() === 'NOTE')!.x
  const priceX = h.toks.find(t => t.s.trim() === 'PRICE')?.x ?? W * 0.8
  const extrasX = h.toks.find(t => t.s.trim() === 'EXTRAS')?.x ?? W * 0.9
  const end = ls.findIndex((l, i) => i > header && /Quote Date:|SUB TOTAL/.test(l.text))
  const rows = ls.slice(header + 1, end < 0 ? undefined : end)

  const notes = rows.map(r => r.toks.filter(t => t.x >= noteX - 10 && t.x < priceX - 150).map(t => t.s.trim()).join(' ').trim())
  // La nota più frequente è "Not-Incl" (anche quando il font la rende illeggibile)
  const freq = new Map<string, number>()
  notes.forEach(n => freq.set(n, (freq.get(n) ?? 0) + 1))
  const notIncl = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const readable = (s: string) => /^[\p{L}\p{N}\s.,;:()'’/+&%€-]+$/u.test(s) && /[aeiou]/i.test(s)

  rows.forEach((r, i) => {
    const letter = LETTERS[i]
    if (!letter) return
    const note = notes[i]
    const extras = Math.abs(num(r.toks.find(t => t.x >= extrasX - 60)?.s) ?? 0)
    // Prezzo leggibile della riga (nei PDF col font offuscato non lo è, e restano le pagine di dettaglio)
    const priceTok = r.toks.find(t => t.x >= priceX - 150 && t.x < extrasX - 60 && isNum(t.s))
    const price = Math.abs(num(priceTok?.s) ?? 0)
    const hasNote = !!note && note !== notIncl && !/^not[-\s]?incl/i.test(note)
    const included = hasNote || price > 0
    if (!included && !extras) return
    const name = r.toks.filter(t => t.x >= itemX - 10 && t.x < noteX - 10).map(t => t.s.trim()).join(' ').trim()
    const sec: ParsedSection = { letter, note: null, extras, items: [], summary: price > 0 ? { name: readable(name) ? name : null, price } : undefined }
    if (hasNote) {
      if (readable(note)) sec.note = note
      else {
        const toks = r.toks.filter(t => t.x >= noteX - 10 && t.x < priceX - 150)
        sec.noteUnreadable = { page: pageIndex, x0: noteX - 10, x1: priceX - 150, y: r.y, h: Math.max(...toks.map(t => t.h), 20) }
      }
    }
    q.sections.push(sec)
  })
}

function parseDetail(page: PdfPage, letter: string, q: ParsedQuote) {
  const ls = lines(page)
  const W = page.width
  const sec = q.sections.find(s => s.letter === letter) ?? (() => {
    const s: ParsedSection = { letter, note: null, extras: 0, items: [] }
    q.sections.push(s)
    return s
  })()

  // Nota della sezione: sotto l'etichetta NOTE in alto a destra
  const noteIdx = ls.findIndex(l => l.toks.some(t => t.s.trim() === 'NOTE' && t.x > W * 0.8))
  if (noteIdx >= 0) {
    const n = ls[noteIdx + 1]?.toks.filter(t => t.x > W * 0.7).map(t => t.s.trim()).join(' ').trim()
    if (n) { sec.note = n; delete sec.noteUnreadable }
  }

  const hi = ls.findIndex(l => /\bJOB\b/.test(l.text) && /\bQTY\b/.test(l.text))
  if (hi < 0) return
  const head = ls[hi].toks
  const col = (name: string) => head.find(t => t.s.trim() === name)?.x
  const cols = {
    job: col('JOB')!, note: col('NOTE')!, qty: col('QTY')!, days: col('DAYS')!,
    unit: col('UNIT PRICE') ?? head.find(t => /UNIT/.test(t.s))!.x, nic: col('NIC')!, price: col('PRICE')!, extras: col('EXTRAS')!,
  }
  const pad = 40
  const end = ls.findIndex((l, i) => i > hi && /SUB TOTAL/.test(l.text))
  const body = ls.slice(hi + 1, end < 0 ? undefined : end)
  const inCol = (t: Tok, from: number, to: number) => t.x >= from - pad && t.x < to - pad

  // Una voce è la riga che ha quantità e prezzo; le righe di testo intorno sono il nome che va a capo
  const anchors = body.filter(l => l.toks.some(t => inCol(t, cols.qty, cols.days) && isNum(t.s)) && l.toks.some(t => inCol(t, cols.unit, cols.nic) && isNum(t.s)))
  const groups = anchors.map(a => ({ a, lines: [] as Line[] }))
  for (const l of body) {
    if (!groups.length) break
    const g = groups.reduce((best, g) => (Math.abs(g.a.y - l.y) < Math.abs(best.a.y - l.y) ? g : best))
    g.lines.push(l)
  }
  for (const { a, lines: gl } of groups) {
    const pick = (from: number, to: number) => a.toks.find(t => inCol(t, from, to))?.s
    const text = (from: number, to: number) => gl.sort((x, y) => y.y - x.y).map(l => l.toks.filter(t => inCol(t, from, to)).map(t => t.s.trim()).join(' ')).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    const job = text(cols.job, cols.note)
    sec.items.push({
      code: a.toks.find(t => t.x < cols.job - pad)?.s.trim() || null,
      job: job ? job[0].toUpperCase() + job.slice(1) : '—',
      note: text(cols.note, cols.qty) || null,
      qty: num(pick(cols.qty, cols.days)) ?? 1,
      days: num(pick(cols.days, cols.unit)) ?? 1,
      unit_price: num(pick(cols.unit, cols.nic)) ?? 0,
      nic_pct: num(pick(cols.nic, cols.price)) ?? 0,
    })
  }

  const fee = ls.find(l => /PRODUCTION FEE/.test(l.text))?.toks.find(t => /%$/.test(t.s.trim()))
  if (fee && !q.totals.subtotal) q.production_fee_pct = num(fee.s) ?? q.production_fee_pct
}

export function parseCerbero(pages: PdfPage[]): ParsedQuote {
  const q: ParsedQuote = {
    code: null, title: '', versionLabel: null, client_name: null, client_vat: null, client_address: null,
    quote_date: null, validity_days: null, production_fee_pct: 15, discount: 0, vat_pct: 22,
    totals: { subtotal: null, total: null, totalVat: null }, sections: [], warnings: [],
  }
  pages.forEach((p, i) => {
    const ls = lines(p)
    const top = ls.slice(0, 3)
    if (top.some(l => l.toks.some(t => t.s.trim() === 'REPORT'))) return parseSummary(p, i, q)
    const sec = top.flatMap(l => l.toks).map(t => t.s.trim().match(/^([A-O])\.\s+\S/)).find(Boolean)
    if (sec) parseDetail(p, sec[1], q)
  })
  q.sections.sort((a, b) => LETTERS.indexOf(a.letter) - LETTERS.indexOf(b.letter))

  // Sezioni senza pagina di dettaglio: una voce sola con il prezzo del riepilogo
  for (const sec of q.sections) {
    if (!sec.items.length && sec.summary) {
      const n = sec.summary.name
      sec.items.push({ code: null, job: n ? n[0] + n.slice(1).toLowerCase() : '—', note: sec.note, qty: 1, days: 1, unit_price: sec.summary.price, nic_pct: 0 })
    }
    delete sec.summary
  }

  if (!q.title) q.warnings.push('Non trovo il titolo del preventivo: è un PDF esportato da Cerbero?')
  if (!q.sections.length) q.warnings.push('Non trovo nessuna voce nel PDF.')
  const sub = q.sections.reduce((s, sec) => s + sec.items.reduce((a, i) => a + i.qty * i.days * i.unit_price * (1 + i.nic_pct / 100), 0), 0)
  if (q.totals.subtotal != null && Math.abs(sub - q.totals.subtotal) > 0.5)
    q.warnings.push(`La somma delle voci (${sub.toFixed(2)} €) non coincide con il subtotale del PDF (${q.totals.subtotal.toFixed(2)} €).`)
  return q
}
