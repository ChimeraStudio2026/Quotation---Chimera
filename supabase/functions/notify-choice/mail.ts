// Template delle mail (design EML-01 / EML-02 del canvas).
// HTML a tabelle e stili inline: è quello che Gmail, Outlook e Apple Mail leggono tutti allo stesso modo.
// Gli stickers sono PNG su quotation.chimerastudioss.com/mail (gli SVG nelle mail non si vedono).

export type MailItem = { name: string; note: string | null; price: number | null }
export type MailWork = { brand: string | null; title: string; poster_url: string; link_url: string | null }
export type MailData = {
  appUrl: string
  code: string | null
  title: string
  clientName: string
  clientEmail: string | null
  clientNote: string | null
  versionName: string
  versionPosition: number
  tagline: string | null
  total: number
  totalVat: number
  items: MailItem[]
  works: MailWork[]
  quoteUrl: string
  publicUrl: string
  chosenAt: Date
}

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, useGrouping: 'always' } as Intl.NumberFormatOptions)
const eurRound = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions)
export const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const FONT = `'DM Sans', Helvetica, Arial, sans-serif`
const DISPLAY = `'Neue Plak Extended', 'DM Sans', Helvetica, Arial, sans-serif`
const INK = '#1d1b18'
const MUTED = '#6b655c'
const SUBTLE = '#8a8378'

const head = (title: string) => `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&display=swap" rel="stylesheet">
<style>
@font-face{font-family:"Neue Plak Extended";src:url("https://cdn.prod.website-files.com/6a313ee304763bb2bbebf621/6a4e259ad334d9e6639f72c8_Neue%20Plak%20Extended%20Bold.ttf") format("truetype");font-weight:700}
body{margin:0;padding:0;background:#fbf8f3}
a{color:#5b2a78}
@media (max-width:620px){
  .pad{padding-left:20px!important;padding-right:20px!important}
  .h1{font-size:30px!important;line-height:34px!important}
  .price{font-size:32px!important;line-height:36px!important}
}
</style></head>`

const label = (text: string, color = SUBTLE) =>
  `<div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.06em;color:${color};text-transform:uppercase">${esc(text)}</div>`

const button = (href: string, text: string, primary: boolean) =>
  `<a href="${href}" style="display:inline-block;font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none;border-radius:999px;padding:13px 22px;${primary ? `background:#df84ff;color:${INK};` : `background:#ffffff;color:${INK};border:1px solid #ddd5c8;`}">${esc(text)}</a>`

const card = (inner: string, style: string) =>
  `<tr><td style="padding-top:12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;${style}"><tr><td class="pad" style="padding:28px 32px">${inner}</td></tr></table></td></tr>`

const step = (n: number, bg: string, fg: string, title: string, text: string) => `
<tr><td style="padding-top:16px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
  <td valign="top" width="34" style="padding-right:14px"><div style="width:34px;height:34px;line-height:34px;border-radius:999px;background:${bg};color:${fg};font-family:${FONT};font-weight:700;font-size:15px;text-align:center">${n}</div></td>
  <td valign="top" style="font-family:${FONT};font-size:15px;line-height:22px;color:${INK}"><strong>${esc(title)}</strong><br><span style="color:${MUTED}">${esc(text)}</span></td>
</tr></table></td></tr>`

function shell(title: string, preheader: string, rows: string, footer: string) {
  return `${head(title)}
<body style="margin:0;padding:0;background:#fbf8f3">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf8f3"><tr><td align="center" style="padding:24px 10px 32px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
${rows}
<tr><td align="center" style="padding:28px 16px 8px;font-family:${FONT};font-size:12px;line-height:18px;color:${SUBTLE}">${footer}</td></tr>
</table>
</td></tr></table>
</body></html>`
}

// EML-01 · conferma al cliente
export function clientMail(d: MailData) {
  const A = d.appUrl
  const hero = `
<tr><td background="${A}/mail/hero.png" bgcolor="#fbf4ec" style="background:#fbf4ec url('${A}/mail/hero.png') right top / cover no-repeat;border-radius:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="pad" style="padding:32px 36px 40px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px"><img src="${A}/logo-black.png" width="32" height="30" alt="" style="display:block;border:0"></td>
      <td style="font-family:${FONT};font-size:15px;font-weight:700;color:${INK}">Chimera Studio</td>
    </tr></table>
    <div style="height:40px;line-height:40px">&nbsp;</div>
    <span style="display:inline-block;padding:5px 11px;border-radius:999px;background:#e5483b;color:#ffffff;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.06em">SCELTA CONFERMATA</span>
    <h1 class="h1" style="margin:14px 0 12px;font-family:${DISPLAY};font-size:40px;line-height:42px;font-weight:700;letter-spacing:-0.01em;color:${INK};max-width:420px">Grazie! Hai scelto ${esc(d.versionName)}</h1>
    <p style="margin:0;max-width:400px;font-family:${FONT};font-size:16px;line-height:24px;color:${MUTED}">Abbiamo ricevuto la tua scelta per <strong style="color:${INK}">${esc(d.title)}</strong>. Da qui ci pensiamo noi.</p>
  </td></tr></table>
</td></tr>`

  const items = d.items.map(i => `
<tr><td style="padding-top:12px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
  <td valign="top" width="22" style="padding-right:12px"><div style="width:22px;height:22px;line-height:22px;border-radius:999px;background:#df84ff;color:#17121a;font-family:${FONT};font-size:12px;font-weight:700;text-align:center">&#10003;</div></td>
  <td style="font-family:${FONT};font-size:15px;line-height:22px;color:#ffffff"><strong>${esc(i.name)}</strong>${i.note ? `<span style="color:#b9b2bd"> · ${esc(i.note)}</span>` : ''}</td>
</tr></table></td></tr>`).join('')

  const version = card(`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td valign="top">${label(`Versione ${d.versionPosition} · la tua scelta`, '#df84ff')}
    <div style="font-family:${FONT};font-size:24px;font-weight:700;color:#ffffff;margin-top:6px">${esc(d.versionName)}</div>
    ${d.tagline ? `<div style="font-family:${FONT};font-size:14px;color:#b9b2bd;margin-top:2px">${esc(d.tagline)}</div>` : ''}</td>
  <td valign="top" align="right" width="72"><img src="${A}/mail/play-green.png" width="72" height="72" alt="" style="display:block;border:0;margin-top:-14px"></td>
</tr></table>
<div style="margin-top:18px;font-family:${FONT};color:#b9b2bd;font-size:14px"><span class="price" style="font-family:${DISPLAY};font-size:40px;line-height:44px;font-weight:700;color:#ffffff">${eurRound.format(d.total)}</span>&nbsp; +IVA · ${eur.format(d.totalVat)} IVA inclusa</div>
<div style="height:1px;background:#3a3340;margin:22px 0 4px;line-height:1px">&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>`,
    'background:#17121a;border-radius:24px')

  const next = card(`
${label('Cosa succede ora')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${step(1, '#f3e8fa', '#5b2a78', 'Ti contatta il nostro team di produzione', 'A brevissimo ricevi una mail dedicata per il kick-off del progetto.')}
${step(2, '#fbefc4', '#5b4a10', 'Fatturazione con il tuo account', 'Tutta la parte di fatturazione resta in capo al tuo account Chimera.')}
${step(3, '#dcefe0', '#2f6b3a', 'Si gira', "La crew arriva sul set: tu pensa solo all'evento.")}
</table>
<div style="margin-top:24px">${button(d.publicUrl, 'Rivedi la quotation', true)}</div>`,
    'background:#ffffff;border:1px solid #e8e1d6;border-radius:24px')

  const works = d.works.length ? card(`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td valign="top"><h2 style="margin:0;font-family:${DISPLAY};font-size:26px;line-height:30px;font-weight:700;color:${INK};max-width:380px">Intanto, guarda cosa abbiamo girato</h2></td>
  <td valign="top" align="right" width="64"><img src="${A}/mail/mic-green.png" width="64" height="64" alt="" style="display:block;border:0"></td>
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr>
${d.works.slice(0, 3).map((w, i) => `<td class="work" valign="top" width="33%" style="padding:0 ${i < 2 ? 10 : 0}px 0 0">
  <a href="${esc(w.link_url ?? 'https://chimerastudioss.com')}" style="text-decoration:none;color:${INK}"><img src="${esc(w.poster_url)}" width="170" alt="${esc(w.brand ?? w.title)}" style="display:block;width:100%;height:auto;border:0;border-radius:14px">
  <div style="font-family:${FONT};font-size:13px;font-weight:700;margin-top:8px;color:${INK}">${esc(w.brand ?? w.title)}</div>
  ${w.brand ? `<div style="font-family:${FONT};font-size:12px;color:${MUTED}">${esc(w.title)}</div>` : ''}</a>
</td>`).join('')}
</tr></table>
<div style="margin-top:18px"><a href="https://chimerastudioss.com" style="font-family:${FONT};color:#5b2a78;font-size:14px;font-weight:700;text-decoration:none">Tutti i progetti su chimerastudioss.com &rarr;</a></div>`,
    'background:#fbf4ec;border-radius:24px') : ''

  const footer = `<img src="${A}/logo-black.png" width="28" height="26" alt="Chimera Studio" style="border:0"><br>
<strong style="color:${INK};font-size:13px">Chimera Studio</strong><br>
<a href="https://chimerastudioss.com" style="color:${SUBTLE}">chimerastudioss.com</a> · <a href="https://www.instagram.com/chimera.studioss/" style="color:${SUBTLE}">Instagram</a><br><br>
Ricevi questa mail perché hai scelto una versione su quotation.chimerastudioss.com.`

  return shell(`Hai scelto ${d.versionName}`, `Grazie! Hai scelto ${d.versionName} per ${d.title}. Ecco cosa succede ora.`,
    hero + version + next + works, footer)
}

// EML-02 · avviso di approvazione a Chimera
export function teamMail(d: MailData) {
  const A = d.appUrl
  const when = d.chosenAt.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
  const hero = `
<tr><td background="${A}/mail/hero-team.png" bgcolor="#17121a" style="background:#17121a url('${A}/mail/hero-team.png') right top / cover no-repeat;border-radius:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="pad" style="padding:30px 32px 32px">
    <span style="display:inline-block;padding:5px 11px;border-radius:999px;background:#3fb26a;color:#ffffff;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.06em">QUOTATION APPROVATA</span>
    <h1 class="h1" style="margin:14px 0 6px;font-family:${DISPLAY};font-size:34px;line-height:38px;font-weight:700;color:#ffffff;max-width:400px">${esc(d.clientName)} ha scelto ${esc(d.versionName)}</h1>
    <div style="font-family:${FONT};font-size:14px;color:#b9b2bd">${d.code ? `${esc(d.code)} · ` : ''}${esc(d.title)} · ${esc(when)}</div>
    <div style="margin-top:20px;font-family:${FONT};font-size:14px;color:#b9b2bd"><span class="price" style="font-family:${DISPLAY};font-size:40px;line-height:44px;font-weight:700;color:#df84ff">${eurRound.format(d.total)}</span>&nbsp; +IVA · ${eur.format(d.totalVat)} IVA inclusa</div>
  </td></tr></table>
</td></tr>`

  const box = (k: string, v: string) =>
    `<td valign="top" width="50%" style="padding:0 6px"><div style="background:#fbf8f3;border-radius:14px;padding:12px 14px;font-family:${FONT};font-size:14px;color:${INK}">${label(k)}<div style="margin-top:4px">${v}</div></div></td>`

  const items = d.items.map(i => `<tr>
  <td style="padding:4px 0;font-family:${FONT};font-size:14px;color:${INK}"><strong>${esc(i.name)}</strong>${i.note ? `<span style="color:${MUTED}"> · ${esc(i.note)}</span>` : ''}</td>
  <td align="right" style="padding:4px 0 4px 12px;font-family:${FONT};font-size:14px;color:${INK};white-space:nowrap">${i.price ? eur.format(i.price) : 'Incluso'}</td>
</tr>`).join('')

  const body = card(`
${d.clientNote ? `${label('Nota del cliente')}<div style="margin:10px 0 18px;background:#f3e8fa;border-radius:18px 18px 18px 4px;padding:14px 16px;font-family:${FONT};font-size:15px;line-height:22px;color:#3e1c52">${esc(d.clientNote).replace(/\n/g, '<br>')}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -6px"><tr>
${box('Cliente', esc(d.clientName))}
${box('Email', d.clientEmail ? `<a href="mailto:${esc(d.clientEmail)}" style="color:#5b2a78">${esc(d.clientEmail)}</a>` : `<span style="color:${MUTED}">Non indicata</span>`)}
</tr></table>
<div style="height:18px;line-height:18px">&nbsp;</div>
${label(`Dentro ${d.versionName}`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">${items}</table>
<div style="margin-top:22px">${button(d.quoteUrl, 'Apri la quotation', true)}${d.clientEmail ? `&nbsp; ${button(`mailto:${esc(d.clientEmail)}`, 'Rispondi al cliente', false)}` : ''}</div>`,
    'background:#ffffff;border:1px solid #e8e1d6;border-radius:24px')

  return shell(`${d.clientName} ha scelto ${d.versionName}`, `${d.clientName} ha scelto ${d.versionName} · ${eurRound.format(d.total)} +IVA`,
    hero + body, 'Mail automatica di quotation.chimerastudioss.com')
}
