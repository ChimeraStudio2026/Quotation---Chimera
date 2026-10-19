import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { asset, supabase } from '../lib/supabase'
import { buildPreview } from '../lib/quoteData'
import { fmtDate, isIncluded, itemTotal, money, moneyRound, sectionTotal, versionTotals } from '../lib/calc'
import type { PublicQuote, Version } from '../lib/types'
import { WorksCarousel } from '../components/WorksCarousel'
import { IconCheck, IconChevron } from '../components/Icons'

export function ClientQuotePage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicQuote | null | undefined>(undefined)

  useEffect(() => {
    supabase.rpc('get_public_quote', { p_token: token }).then(({ data, error }) => setData(error ? null : (data as PublicQuote | null)))
  }, [token])

  if (data === undefined) return <div className="auth-wrap muted">Carico la quotation…</div>
  if (data === null)
    return (
      <div className="auth-wrap">
        <div className="card auth-card stack" style={{ textAlign: 'center', alignItems: 'center' }}>
          <img src={asset('logo-black.png')} alt="Chimera" width={44} height={44} />
          <h1 className="section-title">Quotation non disponibile</h1>
          <p className="muted" style={{ margin: 0 }}>Il link non è valido o la quotation non è più attiva. Scrivi al tuo account Chimera.</p>
        </div>
      </div>
    )
  return <QuoteView data={data} token={token} />
}

export function PreviewQuotePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<PublicQuote | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (id) buildPreview(id).then(setData).catch(e => setError(e.message)) }, [id])
  if (error) return <div className="auth-wrap"><span className="pill pill-danger">{error}</span></div>
  if (!data) return <div className="auth-wrap muted">Carico l'anteprima…</div>
  return <QuoteView data={data} />
}

// Gli adesivi del sito chimerastudioss.com, sparsi sulla testata
const STICKERS: [string, string][] = [
  ['burst-purple', 'st-bg'],
  ['burst-purple', 'st-purple-burst'],
  ['star-red', 'st-red-star'],
  ['burst-blue', 'st-blue-burst'],
  ['mic-green', 'st-mic'],
  ['bubble-blue', 'st-blue-bubble'],
  ['star-purple', 'st-purple-star'],
  ['bubble-purple', 'st-purple-bubble'],
  ['star-yellow', 'st-yellow-star'],
]

// Il titolo va a capo dopo il primo " - " (cliente - progetto), come nel design
function TitleLines({ title }: { title: string }) {
  const i = title.indexOf(' - ')
  if (i < 0) return <>{title}</>
  return <>{title.slice(0, i + 2)}<br />{title.slice(i + 3)}</>
}

function QuoteView({ data, token }: { data: PublicQuote; token?: string }) {
  const { quote, categories, versions, works } = data
  const preview = !token
  const recommended = versions.find(v => v.position === 2) ?? versions[0]
  const [openId, setOpenId] = useState<string | undefined>(quote.selected_version_id ?? recommended?.id)
  const [selectedId, setSelectedId] = useState<string | null>(quote.selected_version_id)
  const [choosing, setChoosing] = useState<Version & { id: string } | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  const open = versions.find(v => v.id === openId) ?? recommended
  const catOf = (code: string) => categories.find(c => c.code === code)!
  const validUntil = new Date(new Date(quote.quote_date).getTime() + quote.validity_days * 86400000)

  if (!open) return null

  return (
    <div className="client">
      <div className="hero-wrap">
        <header className="hero">
          {STICKERS.map(([file, cls], i) => <img key={i} className={`sticker ${cls}`} src={asset(`stickers/${file}.svg`)} alt="" aria-hidden />)}
          <div className="hero-top">
            <img src={asset('logo-black.png')} alt="" />
            <span className="who">Chimera Studio</span>
            <span className="spacer" />
            {preview && <span className="pill pill-warning">Anteprima account</span>}
          </div>
          <span className="hero-eyebrow">Quotation{quote.code ? ` · ${quote.code}` : ''}</span>
          <h1>
            <TitleLines title={quote.title} />
            <img className="sticker-inline" src={asset('stickers/play-green.svg')} alt="" aria-hidden />
          </h1>
          <p className="lead">
            {quote.intro?.trim() || `Abbiamo preparato ${versions.length === 2 ? 'due' : 'tre'} versioni per ${quote.client_name}. Aprile, confrontale e scegli quella giusta per il progetto.`}
          </p>
          <div className="hero-meta">
            <div><span>Per</span>{quote.client_name}</div>
            <div><span>Data</span>{fmtDate(quote.quote_date)}</div>
            <div><span>Valida fino al</span>{fmtDate(validUntil.toISOString())}</div>
          </div>
        </header>
      </div>

      <main className="client-main">
        {selectedId && (
          <div className="chosen-banner">
            <IconCheck size={20} />
            Hai scelto la versione {versions.find(v => v.id === selectedId)?.name}. Il tuo account Chimera ti scrive a breve per i prossimi passi.
          </div>
        )}

        <div className="client-section-head">
          <div>
            <div className="label subtle">{versions.length === 2 ? 'Le due versioni' : 'Le tre versioni'}</div>
            <h2 className="page-title" style={{ marginTop: 6 }}>Scegli la tua quotation</h2>
          </div>
        </div>

        <div className="options" style={{ '--n': versions.length } as React.CSSProperties}>
          {versions.map(v => (
            <OptionCard key={v.id} v={v} open={v.id === open.id} selected={v.id === selectedId}
              catName={code => catOf(code).name} onOpen={() => setOpenId(v.id)} />
          ))}
        </div>

        <div ref={detailRef} className="detail" style={{ scrollMarginTop: 16 }}>
          <div className="detail-head">
            <div>
              <div className="label subtle">Dentro la versione</div>
              <h2 className="page-title" style={{ marginTop: 6 }}>{open.name}</h2>
              {open.tagline && <p className="muted" style={{ margin: '4px 0 0' }}>{open.tagline}</p>}
            </div>
            <div className="spacer" />
            <div className="tabs">
              {versions.map(v => (
                <button key={v.id} className={`tab ${v.id === open.id ? 'active' : ''}`} onClick={() => setOpenId(v.id)}>{v.name}</button>
              ))}
            </div>
          </div>
          <div className="detail-body">
            <div style={{ minWidth: 0 }}>
              <VersionSections version={open} catOf={catOf} />
              <VersionReferences version={open} />
            </div>
            <aside className="detail-aside">
              <div className="sticky">
                <Totals v={open} />
                {selectedId === open.id ? (
                  <div className="pill pill-success" style={{ justifyContent: 'center', padding: '12px' }}><IconCheck size={16} /> Versione scelta</div>
                ) : (
                  <button className="btn btn-lg btn-nova" disabled={preview}
                    onClick={() => setChoosing(open)}>
                    Scegli {open.name}
                  </button>
                )}
                <p className="meta" style={{ margin: 0 }}>
                  Prezzi IVA esclusa. Quotation valida {quote.validity_days} giorni dalla data di emissione.
                </p>
              </div>
            </aside>
          </div>
        </div>

        <WorksCarousel works={works} />
      </main>

      <footer className="client-foot">
        <img src={asset('logo-black.png')} alt="" />
        <div>
          <div className="card-title">Chimera Studio Srl</div>
          <div className="meta">via Antonello da Messina 5, Milano · <a href="https://www.chimerastudioss.com" target="_blank" rel="noreferrer">chimerastudioss.com</a></div>
        </div>
      </footer>

      {choosing && token && (
        <ChooseModal version={choosing} token={token} onClose={() => setChoosing(null)}
          onDone={() => { setSelectedId(choosing.id); setChoosing(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
      )}
    </div>
  )
}

// La card aperta diventa scura e si ingrandisce; si cambia toccando un'altra card
function OptionCard({ v, open, selected, catName, onOpen }: {
  v: Version; open: boolean; selected: boolean; catName: (c: string) => string; onOpen: () => void
}) {
  const t = versionTotals(v)
  const included = v.sections.filter(isIncluded)
  const top = included.slice(0, 5)
  return (
    <button className={`option ${open ? 'open' : ''} ${selected ? 'selected-ring' : ''}`} onClick={onOpen} aria-pressed={open}>
      <div>
        <div className="label v-label">Versione {v.position}</div>
        <div className="option-name">{v.name}</div>
        {v.tagline && <div className="muted" style={{ fontSize: 14 }}>{v.tagline}</div>}
      </div>
      <div>
        <div className="price num">{moneyRound(t.total)}</div>
        <div className="meta">+IVA · {money(t.totalVat)} IVA inclusa</div>
      </div>
      <ul>
        {top.map(s => (
          <li key={s.category_code}><IconCheck size={14} /><span>{catName(s.category_code)}{s.note ? <span className="muted"> · {s.note}</span> : null}</span></li>
        ))}
        {included.length > top.length && <li className="muted" style={{ paddingLeft: 22 }}>+ altre {included.length - top.length} voci</li>}
      </ul>
      <span className={`btn ${open ? 'btn-nova' : 'btn-outline'}`} style={{ alignSelf: 'flex-start' }}>
        {open ? 'Stai guardando questa' : 'Vedi cosa c\'è dentro'}
      </span>
    </button>
  )
}

function VersionSections({ version, catOf }: { version: Version; catOf: (c: string) => { letter: string; name: string; position: number } }) {
  const [openSec, setOpenSec] = useState<string | null>(null)
  const sections = version.sections.filter(isIncluded).sort((a, b) => catOf(a.category_code).position - catOf(b.category_code).position)

  return (
    <div className="detail-sections">
      {sections.map(s => {
        const c = catOf(s.category_code)
        const isOpen = openSec === s.category_code
        const total = sectionTotal(s)
        return (
          <div key={s.category_code} className="sec-row">
            <button className="sec-btn" onClick={() => setOpenSec(isOpen ? null : s.category_code)} aria-expanded={isOpen}>
              <span className="letter on">{c.letter}</span>
              <span>
                <span className="card-title">{c.name}</span>
                {s.note && <span className="sec-note">{s.note}</span>}
              </span>
              <span className="num" style={{ fontWeight: 700 }}>{total > 0 ? money(total) : <span className="pill pill-success">Incluso</span>}</span>
              <IconChevron size={18} className={`chev ${isOpen ? 'open' : ''}`} />
            </button>
            {isOpen && (
              <div className="sec-items">
                {s.items.length === 0 ? (
                  <p className="meta" style={{ margin: 0 }}>{s.note || 'Incluso nella quotation.'}</p>
                ) : (
                  <table>
                    <thead>
                      <tr><th>Voce</th><th className="r">Q.tà</th><th className="r">Giorni</th><th className="r">Prezzo unit.</th><th className="r">Totale</th></tr>
                    </thead>
                    <tbody>
                      {s.items.map((i, idx) => (
                        <tr key={i.id ?? idx}>
                          <td><strong>{i.job}</strong>{i.note && <div className="meta">{i.note}</div>}</td>
                          <td className="r num">{i.qty}</td>
                          <td className="r num">{i.days}</td>
                          <td className="r num">{money(Number(i.unit_price))}</td>
                          <td className="r num"><strong>{money(itemTotal(i))}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )
      })}
      {sections.length === 0 && <p className="not-incl">Questa versione è ancora in preparazione.</p>}
    </div>
  )
}

// Le reference che il team ha caricato per questo pacchetto
function VersionReferences({ version }: { version: Version }) {
  const refs = version.references ?? []
  if (!refs.length) return null
  return (
    <div className="refs">
      <div className="label subtle">Reference per {version.name}</div>
      <div className="refs-grid">
        {refs.map(r => (
          <figure key={r.id} className="ref-card">
            {r.media_type === 'image' && <img src={r.media_url} alt={r.title} loading="lazy" />}
            {r.media_type === 'video' && <video src={r.media_url} muted loop playsInline autoPlay controls={false} />}
            {r.media_type === 'link' && (
              <a className="ref-link" href={r.media_url} target="_blank" rel="noreferrer">Apri la reference →</a>
            )}
            <figcaption>
              <strong>{r.title}</strong>
              {r.note && <span className="meta">{r.note}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

function Totals({ v }: { v: Version }) {
  const t = versionTotals(v)
  return (
    <div className="totals num">
      <span className="muted">Subtotale</span><span>{money(t.subtotal)}</span>
      <span className="muted">Production fee {v.production_fee_pct}%</span><span>{money(t.fee)}</span>
      {Number(v.discount) > 0 && (<><span className="muted">Sconto</span><span>−{money(Number(v.discount))}</span></>)}
      <span className="grand">Totale</span><span className="grand">{money(t.total)}</span>
      <span className="muted">Totale + IVA {v.vat_pct}%</span><span className="muted">{money(t.totalVat)}</span>
      {t.extras > 0 && (<><span className="muted">Extras a parte</span><span className="muted">{money(t.extras)}</span></>)}
    </div>
  )
}

function ChooseModal({ version, token, onClose, onDone }: { version: Version & { id: string }; token: string; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t = versionTotals(version)

  async function confirm() {
    setBusy(true)
    const { data, error } = await supabase.rpc('choose_quote_version', { p_token: token, p_version_id: version.id, p_note: note || null })
    setBusy(false)
    if (error || !data) return setError('Non siamo riusciti a registrare la scelta. Riprova o scrivi al tuo account.')
    onDone()
  }

  return (
    <div className="modal-scrim" onClick={() => !busy && onClose()}>
      <div className="modal stack" onClick={e => e.stopPropagation()}>
        <div>
          <div className="label subtle">Conferma la scelta</div>
          <h2 className="section-title" style={{ marginTop: 6, fontSize: 24, lineHeight: '30px' }}>{version.name} · {money(t.total)} +IVA</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Diciamo al tuo account Chimera quale versione hai scelto. Ti ricontatta per la conferma d'ordine e i prossimi passi.
        </p>
        <label className="field"><span>Vuoi aggiungere qualcosa? (opzionale)</span>
          <textarea className="textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="Date, richieste, domande…" />
        </label>
        {error && <div className="pill pill-danger" style={{ whiteSpace: 'normal' }}>{error}</div>}
        <div className="row">
          <div className="spacer" />
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Annulla</button>
          <button className="btn btn-nova" onClick={confirm} disabled={busy}>{busy ? 'Invio…' : 'Invia la scelta a Chimera'}</button>
        </div>
      </div>
    </div>
  )
}
