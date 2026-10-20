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

// Pop-up per le reference (immagini, video o un link) di un pacchetto.
// Si possono scegliere più file insieme: ognuno diventa una reference.
// Con «Tutte le versioni» le stesse reference vanno in ogni pacchetto della quotation.
// Con quoteId le carica subito; senza, restituisce le bozze da caricare alla creazione.
export function RefModal({ quoteId, position, versionName, positions = [], onClose, onSaved, onDraft }: {
  quoteId?: string; position: number; versionName: string
  /** Pacchetti della quotation: con più di uno compare la spunta «Tutte le versioni» */
  positions?: number[]
  onClose: () => void
  onSaved?: (refs: Reference[]) => void
  onDraft?: (drafts: RefDraft[], allVersions: boolean) => void
}) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [link, setLink] = useState('')
  const [allVersions, setAllVersions] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canShare = positions.length > 1

  // Con un solo file il titolo è quello scritto; con più file si aggiunge il nome del file
  const titleFor = (file: File | null) => {
    const typed = title.trim()
    if (!file) return typed || 'Reference'
    const fromName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
    if (files.length === 1) return typed || fromName
    return typed ? `${typed} · ${fromName}` : fromName
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!files.length && !link.trim()) return setError('Carica almeno un file oppure incolla un link.')
    const sources: (File | null)[] = files.length ? files : [null]
    const targets = allVersions && canShare ? positions : [position]
    const noteValue = note.trim() || null
    if (!quoteId) {
      onDraft?.(sources.map(file => ({
        title: titleFor(file), note: noteValue, file, link: file ? '' : link.trim(),
        preview: file ? URL.createObjectURL(file) : link.trim(), media_type: typeOf(file, link),
      })), allVersions && canShare)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const saved: Reference[] = []
      for (const file of sources) {
        // Il file si carica una volta sola e si collega a tutti i pacchetti scelti
        const media_url = file ? await uploadMedia(file, `references/${quoteId}`) : link.trim()
        for (const target of targets) {
          saved.push(await addReference({
            quote_id: quoteId, version_position: target, title: titleFor(file), note: noteValue, media_url, media_type: typeOf(file, link),
          }))
        }
      }
      onSaved?.(saved)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="modal-scrim" onClick={() => !busy && onClose()}>
      <form className="modal stack" onClick={e => e.stopPropagation()} onSubmit={save}>
        <h2 className="section-title">Reference per {allVersions && canShare ? 'tutte le versioni' : versionName}</h2>
        <p className="meta" style={{ margin: 0 }}>Il cliente le vede dentro il pacchetto, sotto le voci.</p>
        <label className="field"><span>Titolo {files.length > 1 ? '(facoltativo: si aggiunge al nome di ogni file)' : ''}</span>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Es. Mood del video recap" required={files.length <= 1} />
        </label>
        <label className="field"><span>Nota (facoltativa)</span>
          <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Es. Stesso taglio, 60 secondi, musica up-beat" />
        </label>
        <label className="field"><span>File (immagini o video, anche più di uno)</span>
          <input type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime" onChange={e => setFiles(Array.from(e.target.files ?? []))} />
        </label>
        {files.length > 1 && <div className="meta">{files.length} file scelti: diventano {files.length} reference.</div>}
        <label className="field"><span>…oppure un link</span>
          <input className="input" value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" disabled={files.length > 0} />
        </label>
        {canShare && (
          <label className="row ref-all">
            <input type="checkbox" checked={allVersions} onChange={e => setAllVersions(e.target.checked)} />
            <span>Usa per tutte le versioni</span>
          </label>
        )}
        {error && <div className="pill pill-danger" style={{ whiteSpace: 'normal' }}>{error}</div>}
        <div className="row">
          <div className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Annulla</button>
          <button className="btn" disabled={busy}>{busy ? 'Carico…' : files.length > 1 ? `Aggiungi ${files.length}` : 'Aggiungi'}</button>
        </div>
      </form>
    </div>
  )
}
