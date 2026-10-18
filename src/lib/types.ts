export type Category = { code: string; letter: string; name: string; position: number }

export type Item = {
  id?: string
  position: number
  code: string | null
  job: string
  note: string | null
  qty: number
  days: number
  unit_price: number
  nic_pct: number
}

export type Section = {
  id?: string
  category_code: string
  note: string | null
  extras: number
  items: Item[]
}

export type Version = {
  id?: string
  position: number
  name: string
  tagline: string | null
  production_fee_pct: number
  discount: number
  vat_pct: number
  sections: Section[]
}

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted'

export type Quote = {
  id: string
  code: string | null
  title: string
  client_name: string
  client_vat: string | null
  client_address: string | null
  intro: string | null
  quote_date: string
  validity_days: number
  share_token: string
  status: QuoteStatus
  selected_version_id: string | null
  selected_at: string | null
  client_note: string | null
  first_viewed_at: string | null
  updated_at: string
}

export type Work = {
  id: string
  title: string
  brand: string | null
  description: string | null
  video_url: string
  poster_url: string | null
  categories: string[]
  featured: boolean
  position: number
}

export type PublicQuote = {
  quote: Pick<Quote, 'id' | 'code' | 'title' | 'client_name' | 'client_vat' | 'client_address' | 'intro' | 'quote_date' | 'validity_days' | 'status' | 'selected_version_id' | 'selected_at'>
  categories: Category[]
  versions: (Version & { id: string })[]
  works: Work[]
}
