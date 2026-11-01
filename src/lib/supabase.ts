import { createClient, type User } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

export const TEAM_DOMAIN = '@chimerastudioss.com'

// Del team = email Chimera ed entrato con Google. Le RLS fanno lo stesso controllo (is_team).
export const isTeamUser = (user: User) =>
  !!user.email?.toLowerCase().endsWith(TEAM_DOMAIN) && (user.app_metadata.providers ?? [user.app_metadata.provider]).includes('google')

// Indirizzi relativi alla cartella in cui è pubblicata l'app (es. /preventivi-chimera/ su GitHub Pages)
export const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`
export const appUrl = (path = '') => `${window.location.origin}${import.meta.env.BASE_URL}${path}`
