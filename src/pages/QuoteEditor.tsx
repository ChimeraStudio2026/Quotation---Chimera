import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { appUrl, supabase } from '../lib/supabase'
import { loadCategories, loadQuote, loadWorks, saveQuote } from '../lib/quoteData'
import { isIncluded, itemTotal, money, sectionTotal, versionTotals } from '../lib/calc'
import type { Category, Item, Quote, Section, Version, Work } from '../lib/types'
import { StatusPill } from '../components/StatusPill'
import { IconChevron, IconCopy, IconEye, IconLink, IconPlus, IconStar, IconTrash } from '../components/Icons'
import { useToast } from '../components/Toast'

const emptyItem = (code: string): Item => ({ position: 0, code, job: '', note: '', qty: 1, days: 1, unit_price: 0, nic_pct: 0 })

// Ogni versione mostra sempre tutte le categorie A–O, anche quelle vuote
function withAllSections(v: Version, cats: Category[]): Version {
  return {
    ...v,
    sections: cats.map(c => v.sections.find(s => s.category_code === c.code) ?? { category_code: c.code, note: '', extras: 0, items: [] }),
  }
}

const itemPrefix = (code: string) => code.split('_')[0].slice(0, 4)

export function QuoteEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [cats, setCats] = useState<Category[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [works, setWorks] = useState<Work[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [active, setActive] = useState(1)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([loadCategories(), loadQuote(id), loadWorks()])
      .then(([c, q, w]) => {
        setCats(c)
        setQuote(q.quote)
        setVersions(q.versions.map(v => withAllSections(v, c)))
        setPicked(q.pickedWorks)
        setWorks(w)
      })
      .catch(e => setError(e.message))
  }, [id])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const version = versions[active]
  const totals = useMemo(() => (version ? versionTotals(version) : null), [version])

  if (error) return <div className="pill pill-danger">{error}</div>
  if (!quote || !version || !totals) return <p className="muted">Carico la quotation…</p>

  const setQ = (patch: Partial<Quote>) => { setQuote({ ...quote, ...patch }); setDirty(true) }
  const setV = (patch: Partial<Version>) => {
    setVersions(vs => vs.map((v, i) => (i === active ? { ...v, ...patch } : v)))
    setDirty(true)
  }
  const setS = (code: string, fn: (s: Section) => Section) =>
    setV({ sections: version.sections.map(s => (s.category_code === code ? fn(s) : s)) })

  function copyFrom(fromIdx: number) {
    const src = versions[fromIdx]
    if (!confirm(`Sostituire il contenuto di "${version.name}" con quello di "${src.name}"?`)) return
    setV({
      production_fee_pct: src.production_fee_pct,
      discount: src.discount,
      vat_pct: src.vat_pct,
      sections: src.sections.map(s => ({ ...s, id: undefined, items: s.items.map(i => ({ ...i, id: undefined })) })),
    })
  }

  async function save(silent = false) {
    setSaving(true)
    try {
      await saveQuote(quote!, versions, picked)
      const fresh = await loadQuote(quote!.id)
      setQuote(fresh.quote)
      setVersions(fresh.versions.map(v => withAllSections(v, cats)))
      setDirty(false)
      if (!silent) toast.show('Quotation salvata')
      return true
    } catch (e) {
      toast.show(`Errore: ${(e as Error).message}`)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function share() {
    if (!(await save(true))) return
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
    if (dirty && !(await save(true))) return
    window.open(appUrl(`anteprima/${quote!.id}`), '_blank')
  }

  async function remove() {
    if (!confirm('Eliminare questa quotation e tutte le sue versioni?')) return
    const { error } = await supabase.from('quotes').delete().eq('id', quote!.id)
    if (error) toast.show(error.message)
    else navigate('/')
  }

  const selectedVersion = versions.find(v => v.id === quote.selected_version_id)

  return (
    <>
      <div className="page-head">
        <div>
          <div className="breadcrumb"><Link to="/">Quotation</Link> / {quote.code || 'Nuova'}</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <h1 className="page-title">{quote.title || 'Senza titolo'}</h1>
            <StatusPill status={quote.status} label={selectedVersion ? `Scelta: ${selectedVersion.name}` : undefined} />
          </div>
        </div>
        <div className="spacer" />
        <button className="btn btn-outline" onClick={preview}><IconEye size={16} /> Anteprima</button>
        <button className="btn btn-outline" onClick={() => save()} disabled={saving || !dirty}>{saving ? 'Salvo…' : dirty ? 'Salva' : 'Salvata'}</button>
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
        <section className="card stack">
          <h2 className="section-title">Cliente e progetto</h2>
          <div className="grid-3">
            <label className="field"><span>Codice</span>
              <input className="input" value={quote.code ?? ''} onChange={e => setQ({ code: e.target.value })} placeholder="CS1453" />
            </label>
            <label className="field" style={{ gridColumn: 'span 2' }}><span>Titolo del progetto</span>
              <input className="input" value={quote.title} onChange={e => setQ({ title: e.target.value })} placeholder="Nutella tour Italia" />
            </label>
          </div>
          <div className="grid-3">
            <label className="field"><span>Cliente</span>
              <input className="input" value={quote.client_name} onChange={e => setQ({ client_name: e.target.value })} />
            </label>
            <label className="field"><span>P. IVA</span>
              <input className="input" value={quote.client_vat ?? ''} onChange={e => setQ({ client_vat: e.target.value })} />
            </label>
            <label className="field"><span>Indirizzo</span>
              <input className="input" value={quote.client_address ?? ''} onChange={e => setQ({ client_address: e.target.value })} />
            </label>
          </div>
          <div className="grid-3">
            <label className="field"><span>Data</span>
              <input className="input" type="date" value={quote.quote_date} onChange={e => setQ({ quote_date: e.target.value })} />
            </label>
            <label className="field"><span>Validità (giorni)</span>
              <input className="input" type="number" min={1} value={quote.validity_days} onChange={e => setQ({ validity_days: Number(e.target.value) })} />
            </label>
          </div>
          <label className="field"><span>Messaggio per il cliente</span>
            <textarea className="textarea" value={quote.intro ?? ''} onChange={e => setQ({ intro: e.target.value })}
              placeholder="Due righe sul progetto: le vede il cliente in apertura." />
          </label>
        </section>

        <section className="card stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <h2 className="section-title">Le 3 versioni</h2>
            <div className="spacer" />
            <div className="tabs">
              {versions.map((v, i) => (
                <button key={v.position} className={`tab ${i === active ? 'active' : ''}`} onClick={() => setActive(i)}>
                  {v.position === 2 && <IconStar size={14} />}
                  {v.name} · {money(versionTotals(v).total)}
                </button>
              ))}
            </div>
          </div>
          <p className="meta" style={{ margin: 0 }}>
            La versione centrale è quella consigliata e il cliente la vede in evidenza. Il prezzo di ogni categoria è la somma delle sue voci.
          </p>

          <div className="grid-3">
            <label className="field"><span>Nome versione</span>
              <input className="input" value={version.name} onChange={e => setV({ name: e.target.value })} />
            </label>
            <label className="field" style={{ gridColumn: 'span 2' }}><span>Frase breve</span>
              <input className="input" value={version.tagline ?? ''} onChange={e => setV({ tagline: e.target.value })} />
            </label>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className="meta">Parti da un'altra versione:</span>
            {versions.map((v, i) => i !== active && (
              <button key={v.position} className="btn btn-soft btn-sm" onClick={() => copyFrom(i)}><IconCopy size={14} /> Copia da {v.name}</button>
            ))}
          </div>

          <div>
            {cats.map(c => {
              const s = version.sections.find(x => x.category_code === c.code)!
              const on = isIncluded(s)
              return (
                <details key={c.code} className="section-edit">
                  <summary>
                    <span className={`letter ${on ? 'on' : ''}`}>{c.letter}</span>
                    <span className="card-title">{c.name}</span>
                    <span className="meta hide-sm">{s.note || (on ? '' : 'Non inclusa')}</span>
                    <span className="num" style={{ textAlign: 'right', fontWeight: 600 }}>{money(sectionTotal(s))}</span>
                    <IconChevron size={18} />
                  </summary>
                  <div className="section-body">
                    <div className="grid-2">
                      <label className="field"><span>Nota (la vede il cliente)</span>
                        <input className="input" value={s.note ?? ''} placeholder="es. 5 x Content Creator con Camera"
                          onChange={e => setS(c.code, x => ({ ...x, note: e.target.value }))} />
                      </label>
                      <label className="field"><span>Extras (€)</span>
                        <input className="input" type="number" step="0.01" value={s.extras}
                          onChange={e => setS(c.code, x => ({ ...x, extras: Number(e.target.value) }))} />
                      </label>
                    </div>
                    {s.items.length > 0 && (
                      <div className="items-wrap">
                        <table className="items-table">
                          <thead>
                            <tr>
                              <th style={{ width: 120 }}>ID</th><th>Voce</th><th>Nota</th>
                              <th className="r" style={{ width: 70 }}>Q.tà</th><th className="r" style={{ width: 70 }}>Giorni</th>
                              <th className="r" style={{ width: 110 }}>Prezzo unit.</th><th className="r" style={{ width: 70 }}>NIC %</th>
                              <th className="r" style={{ width: 110 }}>Totale</th><th style={{ width: 40 }} />
                            </tr>
                          </thead>
                          <tbody>
                            {s.items.map((it, idx) => {
                              const upd = (patch: Partial<Item>) =>
                                setS(c.code, x => ({ ...x, items: x.items.map((y, j) => (j === idx ? { ...y, ...patch } : y)) }))
                              return (
                                <tr key={idx}>
                                  <td><input className="input" value={it.code ?? ''} onChange={e => upd({ code: e.target.value })} /></td>
                                  <td><input className="input" value={it.job} placeholder="Producer" onChange={e => upd({ job: e.target.value })} /></td>
                                  <td><input className="input" value={it.note ?? ''} onChange={e => upd({ note: e.target.value })} /></td>
                                  <td><input className="input num" type="number" step="any" value={it.qty} onChange={e => upd({ qty: Number(e.target.value) })} /></td>
                                  <td><input className="input num" type="number" step="any" value={it.days} onChange={e => upd({ days: Number(e.target.value) })} /></td>
                                  <td><input className="input num" type="number" step="0.01" value={it.unit_price} onChange={e => upd({ unit_price: Number(e.target.value) })} /></td>
                                  <td><input className="input num" type="number" step="any" value={it.nic_pct} onChange={e => upd({ nic_pct: Number(e.target.value) })} /></td>
                                  <td className="r num">{money(itemTotal(it))}</td>
                                  <td>
                                    <button className="btn btn-ghost btn-sm" aria-label="Elimina voce"
                                      onClick={() => setS(c.code, x => ({ ...x, items: x.items.filter((_, j) => j !== idx) }))}>
                                      <IconTrash size={16} />
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div>
                      <button className="btn btn-outline btn-sm" onClick={() =>
                        setS(c.code, x => ({
                          ...x,
                          items: [...x.items, emptyItem(`${itemPrefix(c.code)}_${String(x.items.length + 1).padStart(2, '0')}`)],
                        }))}>
                        <IconPlus size={14} /> Aggiungi voce
                      </button>
                    </div>
                  </div>
                </details>
              )
            })}
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div className="grid-3">
              <label className="field"><span>Production fee %</span>
                <input className="input" type="number" step="any" value={version.production_fee_pct} onChange={e => setV({ production_fee_pct: Number(e.target.value) })} />
              </label>
              <label className="field"><span>Sconto (€)</span>
                <input className="input" type="number" step="0.01" value={version.discount} onChange={e => setV({ discount: Number(e.target.value) })} />
              </label>
              <label className="field"><span>IVA %</span>
                <input className="input" type="number" step="any" value={version.vat_pct} onChange={e => setV({ vat_pct: Number(e.target.value) })} />
              </label>
            </div>
            <div className="totals num" style={{ background: 'var(--surface-muted)', padding: 20, borderRadius: 'var(--radius-lg)' }}>
              <span>Subtotale</span><span>{money(totals.subtotal)}</span>
              <span>Production fee {version.production_fee_pct}%</span><span>{money(totals.fee)}</span>
              {Number(version.discount) > 0 && (<><span>Sconto</span><span>−{money(Number(version.discount))}</span></>)}
              {totals.extras > 0 && (<><span className="muted">Extras (a parte)</span><span className="muted">{money(totals.extras)}</span></>)}
              <span className="grand">Totale</span><span className="grand">{money(totals.total)} <span className="meta">+IVA</span></span>
              <span className="muted">Totale + IVA</span><span className="muted">{money(totals.totalVat)}</span>
            </div>
          </div>
        </section>

        <section className="card stack">
          <div>
            <h2 className="section-title">Lavori da mostrare</h2>
            <p className="meta" style={{ margin: '4px 0 0' }}>
              Se non selezioni niente, il cliente vede in automatico i lavori collegati ai servizi inclusi.
              Altrimenti vede solo quelli che scegli qui. Gestisci la libreria in <Link to="/lavori">Lavori</Link>.
            </p>
          </div>
          {works.length === 0 ? (
            <div className="empty">Nessun lavoro in libreria. <Link to="/lavori">Aggiungi i primi video</Link>.</div>
          ) : (
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
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
          )}
        </section>

        <div className="row">
          <button className="btn btn-danger" onClick={remove}><IconTrash size={16} /> Elimina quotation</button>
        </div>
      </div>
      {toast.node}
    </>
  )
}
