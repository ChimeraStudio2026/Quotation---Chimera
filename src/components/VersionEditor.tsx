import { useState } from 'react'
import { findListino, listinoFor } from '../../supabase/functions/_shared/listino'
import { itemCost, itemTotal, money, sectionTotal, versionMargin, versionTotals } from '../lib/calc'
import type { Category, Item, Section, Version } from '../lib/types'
import { IconTrash } from './Icons'

type Props = {
  version: Version
  cats: Category[]
  onClose: () => void
  onSave: (v: Version) => void
}

const num = (v: string) => {
  const x = Number(v.replace(',', '.'))
  return Number.isFinite(x) ? x : 0
}

// Modifica a mano voci, note e fee di una versione, con il listino come suggerimento
export function VersionEditor({ version, cats, onClose, onSave }: Props) {
  const [v, setV] = useState<Version>(() => structuredClone(version))
  const t = versionTotals(v)
  const m = versionMargin(v)

  const sectionOf = (code: string): Section =>
    v.sections.find(s => s.category_code === code) ?? { category_code: code, note: null, extras: 0, items: [] }

  // Tiene le sezioni nell'ordine delle categorie e toglie quelle rimaste vuote
  const putSection = (next: Section) => {
    const sections = cats.flatMap(c => {
      const s = c.code === next.category_code ? next : v.sections.find(x => x.category_code === c.code)
      return s && (s.items.length || s.note?.trim() || Number(s.extras)) ? [s] : []
    })
    setV({ ...v, sections })
  }

  const putItem = (s: Section, idx: number, patch: Partial<Item>) =>
    putSection({ ...s, items: s.items.map((i, k) => (k === idx ? { ...i, ...patch } : i)) })

  // Scegliendo una voce del listino dal menu, il prezzo arriva dal listino
  const setJob = (s: Section, idx: number, job: string) => {
    const entry = findListino(job)
    putItem(s, idx, entry ? { job: entry.name, unit_price: entry.dailyPrice, unit_cost: entry.dailyCost } : { job })
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal modal-wide stack" onClick={e => e.stopPropagation()}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <h2 className="section-title">Voci di {v.name}</h2>
          <div className="spacer" />
          <span className="price-sm num">{money(t.total)} <span className="meta">+IVA</span></span>
        </div>
        <div className="version-fields">
          <label className="field"><span>Nome</span>
            <input className="input" value={v.name} onChange={e => setV({ ...v, name: e.target.value })} /></label>
          <label className="field"><span>Tagline</span>
            <input className="input" value={v.tagline ?? ''} onChange={e => setV({ ...v, tagline: e.target.value })} /></label>
          <label className="field"><span>Production fee %</span>
            <input className="input" type="number" value={v.production_fee_pct} onChange={e => setV({ ...v, production_fee_pct: num(e.target.value) })} /></label>
          <label className="field"><span>Sconto €</span>
            <input className="input" type="number" value={v.discount} onChange={e => setV({ ...v, discount: num(e.target.value) })} /></label>
          <label className="field"><span>IVA %</span>
            <input className="input" type="number" value={v.vat_pct} onChange={e => setV({ ...v, vat_pct: num(e.target.value) })} /></label>
        </div>

        {cats.map(c => {
          const s = sectionOf(c.code)
          const listId = `listino-${c.code}`
          return (
            <section key={c.code} className="ve-section">
              <div className="row">
                <strong>{c.letter}. {c.name}</strong>
                <div className="spacer" />
                {s.items.length > 0 && <span className="num">{money(sectionTotal(s))}</span>}
                <button type="button" className="btn btn-soft btn-sm"
                  onClick={() => putSection({ ...s, items: [...s.items, { position: s.items.length, code: null, job: '', note: null, qty: 1, days: 1, unit_price: 0, nic_pct: 0, unit_cost: null }] })}>
                  + Voce
                </button>
              </div>
              <input className="input ve-note" value={s.note ?? ''} placeholder="Nota per il cliente, es. 1x director; 1x director of photography"
                onChange={e => putSection({ ...s, note: e.target.value || null })} />
              <datalist id={listId}>
                {listinoFor(c.code).map(e => <option key={e.name} value={e.name}>{money(e.dailyPrice)}</option>)}
              </datalist>
              {s.items.length > 0 && (
                <div className="ve-table-wrap">
                  <table className="ve-table">
                    <thead>
                      <tr><th>Job</th><th>Note</th><th>Qty</th><th>Days</th><th>Unit price</th><th>NIC %</th><th>Price</th><th className="ve-internal" title="Solo per il team: il cliente non lo vede">Costo unit.</th><th className="ve-internal">Costo</th><th /></tr>
                    </thead>
                    <tbody>
                      {s.items.map((i, idx) => (
                        <tr key={idx}>
                          <td><input className="input" list={listId} value={i.job} placeholder="Cerca nel listino o scrivi"
                            onChange={e => setJob(s, idx, e.target.value)} /></td>
                          <td><input className="input" value={i.note ?? ''} onChange={e => putItem(s, idx, { note: e.target.value || null })} /></td>
                          <td><input className="input num" type="number" value={i.qty} onChange={e => putItem(s, idx, { qty: num(e.target.value) })} /></td>
                          <td><input className="input num" type="number" value={i.days} onChange={e => putItem(s, idx, { days: num(e.target.value) })} /></td>
                          <td><input className="input num" type="number" value={i.unit_price} onChange={e => putItem(s, idx, { unit_price: num(e.target.value) })} /></td>
                          <td><input className="input num" type="number" value={i.nic_pct} onChange={e => putItem(s, idx, { nic_pct: num(e.target.value) })} /></td>
                          <td className="num">{money(itemTotal(i))}</td>
                          <td className="ve-internal"><input className="input num" type="number" value={i.unit_cost ?? ''} placeholder="—"
                            onChange={e => putItem(s, idx, { unit_cost: e.target.value === '' ? null : num(e.target.value) })} /></td>
                          <td className="num ve-internal">{itemCost(i) === null ? '—' : money(itemCost(i)!)}</td>
                          <td>
                            <button type="button" className="btn btn-ghost btn-sm" aria-label="Togli voce"
                              onClick={() => putSection({ ...s, items: s.items.filter((_, k) => k !== idx) })}><IconTrash size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )
        })}

        <div className="row ve-footer">
          <span className="meta num">
            Subtotale {money(t.subtotal)} · fee {money(t.fee)}{t.total !== t.subtotal + t.fee ? ` · sconto ${money(Number(v.discount))}` : ''} · totale {money(t.total)} +IVA
            <br />
            <span className="ve-margin">
              Costo interno {money(m.cost)} · margine <strong>{money(m.margin)} ({Math.round(m.marginPct * 100)}%)</strong>
              {m.missingCost > 0 && ` · ${m.missingCost} ${m.missingCost === 1 ? 'voce' : 'voci'} senza costo`}
            </span>
          </span>
          <div className="spacer" />
          <button className="btn btn-ghost" onClick={onClose}>Annulla</button>
          <button className="btn btn-nova" onClick={() => onSave(v)}>Salva voci</button>
        </div>
      </div>
    </div>
  )
}
