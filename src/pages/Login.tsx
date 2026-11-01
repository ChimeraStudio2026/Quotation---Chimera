import { useState } from 'react'
import { appUrl, asset, supabase, TEAM_DOMAIN } from '../lib/supabase'
import { IconGoogle } from '../components/Icons'

// Si entra solo con l'account Google di Chimera Studios (Workspace @chimerastudioss.com).
// La sessione resta salvata sul dispositivo, quindi si entra una volta sola.
export function Login({ wrongEmail }: { wrongEmail: string | null }) {
  // Se Google o Supabase rifiutano l'accesso, tornano qui con l'errore nell'indirizzo
  const [msg, setMsg] = useState<string | null>(() => {
    const err = new URLSearchParams(window.location.search).get('error_description')
    return err ? `Accesso con Google non riuscito: ${err}` : null
  })
  const [busy, setBusy] = useState(false)

  async function google() {
    setMsg(null)
    setBusy(true)
    // Se si è già dentro con un altro account, prima si esce
    if (wrongEmail) await supabase.auth.signOut()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: appUrl(),
        // hd: Google propone solo gli account Chimera; il controllo vero è nella app Google "Internal" e nelle RLS
        queryParams: { hd: TEAM_DOMAIN.slice(1), prompt: 'select_account' },
      },
    })
    if (error) {
      setBusy(false)
      setMsg('Accesso con Google non riuscito. Riprova tra poco.')
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card stack">
        <img src={asset('logo-black.png')} alt="Chimera" width={44} height={44} />
        <div>
          <h1 className="page-title" style={{ fontSize: 28, lineHeight: '34px' }}>Preventivi Chimera</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>Entra con il tuo account Google {TEAM_DOMAIN}. Su questo dispositivo non te lo chiederemo più.</p>
        </div>
        {wrongEmail && (
          <div className="pill pill-warning" style={{ whiteSpace: 'normal', padding: '8px 12px' }}>
            Sei entrato come {wrongEmail}: qui si entra solo con l'account Google di Chimera Studios.
          </div>
        )}
        <button type="button" className="btn btn-lg btn-outline" onClick={google} disabled={busy}>
          <IconGoogle /> Entra con Google
        </button>
        {msg && <div className="pill pill-warning" style={{ whiteSpace: 'normal', padding: '8px 12px' }}>{msg}</div>}
      </div>
    </div>
  )
}
