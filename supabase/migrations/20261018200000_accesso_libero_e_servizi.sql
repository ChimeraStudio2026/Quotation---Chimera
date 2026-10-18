-- 1. Accesso senza login: il ruolo anon (chiave pubblica) può leggere e scrivere tutto.
--    Le policy si sommano a quelle del team, che restano.
create policy "accesso libero categorie" on public.categories for select to anon using (true);
create policy "accesso libero works" on public.works for all to anon using (true) with check (true);
create policy "accesso libero quotes" on public.quotes for all to anon using (true) with check (true);
create policy "accesso libero versions" on public.quote_versions for all to anon using (true) with check (true);
create policy "accesso libero sections" on public.quote_sections for all to anon using (true) with check (true);
create policy "accesso libero items" on public.quote_items for all to anon using (true) with check (true);
create policy "accesso libero quote_works" on public.quote_works for all to anon using (true) with check (true);
create policy "accesso libero carica works" on storage.objects for insert to anon with check (bucket_id = 'works');
create policy "accesso libero aggiorna works" on storage.objects for update to anon using (bucket_id = 'works');
create policy "accesso libero elimina works" on storage.objects for delete to anon using (bucket_id = 'works');

-- 2. Linee di servizio Chimera (come sul sito): sui lavori e sulle quotation
alter table public.works add column service text;
alter table public.works add column logo_url text;
alter table public.works add column link_url text;
alter table public.quotes add column services text[] not null default '{}';

-- 3. Lavori mostrati al cliente: scelti a mano > per servizio della quotation > per categorie incluse
create or replace function public.get_public_quote(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  q public.quotes;
  result jsonb;
  cats text[];
begin
  select * into q from public.quotes where share_token = p_token and status <> 'draft';
  if not found then return null; end if;

  if q.first_viewed_at is null then
    update public.quotes set first_viewed_at = now(),
      status = case when status = 'sent' then 'viewed' else status end
    where id = q.id;
  end if;

  select coalesce(array_agg(distinct s.category_code), '{}') into cats
  from public.quote_sections s join public.quote_versions v on v.id = s.version_id
  where v.quote_id = q.id
    and (exists (select 1 from public.quote_items i where i.section_id = s.id) or coalesce(s.note,'') <> '');

  select jsonb_build_object(
    'quote', jsonb_build_object(
      'id', q.id, 'code', q.code, 'title', q.title, 'client_name', q.client_name,
      'client_vat', q.client_vat, 'client_address', q.client_address, 'intro', q.intro,
      'quote_date', q.quote_date, 'validity_days', q.validity_days, 'status', q.status,
      'services', q.services,
      'selected_version_id', q.selected_version_id, 'selected_at', q.selected_at),
    'categories', (select jsonb_agg(to_jsonb(c) order by c.position) from public.categories c),
    'versions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', v.id, 'position', v.position, 'name', v.name, 'tagline', v.tagline,
        'production_fee_pct', v.production_fee_pct, 'discount', v.discount, 'vat_pct', v.vat_pct,
        'sections', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id, 'category_code', s.category_code, 'note', s.note, 'extras', s.extras,
            'items', (select coalesce(jsonb_agg(to_jsonb(i) order by i.position), '[]'::jsonb)
                      from public.quote_items i where i.section_id = s.id)
          )), '[]'::jsonb) from public.quote_sections s where s.version_id = v.id)
      ) order by v.position), '[]'::jsonb)
      from public.quote_versions v where v.quote_id = q.id),
    'works', (
      select coalesce(jsonb_agg(to_jsonb(w) order by w.featured desc, w.position), '[]'::jsonb)
      from public.works w
      where case
        when exists (select 1 from public.quote_works qw where qw.quote_id = q.id)
          then exists (select 1 from public.quote_works qw where qw.quote_id = q.id and qw.work_id = w.id)
        when cardinality(q.services) > 0 then w.service = any(q.services)
        else w.categories && cats end)
  ) into result;
  return result;
end $$;
