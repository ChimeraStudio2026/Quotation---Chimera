export type VideoSource =
  | { kind: 'file'; src: string }
  | { kind: 'youtube'; id: string }
  | { kind: 'vimeo'; id: string }

export function parseVideo(url: string): VideoSource {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return { kind: 'youtube', id: yt[1] }
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vm) return { kind: 'vimeo', id: vm[1] }
  return { kind: 'file', src: url }
}

export function embedUrl(v: VideoSource): string | null {
  if (v.kind === 'youtube')
    return `https://www.youtube.com/embed/${v.id}?autoplay=1&mute=1&loop=1&playlist=${v.id}&controls=0&playsinline=1&modestbranding=1&rel=0`
  if (v.kind === 'vimeo') return `https://player.vimeo.com/video/${v.id}?background=1&autoplay=1&loop=1&muted=1`
  return null
}

export function watchUrl(url: string): string {
  const v = parseVideo(url)
  if (v.kind === 'youtube') return `https://www.youtube.com/watch?v=${v.id}`
  if (v.kind === 'vimeo') return `https://vimeo.com/${v.id}`
  return url
}
