import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadCategories, loadWorks } from '../lib/quoteData'
import { SERVICES, type Category, type Work } from '../lib/types'
import { VideoTile } from '../components/VideoTile'
import { IconPlus, IconStar, IconTrash } from '../components/Icons'
import { useToast } from '../components/Toast'

type Draft = Omit<Work, 'id' | 'position'> & { id?: string; position?: number }
const blank: Draft = { title: '', brand: '', description: '', video_url: '', poster_url: '', logo_url: '', link_url: '', service: null, categories: [], featured: false }

async function upload(file: File) {
  const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`
  const { error } = await supabase.storage.from('works').upload(path, file, { contentType: file.type })
  if (error) throw error
  return supabase.storage.from('works').getPublicUrl(path).data.publicUrl
}

export function Works() {
  const [cats, setCats] = useState<Category[]>([])
  const [works, setWorks] = useState<Work[] | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const refresh = () => loadWorks().then(setWorks).catch(e => toast.show(e.message))
  useEffect(() => {
    loadCategories().then(setCats)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>, field: 'video_url' | 'poster_url' | 'logo_url') {
    const file = e.target.files?.[0]
    if (!file || !draft) return
    setBusy(true)
    try {
      const url = await upload(file)
      setDraft(d => (d ? { ...d, [field]: url } : d))
    } catch (err) {
      toast.show(`Upload non riuscito: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    setBusy(true)
    const row = {
      title: draft.title,
      brand: draft.brand || null,
      description: draft.description || null,
      video_url: draft.video_url,
      poster_url: draft.poster_url || null,
      logo_url: draft.logo_url || null,
      link_url: draft.link_url || null,
      service: draft.service || null,
      categories: draft.categories,
      featured: draft.featured,
    }
    const { error } = draft.id
      ? await supabase.from('works').update(row).eq('id', draft.id)
      : await supabase.from('works').insert({ ...row, position: works?.length ?? 0 })
    setBusy(false)
    if (error) return toast.show(error.message)
    setDraft(null)
    toast.show('Lavoro salvato')
    refresh()
  }

  async function remove(id: string) {
    if (!confirm('Eliminare questo lavoro dalla libreria?')) return
    const { error } = await supabase.from('works').delete().eq('id', id)
    if (error) return toast.show(error.message)
    setDraft(null)
    refresh()
  }

  const shown = works?.filter(w => !filter || w.categories.includes(filter)) ?? []
  const catName = (code: string) => cats.find(c => c.code === code)?.name ?? code

  return (
    <>
      <div className="page-head">
        <div>
          <div className="breadcrumb">Preventivi</div>
          <h1 className="page-title">Lavori</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            I nostri lavori migliori. Collega ogni video ai servizi: il cliente li vede girare sotto la quotation che sta guardando.
          </p>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={() => setDraft({ ...blank })}><IconPlus size={16} /> Aggiungi lavoro</button>
      </div>

      <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        <button className={`chip ${!filter ? 'on' : ''}`} onClick={() => setFilter(null)}>Tutti</button>
        {cats.map(c => (
          <button key={c.code} className={`chip ${filter === c.code ? 'on' : ''}`} onClick={() => setFilter(c.code)}>{c.name}</button>
        ))}
      </div>

      {works && shown.length === 0 && (
        <div className="empty">
          <p className="card-title" style={{ color: 'var(--ink)' }}>Nessun lavoro qui</p>
          <p>Aggiungi un video con un link YouTube o Vimeo, oppure carica un file mp4.</p>
        </div>
      )}

      <div className="works-grid">
        {shown.map(w => (
          <div key={w.id} className="stack" style={{ gap: 8 }}>
            <VideoTile work={w} />
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {w.featured && <span className="pill pill-nova"><IconStar size={12} /> In evidenza</span>}
              {w.service && <span className="pill pill-success">{w.service}</span>}
              {w.categories.map(c => <span key={c} className="pill pill-pending">{catName(c)}</span>)}
            </div>
            <div><button className="btn btn-outline btn-sm" onClick={() => setDraft({ ...w })}>Modifica</button></div>
          </div>
        ))}
      </div>

      {draft && (
        <div className="modal-scrim" onClick={() => !busy && setDraft(null)}>
          <form className="modal stack" onClick={e => e.stopPropagation()} onSubmit={save}>
            <h2 className="section-title">{draft.id ? 'Modifica lavoro' : 'Nuovo lavoro'}</h2>
            <div className="grid-2">
              <label className="field"><span>Brand</span>
                <input className="input" value={draft.brand ?? ''} onChange={e => setDraft({ ...draft, brand: e.target.value })} placeholder="Nutella" />
              </label>
              <label className="field"><span>Titolo</span>
                <input className="input" required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Tour Italia — recap" />
              </label>
            </div>
            <label className="field"><span>Descrizione breve</span>
              <input className="input" value={draft.description ?? ''} onChange={e => setDraft({ ...draft, description: e.target.value })} />
            </label>
            <label className="field"><span>Video (link YouTube, Vimeo o mp4)</span>
              <input className="input" required value={draft.video_url} onChange={e => setDraft({ ...draft, video_url: e.target.value })} placeholder="https://vimeo.com/…" />
            </label>
            <label className="field"><span>…oppure carica il file video</span>
              <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e => onFile(e, 'video_url')} />
            </label>
            <div className="grid-2">
              <label className="field"><span>Copertina {draft.poster_url ? '✓' : '(opzionale)'}</span>
                <input type="file" accept="image/*" onChange={e => onFile(e, 'poster_url')} />
              </label>
              <label className="field"><span>Logo del brand {draft.logo_url ? '✓' : '(opzionale)'}</span>
                <input type="file" accept="image/*" onChange={e => onFile(e, 'logo_url')} />
              </label>
            </div>
            <label className="field"><span>Link al caso studio (opzionale)</span>
              <input className="input" value={draft.link_url ?? ''} onChange={e => setDraft({ ...draft, link_url: e.target.value })} placeholder="https://chimerastudioss.com/case-studies/…" />
            </label>
            <div className="field">
              <span>Servizio</span>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {SERVICES.map(sv => (
                  <button type="button" key={sv} className={`chip ${draft.service === sv ? 'on' : ''}`}
                    onClick={() => setDraft({ ...draft, service: draft.service === sv ? null : sv })}>{sv}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>Voci del preventivo collegate</span>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {cats.map(c => {
                  const on = draft.categories.includes(c.code)
                  return (
                    <button type="button" key={c.code} className={`chip ${on ? 'on' : ''}`}
                      onClick={() => setDraft({ ...draft, categories: on ? draft.categories.filter(x => x !== c.code) : [...draft.categories, c.code] })}>
                      {c.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={draft.featured} onChange={e => setDraft({ ...draft, featured: e.target.checked })} />
              <span>In evidenza: compare per primo</span>
            </label>
            <div className="row">
              {draft.id && <button type="button" className="btn btn-danger" onClick={() => remove(draft.id!)}><IconTrash size={16} /></button>}
              <div className="spacer" />
              <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)} disabled={busy}>Annulla</button>
              <button className="btn" disabled={busy}>{busy ? 'Attendi…' : 'Salva'}</button>
            </div>
          </form>
        </div>
      )}
      {toast.node}
    </>
  )
}
