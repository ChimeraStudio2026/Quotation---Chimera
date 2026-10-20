-- Costo interno di ogni voce (dal listino): serve al team per vedere il margine.
-- La vista pubblica lo toglie esplicitamente, così il cliente non lo vede mai.

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
        'references', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', r.id, 'title', r.title, 'note', r.note, 'media_url', r.media_url, 'media_type', r.media_type
          ) order by r.position, r.created_at), '[]'::jsonb)
          from public.quote_references r where r.quote_id = q.id and r.version_position = v.position),
        'sections', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id, 'category_code', s.category_code, 'note', s.note, 'extras', s.extras,
            -- il costo interno non esce mai verso il cliente
            'items', (select coalesce(jsonb_agg(to_jsonb(i) - 'unit_cost' order by i.position), '[]'::jsonb)
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

alter table public.quote_items add column if not exists unit_cost numeric;
