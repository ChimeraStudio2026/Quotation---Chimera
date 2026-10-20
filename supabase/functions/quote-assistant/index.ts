// Assistente preventivi: riceve la richiesta dell'account e la quotation attuale,
// chiede a Claude la quotation aggiornata e la restituisce all'app.
// Solo il team (@chimerastudioss.com) può usarla. La chiave di Anthropic sta nei secret di Supabase.
import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0'
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { SYSTEM_PROMPT } from './prompt.ts'
import { RESPONSE_SCHEMA } from './schema.ts'

const MODEL = 'claude-opus-5-5'
const TEAM_DOMAIN = '@chimerastudioss.com'
const HISTORY_LIMIT = 20

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type ChatTurn = { role: 'user' | 'assistant'; content: string }

let anthropic: Anthropic | null = null

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email?.toLowerCase().endsWith(TEAM_DOMAIN)) return json({ error: 'Solo per il team Chimera.' }, 401)

  // Spazi, a capo e virgolette arrivano spesso dal copia-incolla della chiave: si tolgono qui
  const apiKey = (Deno.env.get('ANTHROPIC_API_KEY') ?? '').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim()
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY non configurata nei secret delle Edge Functions di Supabase.' }, 500)
  if (!/^[\x21-\x7e]+$/.test(apiKey)) {
    return json({ error: 'La chiave ANTHROPIC_API_KEY su Supabase contiene caratteri non validi: incollala di nuovo, solo la chiave (inizia con sk-ant-).' }, 500)
  }

  const body = await req.json().catch(() => null) as { message?: unknown; draft?: unknown; history?: unknown } | null
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 20000) : ''
  if (!message || !body?.draft || typeof body.draft !== 'object') return json({ error: 'Richiesta non valida.' }, 400)
  const history: ChatTurn[] = Array.isArray(body.history)
    ? body.history
      .filter((t): t is ChatTurn => (t?.role === 'user' || t?.role === 'assistant') && typeof t?.content === 'string')
      .slice(-HISTORY_LIMIT)
    : []

  anthropic ??= new Anthropic({ apiKey })
  try {
    // La quotation viaggia con l'ultimo messaggio: lo storico resta solo testo,
    // così le modifiche fatte a mano nell'app arrivano sempre a Claude.
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
      messages: [
        ...history.map(t => ({ role: t.role, content: t.content })),
        {
          role: 'user',
          content: `Quotation attuale (JSON):\n${JSON.stringify(body.draft)}\n\nRichiesta dell'account:\n${message}`,
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return json({ error: 'Claude non ha potuto elaborare questa richiesta. Prova a riformularla.' }, 422)
    }
    const text = response.content.find(b => b.type === 'text')
    if (response.stop_reason === 'max_tokens' || !text || text.type !== 'text') {
      return json({ error: 'La risposta di Claude è incompleta. Riprova o dividi la richiesta in passi più piccoli.' }, 502)
    }
    return json({ result: JSON.parse(text.text) })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'Chiave API di Anthropic non valida.' }, 500)
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Troppe richieste a Claude: riprova tra poco.' }, 429)
    if (e instanceof Anthropic.APIError) return json({ error: `Errore Claude (${e.status}): ${e.message}` }, 502)
    console.error('quote-assistant', e)
    return json({ error: 'Errore inatteso dell\'assistente. Riprova.' }, 500)
  }
})
