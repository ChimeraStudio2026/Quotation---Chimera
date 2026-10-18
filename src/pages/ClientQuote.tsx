import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buildPreview } from '../lib/quoteData'
import { fmtDate, isIncluded, itemTotal, money, moneyRound, sectionTotal, versionTotals } from '../lib/calc'
import type { PublicQuote, Version, Work } from '../lib/types'
import { VideoTile } from '../components/VideoTile'
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
          <img src="/logo-black.png" alt="Chimera" width={44} height={44} />
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

const Star = ({ size, style }: { size: number; style: React.CSSProperties }) => (
  <svg className="hero-shape" width={size} height={size} viewBox="0 0 100 100" style={style} aria-hidden>
    <path fill="currentColor" d="M50 0 61 35 98 28 69 52 92 83 56 69 50 100 44 69 8 83 31 52 2 28 39 35z" />
  </svg>
)

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

  function openVersion(id: string) {
    setOpenId(id)
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  if (!open) return null

  return (
    <div className="client">
      <header className="hero">
        <Star size={260} style={{ right: -40, top: -60 }} />
        <Star size={120} style={{ right: 260, bottom: -30, transform: 'rotate(18deg)' }} />
        <div className="hero-top">
          <img src="/logo-white.png" alt="" />
          <span className="who">Chimera Studio</span>
          <span className="spacer" />
          {preview && <span className="pill pill-warning">Anteprima account</span>}
        </div>
        <div className="label hero-eyebrow" style={{ position: 'relative' }}>Quotation{quote.code ? ` · ${quote.code}` : ''}</div>
        <h1>{quote.title}</h1>
        <p className="lead">
          {quote.intro?.trim() || `Abbiamo preparato tre versioni per ${quote.client_name}. Aprile, confrontale e scegli quella giusta per il progetto.`}
        </p>
        <div className="hero-meta">
          <div><span>Per</span>{quote.client_name}</div>
          <div><span>Data</span>{fmtDate(quote.quote_date)}</div>
          <div><span>Valida fino al</span>{fmtDate(validUntil.toISOString())}</div>
        </div>
      </header>

      <main className="client-main">
        {selectedId && (
          <div className="chosen-banner">
            <IconCheck size={20} />
            Hai scelto la versione {versions.find(v => v.id === selectedId)?.name}. Il tuo account Chimera ti scrive a breve per i prossimi passi.
          </div>
        )}

        <div className="client-section-head">
          <div>
            <div className="label subtle">Le tre versioni</div>
            <h2 className="page-title" style={{ marginTop: 6 }}>Scegli la tua quotation</h2>
          </div>
        </div>

        <div className="options">
          {versions.map(v => (
            <OptionCard key={v.id} v={v} featured={v.id === recommended?.id} open={v.id === open.id} selected={v.id === selectedId}
              catName={code => catOf(code).name} onOpen={() => openVersion(v.id)} />
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
            <VersionSections version={open} catOf={catOf} />
            <aside className="detail-aside">
              <div className="sticky">
                <Totals v={open} />
                {selectedId === open.id ? (
                  <div className="pill pill-success" style={{ justifyContent: 'center', padding: '12px' }}><IconCheck size={16} /> Versione scelta</div>
                ) : (
                  <button className={`btn btn-lg ${open.id === recommended?.id ? 'btn-nova' : ''}`} disabled={preview}
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

        <Showcase version={open} works={works} catOf={catOf} />
      </main>

      <footer className="client-foot">
        <img src="/logo-black.png" alt="" />
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

function OptionCard({ v, featured, open, selected, catName, onOpen }: {
  v: Version; featured: boolean; open: boolean; selected: boolean; catName: (c: string) => string; onOpen: () => void
}) {
  const t = versionTotals(v)
  const included = v.sections.filter(isIncluded)
  const top = included.slice(0, 5)
  return (
    <button className={`option ${featured ? 'featured' : ''} ${open ? 'open' : ''} ${selected ? 'selected-ring' : ''}`} onClick={onOpen}>
      {featured && <span className="pill badge-top">Consigliata</span>}
      <div>
        <div className="label" style={{ color: featured ? 'var(--nova)' : 'var(--ink-subtle)' }}>Versione {v.position}</div>
        <div className="section-title" style={{ marginTop: 6, fontSize: featured ? 24 : 19 }}>{v.name}</div>
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
      <span className={`btn ${featured ? 'btn-nova' : 'btn-outline'}`} style={{ alignSelf: 'flex-start' }}>
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

// Sotto la versione aperta girano i lavori collegati ai servizi che contiene
function Showcase({ version, works, catOf }: { version: Version; works: Work[]; catOf: (c: string) => { name: string; position: number } }) {
  const groups = useMemo(() => {
    const used = new Set<string>()
    const out: { title: string; works: Work[] }[] = []
    const codes = version.sections.filter(isIncluded).map(s => s.category_code)
      .sort((a, b) => catOf(a).position - catOf(b).position)
    for (const code of codes) {
      const list = works.filter(w => w.categories.includes(code) && !used.has(w.id))
      list.forEach(w => used.add(w.id))
      if (list.length) out.push({ title: catOf(code).name, works: list })
    }
    const rest = works.filter(w => !used.has(w.id))
    if (rest.length) out.push({ title: out.length ? 'Altri lavori' : 'I nostri lavori', works: rest })
    return out
  }, [version, works, catOf])

  if (!groups.length) return null
  return (
    <section className="showcase">
      <div className="client-section-head">
        <div>
          <div className="label subtle">Cosa sappiamo fare</div>
          <h2 className="page-title" style={{ marginTop: 6 }}>I nostri lavori per {version.name}</h2>
        </div>
      </div>
      {groups.map(g => (
        <div key={g.title} className="showcase-group">
          <h3 className="section-title" style={{ marginBottom: 16 }}>{g.title}</h3>
          <div className="showcase-row">
            {g.works.map(w => <VideoTile key={w.id} work={w} />)}
          </div>
        </div>
      ))}
    </section>
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
