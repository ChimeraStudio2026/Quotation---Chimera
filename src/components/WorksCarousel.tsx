import { useEffect, useRef, useState } from 'react'
import type { Work } from '../lib/types'

const AUTOPLAY_MS = 4500

// Distanza più breve tra la card i e quella attiva, in un giro circolare
function offset(i: number, active: number, n: number) {
  let d = i - active
  if (d > n / 2) d -= n
  if (d < -n / 2) d += n
  return d
}

const Arrow = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M20.4 10.93v2.16l-8.47 7.8-2.26-2.26 5.71-5.04H3.6v-3.19h11.78L9.67 5.36l2.26-2.25z" />
  </svg>
)

function Card({ work, d, onPick }: { work: Work; d: number; onPick: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isActive = d === 0
  const near = Math.abs(d) <= 1

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (isActive) v.play().catch(() => {})
    else v.pause()
  }, [isActive])

  return (
    <div className="depth-item" data-d={Math.max(-2, Math.min(2, d))} aria-hidden={!near}
      onClick={isActive ? undefined : onPick}>
      <div className="case-card">
        {work.poster_url && <img src={work.poster_url} alt="" loading="lazy" />}
        {near && <video ref={videoRef} src={work.video_url} muted loop playsInline preload={isActive ? 'auto' : 'metadata'} />}
        <div className="case-shade" />
        <div className="case-text">
          <div className="case-top">
            {work.logo_url ? <span className="case-logo"><img src={work.logo_url} alt={work.brand ?? ''} /></span> : <span />}
            {work.link_url && (
              <a className="case-go" href={work.link_url} target="_blank" rel="noreferrer" tabIndex={isActive ? 0 : -1}
                aria-label={`Apri il caso studio ${work.title}`} onClick={e => e.stopPropagation()}>
                <Arrow />
              </a>
            )}
          </div>
          <div className="case-title">{work.title}</div>
          {work.service && <div className="case-service">{work.service}</div>}
        </div>
      </div>
    </div>
  )
}

// Il carosello "in profondità" del sito chimerastudioss.com: card centrale grande, le vicine ruotate ai lati
export function WorksCarousel({ works }: { works: Work[] }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const startX = useRef<number | null>(null)
  const n = works.length

  useEffect(() => setActive(0), [works])

  useEffect(() => {
    if (paused || n < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => setActive(a => (a + 1) % n), AUTOPLAY_MS)
    return () => window.clearInterval(t)
  }, [paused, n])

  if (!n) return null
  const go = (step: number) => setActive(a => (a + step + n) % n)

  return (
    <section className="works-sec">
      <div className="works-head">
        <h2 className="works-h">Ok, basta parole.<br />Guarda i lavori.</h2>
        <a className="works-cta" href="https://chimerastudioss.com/casi-studio" target="_blank" rel="noreferrer">
          Esplora i progetti <Arrow />
        </a>
      </div>

      <div className="depth" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        onPointerDown={e => { startX.current = e.clientX }}
        onPointerUp={e => {
          if (startX.current === null) return
          const dx = e.clientX - startX.current
          startX.current = null
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
        }}>
        <svg className="burst burst-red" viewBox="0 0 200 200" aria-hidden>
          <path fill="currentColor" d={burstPath(24, 100, 70)} />
        </svg>
        <svg className="burst burst-purple" viewBox="0 0 200 200" aria-hidden>
          <path fill="currentColor" d="M96 8 112 74 190 52 128 104 178 168 104 132 84 196 76 128 10 150 60 98 14 40 84 72z" />
        </svg>
        <div className="depth-stage">
          {works.map((w, i) => {
            const d = offset(i, active, n)
            return Math.abs(d) <= 2 ? <Card key={w.id} work={w} d={d} onPick={() => setActive(i)} /> : null
          })}
        </div>
      </div>

      {n > 1 && (
        <div className="depth-nav">
          <button className="depth-btn" onClick={() => go(-1)} aria-label="Lavoro precedente"><span style={{ transform: 'scaleX(-1)', display: 'flex' }}><Arrow /></span></button>
          <span className="depth-count num">{active + 1} / {n}</span>
          <button className="depth-btn" onClick={() => go(1)} aria-label="Lavoro successivo"><Arrow /></button>
        </div>
      )}
    </section>
  )
}

// Stella a punte regolari, come la forma rossa del sito
function burstPath(points: number, outer: number, inner: number) {
  const pts: string[] = []
  for (let k = 0; k < points * 2; k++) {
    const r = k % 2 ? inner : outer
    const a = (Math.PI * k) / points - Math.PI / 2
    pts.push(`${(100 + Math.cos(a) * r).toFixed(1)} ${(100 + Math.sin(a) * r).toFixed(1)}`)
  }
  return `M${pts.join(' L')}Z`
}
