-- Torna all'accesso solo per il team: il team entra con il codice condiviso
-- (account team@chimerastudioss.com), quindi le regole di accesso libero non servono più.
drop policy if exists "accesso libero categorie" on public.categories;
drop policy if exists "accesso libero works" on public.works;
drop policy if exists "accesso libero quotes" on public.quotes;
drop policy if exists "accesso libero versions" on public.quote_versions;
drop policy if exists "accesso libero sections" on public.quote_sections;
drop policy if exists "accesso libero items" on public.quote_items;
drop policy if exists "accesso libero quote_works" on public.quote_works;
drop policy if exists "accesso libero carica works" on storage.objects;
drop policy if exists "accesso libero aggiorna works" on storage.objects;
drop policy if exists "accesso libero elimina works" on storage.objects;
