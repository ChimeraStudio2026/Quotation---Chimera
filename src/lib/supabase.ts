import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

export const TEAM_DOMAIN = '@chimerastudioss.com'

// Indirizzi relativi alla cartella in cui è pubblicata l'app (es. /preventivi-chimera/ su GitHub Pages)
export const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`
export const appUrl = (path = '') => `${window.location.origin}${import.meta.env.BASE_URL}${path}`
