import { useEffect, useRef, useState } from 'react'
import { askAssistant, formatReply, quoteToDraft, type AssistantResult, type ChatTurn } from '../lib/assistant'
import type { Quote, Version } from '../lib/types'

const EXAMPLE = 'Campagna social per un brand cosmetico, cliente diretto. 1 giorno di shooting a Milano in location, '
  + '5 attori non professionisti, regista e DOP, trucco e styling. Consegna 5 reel 30s 9:16 e 10 foto. '
  + 'Fammi 3 versioni, la Signature intorno ai 19k.'

// La chat resta nel browser per la sessione: la quotation completa viaggia comunque a ogni richiesta
const storageKey = (quoteId: string) => `assistente:${quoteId}`

function loadTurns(quoteId: string): ChatTurn[] {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(quoteId)) ?? '[]')
  } catch {
    return []
  }
}

type Props = {
  quote: Quote
  versions: Version[]
  onResult: (result: AssistantResult) => Promise<boolean>
  autoFocus?: boolean
  /** Brief scritto nella sezione Assistente: parte da solo appena si apre la quotation */
  initialMessage?: string
}

export function AssistantChat({ quote, versions, onResult, autoFocus, initialMessage }: Props) {
  const [turns, setTurns] = useState<ChatTurn[]>(() => loadTurns(quote.id))
  const [message, setMessage] = useState(initialMessage ?? '')
  const sentInitial = useRef(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(quote.id), JSON.stringify(turns))
    } catch {
      // Storage non disponibile: la chat vale solo finché la pagina è aperta
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [quote.id, turns, sending])

  useEffect(() => {
    if (!initialMessage || sentInitial.current || turns.length) return
    sentInitial.current = true
    send(initialMessage)
    // Solo all'apertura: il brief iniziale si invia una volta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function send(override?: string) {
    const text = (override ?? message).trim()
    if (!text || sending) return
    setSending(true)
    setError(null)
    setTurns(t => [...t, { role: 'user', content: text }])
    setMessage('')
    try {
      const result = await askAssistant(text, quoteToDraft(quote, versions), turns)
      if (await onResult(result)) setTurns(t => [...t, { role: 'assistant', content: formatReply(result) }])
      else throw new Error('Non sono riuscito a salvare la quotation aggiornata.')
    } catch (e) {
      setError((e as Error).message)
      // Il testo torna nella casella così si può riprovare senza riscriverlo
      setMessage(text)
      setTurns(t => t.slice(0, -1))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="card stack assistant">
      <div>
        <h2 className="section-title">Assistente</h2>
        <p className="meta" style={{ margin: '4px 0 0' }}>
          Descrivi il lavoro e quante versioni vuoi: preparo voci, giorni e note dal listino. Poi chiedimi le modifiche,
          ad esempio «nella Premium aggiungi il drone». I prezzi li prendo sempre dal listino.
        </p>
      </div>
      {(turns.length > 0 || sending) && (
        <div className="assistant-messages" ref={listRef}>
          {turns.map((t, i) => <div key={i} className={`assistant-msg ${t.role}`}>{t.content}</div>)}
          {sending && <div className="assistant-msg assistant pending">Sto preparando la quotation…</div>}
        </div>
      )}
      {turns.length === 0 && !sending && (
        <button type="button" className="assistant-example" onClick={() => setMessage(EXAMPLE)}>
          <span className="label subtle">Esempio</span>
          {EXAMPLE}
        </button>
      )}
      <textarea className="textarea" value={message} autoFocus={autoFocus} disabled={sending}
        onChange={e => setMessage(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() } }}
        placeholder={turns.length ? 'Es. togli il drone dalla Essential, metti 2 giorni di shooting…' : 'Cosa ti serve?'} />
      {error && <div className="pill pill-danger" style={{ whiteSpace: 'normal' }}>{error}</div>}
      <div className="row">
        <span className="meta">Ctrl/⌘ + Invio per inviare</span>
        <div className="spacer" />
        <button className="btn btn-nova" onClick={() => send()} disabled={sending || !message.trim()}>
          {sending ? 'Attendi…' : 'Invia'}
        </button>
      </div>
    </section>
  )
}
