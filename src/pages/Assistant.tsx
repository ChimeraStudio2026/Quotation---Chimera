import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const EXAMPLE = 'Campagna social per un brand cosmetico, cliente diretto. 1 giorno di shooting a Milano in location, '
  + '5 attori non professionisti, regista e DOP, trucco e styling. Consegna 5 reel 30s 9:16 e 10 foto. '
  + 'Fammi 3 versioni, la Signature intorno ai 19k.'

// Sezione interna: si scrive il brief, si crea la quotation e l'editor la fa preparare all'assistente
export function Assistant() {
  const navigate = useNavigate()
  const [brief, setBrief] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    const text = brief.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.from('quotes').insert({ title: 'Nuova quotation', client_name: 'Cliente' }).select('id').single()
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    navigate(`/quotation/${data.id}?assistente`, { state: { firstMessage: text } })
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Assistente preventivi</h1>
          <p className="muted" style={{ margin: '6px 0 0', maxWidth: 640 }}>
            Scrivi il brief e quante versioni vuoi. L'assistente prepara la quotation con le voci e i prezzi del listino;
            poi la ritocchi in chat o a mano, voce per voce.
          </p>
        </div>
      </div>
      <section className="card stack assistant">
        <textarea className="textarea" style={{ minHeight: 160 }} value={brief} autoFocus disabled={busy}
          onChange={e => setBrief(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); start() } }}
          placeholder="Cosa ti serve? Cliente, tipo di lavoro, giorni, consegne, budget, numero di versioni…" />
        {!brief && (
          <button type="button" className="assistant-example" onClick={() => setBrief(EXAMPLE)}>
            <span className="label subtle">Esempio</span>
            {EXAMPLE}
          </button>
        )}
        {error && <div className="pill pill-danger" style={{ whiteSpace: 'normal' }}>{error}</div>}
        <div className="row">
          <span className="meta">Ctrl/⌘ + Invio per inviare</span>
          <div className="spacer" />
          <button className="btn btn-nova" onClick={start} disabled={busy || !brief.trim()}>
            {busy ? 'Creo la quotation…' : 'Prepara la quotation'}
          </button>
        </div>
      </section>
    </>
  )
}
