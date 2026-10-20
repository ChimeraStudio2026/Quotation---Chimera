import { useState } from 'react'
import { addReference, uploadMedia } from '../lib/quoteData'
import type { Reference } from '../lib/types'

// Reference ancora da caricare (pagina Nuova quotation: la quotation non esiste ancora)
export type RefDraft = { title: string; note: string | null; file: File | null; link: string; preview: string; media_type: Reference['media_type'] }

const typeOf = (file: File | null, link: string): Reference['media_type'] =>
  file ? (file.type.startsWith('video') ? 'video' : 'image')
    : /\.(mp4|webm|mov)(\?|$)/i.test(link) ? 'video' : /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(link) ? 'image' : 'link'

// Carica le reference in attesa sulla quotation appena creata
export async function uploadDrafts(quoteId: string, position: number, drafts: RefDraft[]) {
  for (const d of drafts) {
    const media_url = d.file ? await uploadMedia(d.file, `references/${quoteId}`) : d.link
    await addReference({ quote_id: quoteId, version_position: position, title: d.title, note: d.note, media_url, media_type: d.media_type })
  }
}

export function RefThumb({ r }: { r: Pick<Reference, 'media_type' | 'media_url'> }) {
  if (r.media_type === 'image') return <img className="ref-thumb" src={r.media_url} alt="" />
  if (r.media_type === 'video') return <video className="ref-thumb" src={r.media_url} muted playsInline preload="metadata" />
  return <span className="ref-thumb ref-thumb-link">Link</span>
}

// Pop-up per una reference (immagine, video o link) su un pacchetto.
// Con quoteId la carica subito; senza, restituisce la bozza da caricare alla creazione.
export function RefModal({ quoteId, position, versionName, onClose, onSaved, onDraft }: {
  quoteId?: string; position: number; versionName: string; onClose: () => void
  onSaved?: (r: Reference) => void; onDraft?: (d: RefDraft) => void
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
    const media_type = typeOf(file, link)
    const base = { title: title.trim() || 'Reference', note: note.trim() || null }
    if (!quoteId) {
      onDraft?.({ ...base, file, link: link.trim(), preview: file ? URL.createObjectURL(file) : link.trim(), media_type })
      return
    }
    setBusy(true)
    setError(null)
    try {
      const media_url = file ? await uploadMedia(file, `references/${quoteId}`) : link.trim()
      onSaved?.(await addReference({ quote_id: quoteId, version_position: position, ...base, media_url, media_type }))
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
