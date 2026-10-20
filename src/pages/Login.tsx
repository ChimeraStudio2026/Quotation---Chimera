import { useState } from 'react'
import { asset, supabase, TEAM_EMAIL } from '../lib/supabase'

// Un solo codice per tutto il team: è la password dell'account condiviso del team.
// La sessione resta salvata sul dispositivo, quindi il codice si inserisce una volta sola.
export function Login({ wrongAccount }: { wrongAccount: boolean }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: TEAM_EMAIL, password: code.trim() })
    setBusy(false)
    if (error) setMsg('Codice non corretto. Chiedilo a un collega del team.')
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card stack" onSubmit={submit}>
        <img src={asset('logo-black.png')} alt="Chimera" width={44} height={44} />
        <div>
          <h1 className="page-title" style={{ fontSize: 28, lineHeight: '34px' }}>Preventivi Chimera</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>Inserisci il codice del team. Su questo dispositivo non te lo chiederemo più.</p>
        </div>
        {wrongAccount && (
          <button type="button" className="btn btn-outline" onClick={() => supabase.auth.signOut()}>Esci dall'account attuale</button>
        )}
        <label className="field"><span>Codice del team</span>
          <input className="input" type="password" autoComplete="current-password" value={code} onChange={e => setCode(e.target.value)}
            placeholder="Codice del team" required autoFocus />
        </label>
        {msg && <div className="pill pill-warning" style={{ whiteSpace: 'normal', padding: '8px 12px' }}>{msg}</div>}
        <button className="btn btn-lg" disabled={busy}>{busy ? 'Controllo…' : 'Entra'}</button>
      </form>
    </div>
  )
}
