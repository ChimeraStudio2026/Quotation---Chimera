import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { createQuote } from '../lib/quoteData'
import { fmtDate } from '../lib/calc'
import type { Quote } from '../lib/types'
import { StatusPill } from '../components/StatusPill'
import { IconPlus } from '../components/Icons'

type Row = Quote & { selected?: { name: string; position: number } | null }

export function Dashboard() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('quotes')
      .select('*, selected:quote_versions!quotes_selected_version_fk(name, position)')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setRows((data as Row[]) ?? [])
      })
  }, [])

  async function newQuote() {
    setCreating(true)
    try {
      const q = await createQuote({ title: 'Nuova quotation', client_name: 'Cliente' })
      navigate(`/quotation/${q.id}`)
    } catch (e) {
      setError((e as Error).message)
      setCreating(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="breadcrumb">Preventivi</div>
          <h1 className="page-title">Quotation</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>Ogni quotation ha 3 versioni: il cliente le confronta e ne sceglie una.</p>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={newQuote} disabled={creating}><IconPlus size={16} /> Nuova quotation</button>
      </div>

      {error && <div className="pill pill-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {rows && rows.length === 0 && (
        <div className="empty">
          <p className="card-title" style={{ color: 'var(--ink)' }}>Ancora nessuna quotation</p>
          <p>Crea la prima: inserisci le 3 versioni e condividi il link con il cliente.</p>
        </div>
      )}

      <div className="list">
        {rows?.map(q => (
          <Link key={q.id} to={`/quotation/${q.id}`} className="list-row">
            <span className="label subtle">{q.code || '—'}</span>
            <span>
              <span className="card-title">{q.title}</span>
              <span className="meta" style={{ display: 'block' }}>{q.client_name}</span>
            </span>
            <span className="meta">{fmtDate(q.quote_date)}</span>
            <span>
              <StatusPill status={q.status} label={q.status === 'accepted' && q.selected ? `Scelta: ${q.selected.name}` : undefined} />
            </span>
            <span className="meta">Aggiornata {fmtDate(q.updated_at)}</span>
          </Link>
        ))}
      </div>
    </>
  )
}
