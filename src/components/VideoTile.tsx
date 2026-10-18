import { useEffect, useRef, useState } from 'react'
import { embedUrl, parseVideo, watchUrl } from '../lib/video'
import type { Work } from '../lib/types'

// Il video parte solo quando la card entra nello schermo, muto e in loop
export function VideoTile({ work }: { work: Work }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [visible, setVisible] = useState(false)
  const source = parseVideo(work.video_url)
  const embed = embedUrl(source)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (visible) v.play().catch(() => {})
    else v.pause()
  }, [visible])

  return (
    <div className="video-tile">
      <a ref={ref} className="video-frame" href={watchUrl(work.video_url)} target="_blank" rel="noreferrer" aria-label={`Guarda ${work.title}`}>
        {work.poster_url && <img src={work.poster_url} alt="" loading="lazy" />}
        {source.kind === 'file' ? (
          <video ref={videoRef} src={source.src} poster={work.poster_url ?? undefined} muted loop playsInline preload="metadata" />
        ) : (
          visible && embed && <iframe src={embed} title={work.title} allow="autoplay; fullscreen; picture-in-picture" loading="lazy" />
        )}
      </a>
      <div className="video-caption">
        {work.brand && <div className="brand">{work.brand}</div>}
        <div className="title">{work.title}</div>
        {work.description && <div className="meta">{work.description}</div>}
      </div>
    </div>
  )
}
