-- Mail quando il cliente sceglie una versione: email del cliente sulla quotation e invio registrato
alter table public.quotes
  add column if not exists client_email text,
  add column if not exists chosen_email text,
  add column if not exists notified_at timestamptz;

-- Il cliente sceglie una versione e può lasciare/correggere la sua email
-- (nuova funzione: choose_quote_version resta per compatibilità)
create or replace function public.submit_quote_choice(p_token text, p_version_id uuid, p_note text default null, p_email text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare qid uuid;
begin
  select q.id into qid from public.quotes q
  join public.quote_versions v on v.quote_id = q.id and v.id = p_version_id
  where q.share_token = p_token and q.status <> 'draft';
  if qid is null then return false; end if;
  update public.quotes set selected_version_id = p_version_id, selected_at = now(),
    client_note = left(p_note, 2000), status = 'accepted',
    chosen_email = case when p_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then left(p_email, 320) else null end,
    notified_at = null
  where id = qid;
  return true;
end $$;

revoke all on function public.submit_quote_choice(text, uuid, text, text) from public;
grant execute on function public.submit_quote_choice(text, uuid, text, text) to anon, authenticated;

-- La pagina cliente riceve l'email per precompilare il campo
create or replace function public.get_public_client_email(p_token text)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(chosen_email, client_email) from public.quotes where share_token = p_token and status <> 'draft';
$$;
revoke all on function public.get_public_client_email(text) from public;
grant execute on function public.get_public_client_email(text) to anon, authenticated;
