import { useState } from 'react'
import { appUrl, asset, supabase, TEAM_DOMAIN } from '../lib/supabase'

export function Login({ wrongDomain }: { wrongDomain: boolean }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(wrongDomain ? `Accesso riservato agli account ${TEAM_DOMAIN}.` : null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!email.toLowerCase().endsWith(TEAM_DOMAIN)) {
      setMsg(`Usa la tua email ${TEAM_DOMAIN}.`)
      return
    }
    setBusy(true)
    const { error } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } })
    setBusy(false)
    if (error) setMsg(error.message)
    else if (mode === 'signup') setMsg('Ti abbiamo mandato una email: conferma l\'indirizzo e poi accedi.')
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card stack" onSubmit={submit}>
        <img src={asset('logo-black.png')} alt="Chimera" width={44} height={44} />
        <div>
          <h1 className="page-title" style={{ fontSize: 28, lineHeight: '34px' }}>Preventivi Chimera</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>Area riservata al team account.</p>
        </div>
        {wrongDomain && (
          <button type="button" className="btn btn-outline" onClick={() => supabase.auth.signOut()}>Esci dall'account attuale</button>
        )}
        <label className="field"><span>Email</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={`nome${TEAM_DOMAIN}`} required />
        </label>
        <label className="field"><span>Password</span>
          <input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        {msg && <div className="pill pill-warning" style={{ whiteSpace: 'normal', padding: '8px 12px' }}>{msg}</div>}
        <button className="btn btn-lg" disabled={busy}>{mode === 'login' ? 'Accedi' : 'Crea account'}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Primo accesso? Crea il tuo account' : 'Hai già un account? Accedi'}
        </button>
      </form>
    </div>
  )
}
