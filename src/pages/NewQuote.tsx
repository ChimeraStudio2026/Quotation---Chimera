import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadCategories, loadQuote, loadWorks, saveQuote } from '../lib/quoteData'
import { headerFromPdf, versionFromPdf } from '../lib/fromPdf'
import { SERVICES, type Category, type Work } from '../lib/types'
import { PdfSlot, type SlotState } from '../components/PdfSlot'
import { IconStar } from '../components/Icons'

const LEVELS = [
  { position: 1, label: 'Essential', hint: 'Livello 1' },
  { position: 2, label: 'Signature', hint: 'Livello 2 · consigliato' },
  { position: 3, label: 'Premium', hint: 'Livello 3' },
]

export function NewQuote() {
  const navigate = useNavigate()
  const [cats, setCats] = useState<Category[]>([])
  const [slots, setSlots] = useState<SlotState[]>([{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [services, setServices] = useState<string[]>([])
  const [works, setWorks] = useState<Work[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [intro, setIntro] = useState('')
  const [clientEmail, setClientEmail] = useState('')

  useEffect(() => {
    loadCategories().then(setCats).catch(e => setError(e.message))
    loadWorks().then(setWorks).catch(() => setWorks([]))
  }, [])

  // Servono almeno 2 versioni su 3; un livello lasciato vuoto non viene creato
  const okCount = slots.filter(s => s.kind === 'ok').length
  const busyOrError = slots.some(s => s.kind === 'reading' || s.kind === 'error')
  const ready = okCount >= 2 && !busyOrError

  async function create() {
    const parsed = slots.map(s => (s.kind === 'ok' ? s.parsed : null))
    if (parsed.filter(Boolean).length < 2) return
    setBusy(true)
    setError(null)
    try {
      // Cliente e progetto dal PDF centrale, o dal primo caricato se il livello 2 manca
      const main = parsed[1] ?? parsed.find(Boolean)!
      const { data, error } = await supabase.from('quotes').insert({ ...headerFromPdf(main), services, intro: intro.trim() || null, client_email: clientEmail.trim() || null }).select().single()
      if (error) throw error
      const { quote } = await loadQuote(data.id)
      const versions = parsed.flatMap((p, i) => (p ? [versionFromPdf(p, i + 1, cats)] : []))
      await saveQuote(quote, versions, picked)
      navigate(`/quotation/${data.id}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="breadcrumb"><Link to="/">Quotation</Link> / Nuova</div>
          <h1 className="page-title">Nuova quotation</h1>
          <p className="muted" style={{ margin: '6px 0 0', maxWidth: 640 }}>
            Carica i PDF esportati da Cerbero, uno per livello: 3 versioni, oppure anche solo 2. Leggo voci, prezzi, fee e cliente e preparo la pagina per il cliente.
          </p>
        </div>
      </div>

      <div className="slots">
        {LEVELS.map((l, i) => (
          <PdfSlot key={l.position} label={l.label} hint={l.hint} featured={l.position === 2} state={slots[i]}
            onChange={s => setSlots(prev => prev.map((x, j) => (j === i ? s : x)))} />
        ))}
      </div>

      <section className="card stack" style={{ marginTop: 24 }}>
        <div>
          <h2 className="section-title">Categoria di evento e lavori da mostrare</h2>
          <p className="meta" style={{ margin: '4px 0 0' }}>Il cliente vede girare i nostri lavori di questa categoria. Se scegli dei lavori singoli, vede solo quelli. Puoi cambiare tutto anche dopo.</p>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {SERVICES.map(sv => {
            const on = services.includes(sv)
            return (
              <button key={sv} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
                onClick={() => setServices(p => (on ? p.filter(x => x !== sv) : [...p, sv]))}>{sv}</button>
            )
          })}
        </div>
        <details>
          <summary className="label subtle" style={{ cursor: 'pointer' }}>Oppure scegli lavori singoli ({picked.length})</summary>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {works.map(w => {
              const on = picked.includes(w.id)
              return (
                <button key={w.id} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
                  onClick={() => setPicked(p => (on ? p.filter(x => x !== w.id) : [...p, w.id]))}>
                  {on && <IconStar size={12} />}{w.brand ? `${w.brand} · ` : ''}{w.title}
                </button>
              )
            })}
          </div>
        </details>

        <div className="works-pick stack">
          <h3 className="section-title">Messaggio per il cliente</h3>
          <textarea className="textarea" value={intro} onChange={e => setIntro(e.target.value)}
            placeholder="Facoltativo: due righe sul progetto, il cliente le legge in apertura." />
          <label className="field"><span>Email del cliente (facoltativa)</span>
            <input className="input" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="nome@azienda.it" />
          </label>
          <p className="meta" style={{ margin: 0 }}>Quando il cliente sceglie una versione, gli arriva la conferma a questo indirizzo e a Chimera arriva l'avviso.</p>
        </div>
      </section>

      {error && <div className="pill pill-danger" style={{ marginTop: 16, whiteSpace: 'normal' }}>{error}</div>}

      <div className="row" style={{ marginTop: 24 }}>
        <span className="meta">{busyOrError ? 'Controlla i PDF qui sopra.' : okCount < 2 ? `Carica almeno ${2 - okCount === 2 ? '2 PDF' : 'un altro PDF'}.` : !services.length ? `${okCount} PDF letti. Scegli anche la categoria di evento.` : `${okCount} PDF letti: la quotation avrà ${okCount} versioni.`}</span>
        <div className="spacer" />
        <button className="btn btn-lg btn-nova" disabled={!ready || !services.length || busy} onClick={create}>{busy ? 'Creo la quotation…' : 'Crea quotation'}</button>
      </div>
    </>
  )
}
