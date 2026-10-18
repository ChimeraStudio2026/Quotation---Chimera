# Preventivi Chimera

App per condividere le quotation con i clienti in modo più bello di un PDF.

- Il team account crea una quotation con **3 versioni** (la centrale è quella consigliata).
- Il cliente riceve un **link privato**: vede le 3 versioni affiancate, apre ognuna e scopre cosa c'è dentro, voce per voce.
- Sotto la versione aperta **girano i video dei nostri lavori** collegati ai servizi inclusi (Crew, Post-production, …).
- Il cliente **sceglie la versione** dal link e l'account la vede subito nella dashboard.

Stile: design system **Caronte NOVA** (DM Sans, token colore e raggi in `src/styles.css`).

## Come funziona

| Pagina | Chi la usa | Cosa fa |
| --- | --- | --- |
| `/` | team | Elenco delle quotation con stato (Bozza, Inviata, Aperta dal cliente, Versione scelta) |
| `/quotation/:id` | team | Editor: dati cliente, 3 versioni con le categorie A–O del preventivo, voci, fee, sconto, IVA, lavori da mostrare |
| `/lavori` | team | Libreria dei video (YouTube, Vimeo o mp4 caricato) collegati alle categorie di servizio |
| `/anteprima/:id` | team | Come la vede il cliente, anche in bozza |
| `/p/:token` | cliente | La quotation condivisa: nessun login, solo il link |

Il calcolo è quello dei PDF attuali: `subtotale = somma voci (q.tà × giorni × prezzo × (1 + NIC%))`,
`totale = subtotale + production fee − sconto`, poi `+IVA`. Gli extras sono mostrati a parte.

Accesso al team: solo email **@chimerastudioss.com** (registrazione dalla pagina di login, con conferma via email).
La regola è applicata anche nel database (RLS), non solo nell'interfaccia.

## Backend

Supabase, progetto `preventivi-cool` (eu-central-1) — https://sqvtsfxqneywoparafox.supabase.co

- Schema: `supabase/migrations/`
- Tabelle: `categories`, `quotes`, `quote_versions`, `quote_sections`, `quote_items`, `works`, `quote_works`
- Il cliente legge tramite le funzioni `get_public_quote(token)` e `choose_quote_version(token, version, note)`; le tabelle non sono leggibili senza login.
- Video caricati nel bucket Storage `works` (pubblico in lettura).

## Sviluppo

```bash
npm install
cp .env.example .env   # URL e chiave pubblica di Supabase
npm run dev
```

## Pubblicazione

È un sito statico (`npm run build` → `dist/`). Già pronto per Vercel (`vercel.json`) e Netlify (`public/_redirects`).
Dopo il primo deploy, in Supabase → Authentication → URL Configuration imposta **Site URL** con l'indirizzo del sito,
così i link di conferma email portano all'app.
