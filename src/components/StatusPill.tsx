import type { QuoteStatus } from '../lib/types'

const MAP: Record<QuoteStatus, [string, string]> = {
  draft: ['Bozza', 'pill-pending'],
  sent: ['Inviata', 'pill-warning'],
  viewed: ['Aperta dal cliente', 'pill-nova'],
  accepted: ['Versione scelta', 'pill-success'],
}

export function StatusPill({ status, label }: { status: QuoteStatus; label?: string }) {
  const [text, cls] = MAP[status]
  return <span className={`pill ${cls}`}><span className="dot" />{label ?? text}</span>
}
