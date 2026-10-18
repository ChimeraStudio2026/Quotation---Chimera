import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IconDoc, IconLogout, IconPlay } from './Icons'

export function AppShell({ email }: { email: string }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo-black.png" alt="" />
          Preventivi
        </div>
        <NavLink to="/" end className="nav-link"><IconDoc /> Quotation</NavLink>
        <NavLink to="/lavori" className="nav-link"><IconPlay /> Lavori</NavLink>
        <div className="sidebar-foot">
          <div className="meta" style={{ marginBottom: 8, wordBreak: 'break-all' }}>{email}</div>
          <button className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }} onClick={() => supabase.auth.signOut()}>
            <IconLogout size={16} /> Esci
          </button>
        </div>
      </aside>
      <main className="panel">
        <Outlet />
      </main>
    </div>
  )
}
