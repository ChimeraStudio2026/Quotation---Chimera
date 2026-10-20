import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, TEAM_DOMAIN } from './lib/supabase'
import { AppShell } from './components/AppShell'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { QuoteEditor } from './pages/QuoteEditor'
import { NewQuote } from './pages/NewQuote'
import { Works } from './pages/Works'
import { Assistant } from './pages/Assistant'
import { ClientQuotePage, PreviewQuotePage } from './pages/ClientQuote'

export function App() {
  return (
    <Routes>
      {/* Pagina pubblica per il cliente: nessun login */}
      <Route path="/p/:token" element={<ClientQuotePage />} />
      <Route path="/*" element={<TeamArea />} />
    </Routes>
  )
}

function TeamArea() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  const email = session?.user.email ?? ''
  if (!session || !email.toLowerCase().endsWith(TEAM_DOMAIN)) return <Login wrongAccount={!!session} />

  return (
    <Routes>
      <Route path="anteprima/:id" element={<PreviewQuotePage />} />
      <Route element={<AppShell email={email} />}>
        <Route index element={<Dashboard />} />
        <Route path="nuova" element={<NewQuote />} />
        <Route path="quotation/:id" element={<QuoteEditor />} />
        <Route path="lavori" element={<Works />} />
        <Route path="assistente" element={<Assistant />} />
      </Route>
    </Routes>
  )
}
