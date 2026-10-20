// Formato della risposta di Claude (structured output). Tutti i campi sono obbligatori:
// quelli che possono mancare sono nullable, come richiede lo schema stretto.
const CATEGORY_CODES = [
  'PRE_PRODUCTION', 'CAST', 'DIRECTOR', 'CREW', 'LOCATION', 'ART', 'EQUIPMENT',
  'LOGISTIC', 'FOOD', 'POST_PRODUCTION', 'USAGE_RIGHTS', 'INSURANCE', 'OTHERS',
]

const object = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})

const category = { type: 'string', enum: CATEGORY_CODES }

const item = object({
  category,
  catalogName: { type: 'string', description: 'Nome esatto della voce di listino, oppure stringa vuota per una voce libera.' },
  job: { type: 'string' },
  note: { type: 'string' },
  qty: { type: 'number' },
  days: { type: 'number' },
  customUnitPrice: {
    anyOf: [{ type: 'number' }, { type: 'null' }],
    description: 'Solo per voci libere o se l\'account impone un prezzo; null per usare il listino.',
  },
})

const version = object({
  position: { type: 'integer', enum: [1, 2, 3] },
  name: { type: 'string' },
  tagline: { type: 'string' },
  productionFeePct: { type: 'number' },
  targetTotal: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Totale (+IVA esclusa) richiesto per questa versione, o null.' },
  sectionNotes: { type: 'array', items: object({ category, note: { type: 'string' } }) },
  items: { type: 'array', items: item },
})

export const RESPONSE_SCHEMA = object({
  reply: { type: 'string' },
  openQuestions: { type: 'array', items: { type: 'string' } },
  quote: object({
    title: { type: 'string' },
    clientName: { type: 'string' },
    clientVat: { type: 'string' },
    clientAddress: { type: 'string' },
    versions: { type: 'array', items: version },
  }),
})
