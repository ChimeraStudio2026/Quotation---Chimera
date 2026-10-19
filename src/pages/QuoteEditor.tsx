import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { appUrl, supabase } from '../lib/supabase'
import { DEFAULT_VERSIONS, addReference, deleteReference, loadCategories, loadQuote, loadWorks, saveQuote, uploadMedia } from '../lib/quoteData'
import { fmtDate, isIncluded, money, sectionTotal, versionTotals } from '../lib/calc'
import { headerFromPdf, versionFromPdf } from '../lib/fromPdf'
import { SERVICES, type Category, type Quote, type Reference, type Version, type Work } from '../lib/types'
import { StatusPill } from '../components/StatusPill'
import { PdfSlot, type SlotState } from '../components/PdfSlot'
import { IconEye, IconLink, IconStar, IconTrash } from '../components/Icons'
import { useToast } from '../components/Toast'

// La pagina di una quotation: le 3 versioni vengono dai PDF di Cerbero, qui si sceglie solo cosa mostrare al cliente
export function QuoteEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [cats, setCats] = useState<Category[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [works, setWorks] = useState<Work[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [replacing, setReplacing] = useState<number | null>(null)
  const [slot, setSlot] = useState<SlotState>({ kind: 'empty' })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refFor, setRefFor] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([loadCategories(), loadQuote(id), loadWorks()])
      .then(([c, q, w]) => {
        setCats(c)
        setQuote(q.quote)
        setVersions(q.versions)
        setPicked(q.pickedWorks)
        setWorks(w)
      })
      .catch(e => setError(e.message))
  }, [id])

  if (error) return <div className="pill pill-danger">{error}</div>
  if (!quote) return <p className="muted">Carico la quotation…</p>

  const catOf = (code: string) => cats.find(c => c.code === code)

  async function persist(nextQuote: Quote, nextVersions: Version[], nextPicked: string[], msg: string) {
    setSaving(true)
    try {
      await saveQuote(nextQuote, nextVersions, nextPicked)
      const fresh = await loadQuote(nextQuote.id)
      setQuote(fresh.quote)
      setVersions(fresh.versions)
      setDirty(false)
      toast.show(msg)
      return true
    } catch (e) {
      toast.show(`Errore: ${(e as Error).message}`)
      return false
    } finally {
      setSaving(false)
    }
  }

  const save = () => persist(quote, versions, picked, 'Salvato')

  async function applyReplacement() {
    if (slot.kind !== 'ok' || replacing === null) return
    const old = versions.find(v => v.position === replacing)
    const next = versionFromPdf(slot.parsed, replacing, cats, old?.name)
    // Sostituisce il livello se c'è già, altrimenti lo aggiunge
    const nextVersions = (old ? versions.map(v => (v.position === replacing ? next : v)) : [...versions, next])
      .sort((a, b) => a.position - b.position)
    // Il PDF centrale aggiorna anche cliente e progetto
    const nextQuote = replacing === 2 ? { ...quote!, ...headerFromPdf(slot.parsed) } : quote!
    if (await persist(nextQuote, nextVersions, picked, old ? `${next.name} aggiornata dal PDF` : `${next.name} aggiunta`)) {
      setReplacing(null)
      setSlot({ kind: 'empty' })
    }
  }

  async function share() {
    if (dirty && !(await save())) return
    if (quote!.status === 'draft') {
      await supabase.from('quotes').update({ status: 'sent' }).eq('id', quote!.id)
      setQuote(q => (q ? { ...q, status: 'sent' } : q))
    }
    const url = appUrl(`p/${quote!.share_token}`)
    try {
      await navigator.clipboard.writeText(url)
      toast.show('Link copiato: mandalo al cliente')
    } catch {
      prompt('Copia il link per il cliente', url)
    }
  }

  async function preview() {
    if (dirty && !(await save())) return
    window.open(appUrl(`anteprima/${quote!.id}`), '_blank')
  }

  async function remove() {
    if (!confirm('Eliminare questa quotation e tutte le sue versioni?')) return
    const { error } = await supabase.from('quotes').delete().eq('id', quote!.id)
    if (error) toast.show(error.message)
    else navigate('/')
  }

  // Una quotation può avere 2 o 3 versioni: si può togliere un livello solo se ne restano almeno 2
  async function removeVersion(v: Version) {
    if (!v.id || versions.length <= 2) return
    if (!confirm(`Togliere la versione ${v.name}? Il cliente vedrà solo le altre ${versions.length - 1}.`)) return
    const { error } = await supabase.from('quote_versions').delete().eq('id', v.id)
    if (error) return toast.show(`Errore: ${error.message}`)
    setVersions(vs => vs.filter(x => x.position !== v.position))
    toast.show(`${v.name} tolta`)
  }

  async function removeRef(r: Reference) {
    if (!confirm(`Eliminare la reference "${r.title}"?`)) return
    try {
      await deleteReference(r.id)
      setVersions(vs => vs.map(v => ({ ...v, references: (v.references ?? []).filter(x => x.id !== r.id) })))
      toast.show('Reference eliminata')
    } catch (e) {
      toast.show(`Errore: ${(e as Error).message}`)
    }
  }

  const selectedVersion = versions.find(v => v.id === quote.selected_version_id)
  const setQ = (patch: Partial<Quote>) => { setQuote({ ...quote, ...patch }); setDirty(true) }
  const replacingVersion = versions.find(v => v.position === replacing)

  return (
    <>
      <div className="page-head">
        <div>
          <div className="breadcrumb"><Link to="/">Quotation</Link> / {quote.code || 'Nuova'}</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <h1 className="page-title">{quote.title}</h1>
            <StatusPill status={quote.status} label={selectedVersion ? `Scelta: ${selectedVersion.name}` : undefined} />
          </div>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {quote.client_name}{quote.client_vat ? ` · P. IVA ${quote.client_vat}` : ''} · {fmtDate(quote.quote_date)} · valida {quote.validity_days} giorni
          </p>
        </div>
        <div className="spacer" />
        <button className="btn btn-outline" onClick={preview}><IconEye size={16} /> Anteprima</button>
        {dirty && <button className="btn btn-outline" onClick={save} disabled={saving}>{saving ? 'Salvo…' : 'Salva'}</button>}
        <button className="btn btn-nova" onClick={share} disabled={saving}><IconLink size={16} /> Condividi con il cliente</button>
      </div>

      {quote.status === 'accepted' && selectedVersion && (
        <div className="chosen-banner">
          Il cliente ha scelto la versione {selectedVersion.name}
          {quote.selected_at && ` il ${new Date(quote.selected_at).toLocaleString('it-IT')}`}.
          {quote.client_note && <span style={{ fontWeight: 400 }}>Nota: “{quote.client_note}”</span>}
        </div>
      )}

      <div className="stack" style={{ gap: 24 }}>
        <section className="stack">
          <h2 className="section-title">Le {versions.length} versioni</h2>
          <div className="slots">
            {versions.map(v => {
              const t = versionTotals(v)
              const included = v.sections.filter(isIncluded)
              return (
                <div key={v.position} className={`pdf-slot ok ${v.position === 2 ? 'featured' : ''}`}>
                  <div>
                    <div className="label" style={{ color: v.position === 2 ? 'var(--nova-ink)' : 'var(--ink-subtle)' }}>
                      Livello {v.position}{v.position === 2 ? ' · consigliato' : ''}
                    </div>
                    <div className="section-title" style={{ marginTop: 4 }}>{v.name}</div>
                    {v.tagline && <div className="meta">{v.tagline}</div>}
                  </div>
                  <div className="price-sm num">{money(t.total)} <span className="meta">+IVA</span></div>
                  <ul className="mini-list">
                    {included.map(s => (
                      <li key={s.category_code}>
                        <span><strong>{catOf(s.category_code)?.name}</strong>{s.note ? <span className="muted"> · {s.note}</span> : null}</span>
                        <span className="num">{sectionTotal(s) > 0 ? money(sectionTotal(s)) : 'Incluso'}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="meta">Fee {v.production_fee_pct}%{Number(v.discount) > 0 ? ` · sconto ${money(Number(v.discount))}` : ''} · IVA {v.vat_pct}%</div>
                  <div className="ref-block">
                    <div className="label subtle">Reference</div>
                    {(v.references ?? []).length === 0 && <div className="meta">Nessuna reference per questo pacchetto.</div>}
                    {(v.references ?? []).map(r => (
                      <div key={r.id} className="ref-row">
                        <RefThumb r={r} />
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <strong style={{ fontSize: 13 }}>{r.title}</strong>
                          {r.note && <span className="meta" style={{ display: 'block' }}>{r.note}</span>}
                        </span>
                        <button className="btn btn-ghost btn-sm" aria-label={`Elimina la reference ${r.title}`} onClick={() => removeRef(r)}><IconTrash size={14} /></button>
                      </div>
                    ))}
                    <button className="btn btn-soft btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setRefFor(v.position)}>
                      + Aggiungi reference
                    </button>
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <button className="btn btn-outline btn-sm"
                      onClick={() => { setReplacing(v.position); setSlot({ kind: 'empty' }) }}>
                      Sostituisci PDF
                    </button>
                    {versions.length > 2 && (
                      <button className="btn btn-ghost btn-sm" onClick={() => removeVersion(v)}>Togli questa versione</button>
                    )}
                  </div>
                </div>
              )
            })}
            {DEFAULT_VERSIONS.filter(d => !versions.some(v => v.position === d.position)).map(d => (
              <div key={d.position} className="pdf-slot">
                <div>
                  <div className="label subtle">Livello {d.position}</div>
                  <div className="section-title" style={{ marginTop: 4 }}>{d.name}</div>
                  <div className="meta">Non incluso: il cliente vede solo {versions.length} versioni.</div>
                </div>
                <div className="pdf-drop">
                  <button className="btn btn-outline btn-sm" onClick={() => { setReplacing(d.position); setSlot({ kind: 'empty' }) }}>
                    + Aggiungi con un PDF
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Lavori da mostrare: stessa sezione delle versioni, sotto le card */}
          <div className="works-pick stack">
          <div>
            <h3 className="section-title">Categoria di evento e lavori da mostrare</h3>
            <p className="meta" style={{ margin: '4px 0 0' }}>
              Scegli il servizio che stai vendendo: il cliente vede girare i lavori di quel servizio.
              Se selezioni dei lavori singoli, vede solo quelli. Gestisci la libreria in <Link to="/lavori">Lavori</Link>.
            </p>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {SERVICES.map(sv => {
              const on = quote.services.includes(sv)
              return (
                <button key={sv} className={`chip ${on ? 'on' : ''}`}
                  onClick={() => setQ({ services: on ? quote.services.filter(x => x !== sv) : [...quote.services, sv] })}>
                  {on && <IconStar size={12} />}{sv}
                </button>
              )
            })}
          </div>
          <details>
            <summary className="label subtle" style={{ cursor: 'pointer' }}>Oppure scegli lavori singoli ({picked.length})</summary>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {works.map(w => {
                const on = picked.includes(w.id)
                return (
                  <button key={w.id} className={`chip ${on ? 'on' : ''}`}
                    onClick={() => { setPicked(p => (on ? p.filter(x => x !== w.id) : [...p, w.id])); setDirty(true) }}>
                    {on && <IconStar size={12} />}{w.brand ? `${w.brand} · ` : ''}{w.title}
                  </button>
                )
              })}
            </div>
          </details>
          </div>
        </section>

        <section className="card stack">
          <h2 className="section-title">Messaggio per il cliente</h2>
          <textarea className="textarea" value={quote.intro ?? ''} onChange={e => setQ({ intro: e.target.value })}
            placeholder="Facoltativo: due righe sul progetto, il cliente le legge in apertura." />
        </section>

        <div className="row">
          <button className="btn btn-danger" onClick={remove}><IconTrash size={16} /> Elimina quotation</button>
        </div>
      </div>

      {replacing !== null && (
        <div className="modal-scrim" onClick={() => slot.kind !== 'reading' && !saving && setReplacing(null)}>
          <div className="modal stack" onClick={e => e.stopPropagation()}>
            <h2 className="section-title">{replacingVersion ? `Sostituisci il PDF di ${replacingVersion.name}` : `Aggiungi il livello ${replacing}`}</h2>
            <PdfSlot label={replacingVersion?.name ?? DEFAULT_VERSIONS.find(d => d.position === replacing)?.name ?? ''} hint={`Livello ${replacing}`} state={slot} onChange={setSlot} />
            <div className="row">
              <div className="spacer" />
              <button className="btn btn-ghost" onClick={() => setReplacing(null)} disabled={saving}>Annulla</button>
              <button className="btn btn-nova" onClick={applyReplacement} disabled={slot.kind !== 'ok' || saving}>{saving ? 'Aggiorno…' : 'Usa questo PDF'}</button>
            </div>
          </div>
        </div>
      )}
      {refFor !== null && (
        <RefModal quoteId={quote.id} position={refFor} versionName={versions.find(v => v.position === refFor)?.name ?? ''}
          onClose={() => setRefFor(null)}
          onSaved={r => {
            setVersions(vs => vs.map(v => (v.position === refFor ? { ...v, references: [...(v.references ?? []), r] } : v)))
            setRefFor(null)
            toast.show('Reference aggiunta')
          }} />
      )}
      {toast.node}
    </>
  )
}

function RefThumb({ r }: { r: Reference }) {
  if (r.media_type === 'image') return <img className="ref-thumb" src={r.media_url} alt="" />
  if (r.media_type === 'video') return <video className="ref-thumb" src={r.media_url} muted playsInline preload="metadata" />
  return <span className="ref-thumb ref-thumb-link">Link</span>
}

// Pop-up per caricare una reference (immagine, video o link) su un pacchetto
function RefModal({ quoteId, position, versionName, onClose, onSaved }: {
  quoteId: string; position: number; versionName: string; onClose: () => void; onSaved: (r: Reference) => void
}) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!file && !link.trim()) return setError('Carica un file oppure incolla un link.')
    setBusy(true)
    setError(null)
    try {
      const media_type: Reference['media_type'] = file ? (file.type.startsWith('video') ? 'video' : 'image') : /\.(mp4|webm|mov)(\?|$)/i.test(link) ? 'video' : /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(link) ? 'image' : 'link'
      const media_url = file ? await uploadMedia(file, `references/${quoteId}`) : link.trim()
      const r = await addReference({ quote_id: quoteId, version_position: position, title: title.trim() || 'Reference', note: note.trim() || null, media_url, media_type })
      onSaved(r)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="modal-scrim" onClick={() => !busy && onClose()}>
      <form className="modal stack" onClick={e => e.stopPropagation()} onSubmit={save}>
        <h2 className="section-title">Reference per {versionName}</h2>
        <p className="meta" style={{ margin: 0 }}>Il cliente la vede dentro questo pacchetto, sotto le voci.</p>
        <label className="field"><span>Titolo</span>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Es. Mood del video recap" required />
        </label>
        <label className="field"><span>Nota (facoltativa)</span>
          <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Es. Stesso taglio, 60 secondi, musica up-beat" />
        </label>
        <label className="field"><span>File (immagine o video)</span>
          <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label className="field"><span>…oppure un link</span>
          <input className="input" value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" disabled={!!file} />
        </label>
        {error && <div className="pill pill-danger" style={{ whiteSpace: 'normal' }}>{error}</div>}
        <div className="row">
          <div className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Annulla</button>
          <button className="btn" disabled={busy}>{busy ? 'Carico…' : 'Aggiungi'}</button>
        </div>
      </form>
    </div>
  )
}
