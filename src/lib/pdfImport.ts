import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { parseCerbero, type ParsedQuote, type PdfPage } from './cerberoParser'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const OCR_SCALE = 0.75

// Legge un PDF di Cerbero. Le note scritte con il font illeggibile della pagina di riepilogo
// vengono lette con l'OCR sull'immagine della pagina.
export async function readQuotePdf(file: File, onStep?: (msg: string) => void): Promise<ParsedQuote> {
  onStep?.('Leggo il PDF…')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: PdfPage[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i)
    const tc = await p.getTextContent()
    pages.push({
      width: p.view[2],
      height: p.view[3],
      toks: tc.items.flatMap(t => ('str' in t ? [{ x: t.transform[4], y: t.transform[5], h: t.height, s: t.str }] : [])),
    })
  }
  const q = parseCerbero(pages)

  const unreadable = q.sections.filter(s => s.noteUnreadable)
  if (unreadable.length) {
    onStep?.('Leggo le note del riepilogo…')
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('ita')
    const rendered = new Map<number, HTMLCanvasElement>()
    try {
      for (const s of unreadable) {
        const box = s.noteUnreadable!
        let canvas = rendered.get(box.page)
        if (!canvas) {
          const page = await doc.getPage(box.page + 1)
          const viewport = page.getViewport({ scale: OCR_SCALE })
          canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
          rendered.set(box.page, canvas)
        }
        const pageH = pages[box.page].height
        const crop = document.createElement('canvas')
        const sx = box.x0 * OCR_SCALE
        const sy = (pageH - box.y - box.h * 1.2) * OCR_SCALE
        crop.width = (box.x1 - box.x0) * OCR_SCALE
        crop.height = box.h * 1.9 * OCR_SCALE
        const ctx = crop.getContext('2d')!
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, crop.width, crop.height)
        ctx.drawImage(canvas, sx, sy, crop.width, crop.height, 0, 0, crop.width, crop.height)
        const { data } = await worker.recognize(crop)
        const text = data.text.replace(/\s+/g, ' ').trim()
        s.note = text || 'Incluso'
        delete s.noteUnreadable
      }
    } finally {
      await worker.terminate()
    }
  }
  return q
}
