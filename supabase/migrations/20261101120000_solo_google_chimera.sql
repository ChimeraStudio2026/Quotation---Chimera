-- Entra solo chi è nell'organizzazione Chimera Studios: email @chimerastudioss.com
-- e sessione aperta con Google (la app OAuth è "Internal", quindi Google accetta solo gli account del Workspace).
-- Le sessioni con password (es. il vecchio codice del team, team@chimerastudioss.com) non vedono più nulla.
-- Va applicata DOPO aver attivato Google su Supabase, altrimenti nessuno del team riesce a entrare.
create or replace function public.is_team() returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce(
    (auth.jwt() ->> 'email') ilike '%@chimerastudioss.com'
    and (auth.jwt() -> 'app_metadata' -> 'providers') ? 'google'
    and (auth.jwt() -> 'amr') @> '[{"method": "oauth"}]'::jsonb,
    false)
$$;

-- La usa anche la funzione quote-assistant, con il token di chi la chiama
grant execute on function public.is_team() to authenticated;
