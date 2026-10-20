import { useRef, useState } from 'react'
import type { ParsedQuote } from '../lib/cerberoParser'
import { money } from '../lib/calc'
import { IconCheck, IconDoc } from './Icons'

export type SlotState =
  | { kind: 'empty' }
  | { kind: 'reading'; file: string; step: string }
  | { kind: 'ok'; file: string; parsed: ParsedQuote }
  | { kind: 'error'; file: string; message: string }

// Riquadro dove si trascina (o si sceglie) il PDF di un livello
export function PdfSlot({ label, hint, featured, state, onChange, children }: {
  label: string; hint: string; featured?: boolean; state: SlotState; onChange: (s: SlotState) => void; children?: React.ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  async function handle(file: File | undefined) {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      onChange({ kind: 'error', file: file.name, message: 'Serve un file PDF.' })
      return
    }
    onChange({ kind: 'reading', file: file.name, step: 'Leggo il PDF…' })
    try {
      // pdf.js e l'OCR si caricano solo quando serve leggere un PDF
      const { readQuotePdf } = await import('../lib/pdfImport')
      const parsed = await readQuotePdf(file, step => onChange({ kind: 'reading', file: file.name, step }))
      if (!parsed.sections.length) throw new Error(parsed.warnings[0] ?? 'Non trovo nessuna voce nel PDF.')
      onChange({ kind: 'ok', file: file.name, parsed })
    } catch (e) {
      onChange({ kind: 'error', file: file.name, message: (e as Error).message || 'Non riesco a leggere questo PDF.' })
    }
  }

  const total = state.kind === 'ok' ? state.parsed.totals.total : null

  return (
    <div
      className={`pdf-slot ${featured ? 'featured' : ''} ${over ? 'over' : ''} ${state.kind}`}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]) }}
    >
      <div>
        <div className="label" style={{ color: featured ? 'var(--nova-ink)' : 'var(--ink-subtle)' }}>{hint}</div>
        <div className="section-title" style={{ marginTop: 4 }}>{label}</div>
      </div>

      {state.kind === 'empty' && (
        <div className="pdf-drop">
          <IconDoc size={28} />
          <span>Trascina qui il PDF di Cerbero</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => input.current?.click()}>Scegli il file</button>
        </div>
      )}
      {state.kind === 'reading' && (
        <div className="pdf-drop"><span className="spinner" aria-hidden /> <span>{state.step}</span></div>
      )}
      {state.kind === 'ok' && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="pill pill-success" style={{ alignSelf: 'flex-start' }}><IconCheck size={12} /> Letto</div>
          <div className="meta" style={{ wordBreak: 'break-word' }}>{state.file}</div>
          {state.parsed.versionLabel && <div className="card-title">{state.parsed.versionLabel}</div>}
          <div className="price-sm num">{total != null ? money(total) : '—'} <span className="meta">+IVA</span></div>
          <div className="meta">{state.parsed.sections.length} voci · {state.parsed.sections.reduce((n, s) => n + s.items.length, 0)} righe di dettaglio</div>
          {state.parsed.warnings.map(w => <div key={w} className="pill pill-warning" style={{ whiteSpace: 'normal' }}>{w}</div>)}
          {children}
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => input.current?.click()}>Cambia PDF</button>
        </div>
      )}
      {state.kind === 'error' && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="pill pill-danger" style={{ whiteSpace: 'normal' }}>{state.message}</div>
          <div className="meta">{state.file}</div>
          <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => input.current?.click()}>Prova un altro PDF</button>
        </div>
      )}
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={e => { handle(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}
