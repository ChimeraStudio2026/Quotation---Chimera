// Listino figure e voci, trascritto dal Jobs Database di Cerbero.
// Lo usano sia l'app (editor delle voci) sia la funzione quote-assistant (prompt di Claude):
// niente import specifici di Deno o di Vite qui dentro.
// Formato: [nome, categorie, orario, NIC %, prezzo giornaliero, costo giornaliero,
//           prezzo straordinario, costo straordinario, prezzo notturno, costo notturno]

type ListinoRow = readonly [
  name: string,
  categories: readonly string[],
  timeValue: string,
  defaultNic: number,
  dailyPrice: number,
  dailyCost: number,
  overtimePrice: number,
  overtimeCost: number,
  nightlyPrice: number,
  nightlyCost: number,
]

export type ListinoEntry = {
  name: string
  categories: readonly string[]
  timeValue: string
  defaultNic: number
  dailyPrice: number
  /** Costo interno Chimera: serve solo al team per il margine, mai al cliente */
  dailyCost: number
  overtimePrice: number
  nightlyPrice: number
  nightlyCost: number
}

const PREP = 'PRE_PRODUCTION'
const CAST = 'CAST'
const DIR = 'DIRECTOR'
const CREW = 'CREW'
const ART = 'ART'
const EQ = 'EQUIPMENT'
const LOG = 'LOGISTIC'
const POST = 'POST_PRODUCTION'

const ROWS: readonly ListinoRow[] = [
  // Pre-Production
  ['Ass. Producer ( 10+1 h )', [PREP, CREW], '10+1', 0, 350, 250, 0, 0, 350, 250],
  ['Ass. Set decorator ( 11+1 h )', [PREP, ART], '11+1', 0, 430, 300, 37, 37, 500, 300],
  ['Ass. Stylist ( 8+1 h )', [PREP, ART], '8+1', 0, 330, 200, 50, 50, 400, 200],
  ['Casting Director', [PREP], '8+1', 0, 860, 600, 0, 0, 1000, 600],
  ['Cinematographer', [PREP, DIR], '', 0, 1250, 800, 0, 0, 1500, 800],
  ['Director', [PREP, DIR], '', 0, 1450, 1000, 0, 0, 1500, 1000],
  ['Director of Photography', [PREP, CREW, DIR], '', 0, 1300, 900, 0, 0, 1250, 900],
  ['Location Manager ( 11+1 h )', [PREP, CREW], '11+1', 0, 800, 490, 0, 0, 490, 490],
  ['Producer ( 10+1 h )', [PREP, CREW], '10+1', 0, 500, 350, 0, 0, 500, 350],
  ['Props Manager / Buyer ( 11+1 h )', [PREP, ART], '11+1', 0, 500, 350, 0, 0, 500, 350],
  ['Scenografo ( 11+1 h )', [PREP, ART], '11+1', 0, 1300, 800, 100, 100, 800, 800],
  ['Set decorator ( 11+1 h )', [PREP, ART], '11+1', 0, 640, 450, 55, 55, 460, 460],
  ['Storyboard / Treatment ( 10+1 h )', [PREP], '10+1', 0, 500, 250, 0, 0, 500, 250],

  // Casting
  ['Actor Street Casting (4h + 1)', [CAST], '4h', 0, 250, 100, 0, 0, 0, 0],
  ['Actor Street Casting (8h + 1)', [CAST], '8+1', 0, 350, 150, 0, 0, 0, 0],
  ['Not Professional Actor Man / Woman', [CAST], '8+1', 0, 700, 400, 50, 50, 700, 500],
  ['Professional Actor Man / Woman', [CAST], '8+1', 0, 1500, 1000, 75, 75, 1500, 1200],

  // Direction
  ['1st AD (8+1 h)', [DIR], '8+1', 0, 750, 400, 60, 60, 750, 400],
  ['Art Director ( 10+1 h )', [CREW, DIR], '10+1', 0, 670, 400, 0, 0, 800, 400],

  // Crew
  ['1st AC ( 8+1 h )', [CREW], '8+1', 0, 670, 400, 65, 65, 800, 450],
  ['2nd AC ( 8+1 h )', [CREW], '8+1', 0, 500, 350, 50, 50, 550, 350],
  ['Cam. OP ( 4+1 h )', [CREW], '4+1', 0, 500, 350, 50, 0, 610, 350],
  ['Cam. OP ( 8+1 h )', [CREW], '8+1', 0, 700, 450, 50, 0, 850, 450],
  ['Content Creator w/ Cam | incl. live editing ( 4+1 h )', [CREW], '4+1', 0, 600, 300, 0, 0, 700, 300],
  ['Content Creator w/ Cam | incl. live editing ( 8+1 h )', [CREW], '8+1', 0, 900, 500, 150, 150, 1100, 450],
  ['Content Creator w/ iPhone | incl. live editing ( 4+1 h )', [CREW], '4+1', 0, 500, 300, 0, 0, 700, 350],
  ['Content Creator w/ iPhone | incl. live editing ( 8+1 h )', [CREW], '8+1', 0, 800, 450, 100, 100, 1100, 450],
  ['Data Manager ( 8+1 h )', [CREW], '8+1', 0, 300, 300, 50, 50, 500, 300],
  ['Electrician ( 8+1 h )', [CREW], '8+1', 0, 500, 350, 50, 50, 500, 350],
  ['Event Photographer (4+1)', [CREW], '4h', 0, 500, 300, 0, 0, 0, 0],
  ['Event Photographer (8+1)', [CREW], '1gg', 0, 680, 450, 0, 0, 0, 0],
  ['Focus Puller ( 8+1 h )', [CREW], '8+1', 0, 610, 370, 65, 65, 370, 370],
  ['Fonico ( 8+1 h )', [CREW], '8+1', 0, 500, 350, 90, 90, 600, 350],
  ['Gaffer ( 8+1 h )', [CREW], '8+1', 0, 670, 400, 65, 65, 600, 370],
  ['Grip ( 8+1 h )', [CREW], '8+1', 0, 490, 300, 50, 50, 300, 300],
  ['Key Grip ( 8+1 h )', [CREW], '8+1', 0, 610, 370, 65, 65, 370, 370],
  ['Macchinista ( 8+1 h )', [CREW], '8+1', 0, 490, 300, 50, 50, 300, 300],
  ['Photographer (8+1h)', [CREW], '8+1', 0, 830, 500, 0, 0, 1000, 500],
  ['Senior Drone Op. (Inspire - excl. permits)', [CREW], '8+1', 0, 1500, 1300, 0, 0, 1500, 1300],
  ['Senior Drone Op. (Mavic Pro - excl. permits)', [CREW], '8+1', 0, 800, 500, 0, 0, 800, 500],
  ['Senior FPV & Classic Drone Op. ( GoPro & Mavic Pro - excl. permits )', [CREW], '8+1', 0, 1000, 800, 0, 0, 1200, 800],
  ['Senior FPV Drone Op. ( Cinelifter - excl. permits )', [CREW], '8+1', 0, 1500, 1400, 0, 0, 1500, 1400],
  ['Senior FPV Drone Op. ( GoPro - excl. permits )', [CREW], '8+1', 0, 800, 600, 0, 0, 1000, 600],
  ['Steadycam OP ( 8+1 h )', [CREW], '8+1', 0, 1300, 900, 150, 150, 1200, 900],
  ['Video Assist VTR ( 8+1 h )', [CREW], '8+1', 0, 490, 300, 50, 50, 300, 300],
  ['Videomaker Evento - incl. editing (up to 2 rework)', [CREW], '4+1', 0, 1000, 650, 0, 0, 1300, 750],

  // Art Department
  ['Ass. Hair Stylist ( 8+1 h )', [ART], '8+1', 0, 290, 200, 0, 0, 300, 200],
  ['Ass. Make Up Artist ( 8+1 h )', [ART], '8+1', 0, 289, 200, 0, 0, 300, 200],
  ['Hair Stylist ( 8+1 h )', [ART], '8+1', 0, 570, 400, 70, 70, 650, 400],
  ['Make Up Artist ( 8+1 h )', [ART], '8+1', 0, 570, 400, 70, 70, 650, 400],
  ['Stylist ( 11+1 h )', [ART], '11+1', 0, 580, 400, 100, 100, 700, 400],

  // Equipment
  ['EQ - Truck transportation A/R', [EQ], '', 0, 400, 200, 0, 0, 200, 100],

  // Logistics
  ['Diaria (incl. Breakfast, Snack, Lunch & Dinner)', [LOG], '', 0, 100, 70, 0, 0, 100, 70],
  ['Diaria (incl. Breakfast, Snack, Lunch)', [LOG], '', 35, 60, 40, 0, 0, 0, 0],
  ['Diaria (incl. Lunch)', [LOG], '', 0, 35, 25, 0, 0, 35, 25],
  ['Diaria (incl. Snack & Lunch)', [LOG], '', 0, 50, 35, 0, 0, 50, 35],
  ['Drone Permit', [LOG], '', 0, 0, 0, 0, 0, 150, 50],
  ['Public Land Occupation', [LOG], '', 35, 0, 0, 0, 0, 0, 0],
  ['Rental Car/Van', [LOG], '', 0, 1, 0, 0, 0, 250, 150],
  ['Travel A/R - Benzina, caselli e utilizzo auto', [LOG], '', 0, 1, 0, 0, 0, 1, 0],

  // Post-Production
  ['2D VFX ( 8+1 h )', [POST], '8+1', 0, 710, 450, 60, 60, 850, 450],
  ['AI Artist', [POST], '8+1', 0, 800, 0, 0, 0, 0, 0],
  ['Color Grading ( 8+1 h )', [POST], '8+1', 0, 800, 400, 70, 70, 800, 400],
  ['Extra Edit - Content Creator', [POST], '1gg', 0, 600, 300, 0, 0, 0, 0],
  ['Junior Video Editor ( 8h )', [POST], '8+1', 0, 500, 300, 50, 50, 600, 300],
  ['Motion Designer (8h + 1h)', [POST], '8+1', 0, 580, 350, 30, 30, 700, 350],
  ['Music from Library (Artlist)', [POST], '', 0, 150, 0, 0, 0, 150, 0],
  ['Senior Video Editor ( 8h )', [POST], '8+1', 0, 650, 450, 60, 60, 800, 450],
  ['Sound Design, Mix & Mastering', [POST], '8+1', 0, 750, 500, 0, 0, 900, 500],
  ['Sound FX', [POST], '8+1', 0, 570, 400, 0, 0, 600, 400],
]

export const LISTINO: readonly ListinoEntry[] = ROWS.map(
  ([name, categories, timeValue, defaultNic, dailyPrice, dailyCost, overtimePrice, , nightlyPrice, nightlyCost]) => ({
    name,
    categories,
    timeValue,
    defaultNic,
    dailyPrice,
    dailyCost,
    overtimePrice,
    nightlyPrice,
    nightlyCost,
  }),
)

const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim()
const BY_NAME = new Map(LISTINO.map(e => [normalize(e.name), e]))

export const findListino = (name: string | null | undefined) => (name ? BY_NAME.get(normalize(name)) ?? null : null)

export const listinoFor = (category: string) => LISTINO.filter(e => e.categories.includes(category))

// Una riga per voce, per il prompt di Claude
export const listinoForPrompt = () =>
  ['nome | categorie | orario | NIC % | prezzo giornaliero € | prezzo notturno €',
    ...LISTINO.map(e => [e.name, e.categories.join(','), e.timeValue || '-', e.defaultNic, e.dailyPrice, e.nightlyPrice].join(' | '))].join('\n')
