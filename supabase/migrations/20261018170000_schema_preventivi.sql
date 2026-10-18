-- Preventivi Chimera: schema iniziale
create extension if not exists pgcrypto with schema extensions;

-- Il team Chimera = utenti autenticati con email @chimerastudioss.com
create or replace function public.is_team() returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'email') ilike '%@chimerastudioss.com', false)
$$;

-- Macro categorie del preventivo (A–O, come nel PDF)
create table public.categories (
  code text primary key,
  letter text not null,
  name text not null,
  position int not null
);
insert into public.categories (code, letter, name, position) values
  ('PRE_PRODUCTION','A','Pre-production',1),
  ('CAST','B','Cast',2),
  ('DIRECTOR','C','Director / Creativity',3),
  ('CREW','D','Crew',4),
  ('LOCATION','E','Location / Studio',5),
  ('ART','F','Art department',6),
  ('EQUIPMENT','G','Equipment rental',7),
  ('LOGISTIC','H','Logistic / Hotels',8),
  ('FOOD','I','Food / Catering',9),
  ('POST_PRODUCTION','L','Post-production',10),
  ('USAGE_RIGHTS','M','Usage rights',11),
  ('INSURANCE','N','Insurance',12),
  ('OTHERS','O','Others / Bonus page',13);

-- I nostri lavori migliori, collegati alle categorie di servizio
create table public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  brand text,
  description text,
  video_url text not null,
  poster_url text,
  categories text[] not null default '{}',
  featured boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  code text,
  title text not null,
  client_name text not null,
  client_vat text,
  client_address text,
  intro text,
  quote_date date not null default current_date,
  validity_days int not null default 30,
  share_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  status text not null default 'draft' check (status in ('draft','sent','viewed','accepted')),
  selected_version_id uuid,
  selected_at timestamptz,
  client_note text,
  first_viewed_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  name text not null,
  tagline text,
  production_fee_pct numeric not null default 15,
  discount numeric not null default 0,
  vat_pct numeric not null default 22,
  unique (quote_id, position)
);
alter table public.quotes
  add constraint quotes_selected_version_fk foreign key (selected_version_id)
  references public.quote_versions(id) on delete set null;

create table public.quote_sections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.quote_versions(id) on delete cascade,
  category_code text not null references public.categories(code),
  note text,
  extras numeric not null default 0,
  unique (version_id, category_code)
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.quote_sections(id) on delete cascade,
  position int not null default 0,
  code text,
  job text not null,
  note text,
  qty numeric not null default 1,
  days numeric not null default 1,
  unit_price numeric not null default 0,
  nic_pct numeric not null default 0
);

-- Lavori scelti a mano per un preventivo (se vuoto: automatici per categoria)
create table public.quote_works (
  quote_id uuid not null references public.quotes(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  primary key (quote_id, work_id)
);

create index on public.quote_versions (quote_id);
create index on public.quote_sections (version_id);
create index on public.quote_items (section_id);
create index on public.quote_works (work_id);
create index on public.quotes (created_by);
create index on public.quotes (selected_version_id);
create index on public.quote_sections (category_code);

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger quotes_touch before update on public.quotes
  for each row execute function public.touch_updated_at();

-- RLS: solo il team legge e scrive. Il cliente passa dalle funzioni pubbliche qui sotto.
alter table public.categories enable row level security;
alter table public.works enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_versions enable row level security;
alter table public.quote_sections enable row level security;
alter table public.quote_items enable row level security;
alter table public.quote_works enable row level security;

create policy "team legge categorie" on public.categories for select to authenticated using ((select public.is_team()));
create policy "team gestisce works" on public.works for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));
create policy "team gestisce quotes" on public.quotes for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));
create policy "team gestisce versions" on public.quote_versions for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));
create policy "team gestisce sections" on public.quote_sections for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));
create policy "team gestisce items" on public.quote_items for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));
create policy "team gestisce quote_works" on public.quote_works for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));

-- Vista pubblica del preventivo, tramite link segreto
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
      where case when exists (select 1 from public.quote_works qw where qw.quote_id = q.id)
        then exists (select 1 from public.quote_works qw where qw.quote_id = q.id and qw.work_id = w.id)
        else w.categories && cats end)
  ) into result;
  return result;
end $$;

-- Il cliente sceglie una versione
create or replace function public.choose_quote_version(p_token text, p_version_id uuid, p_note text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare qid uuid;
begin
  select q.id into qid from public.quotes q
  join public.quote_versions v on v.quote_id = q.id and v.id = p_version_id
  where q.share_token = p_token and q.status <> 'draft';
  if qid is null then return false; end if;
  update public.quotes set selected_version_id = p_version_id, selected_at = now(),
    client_note = left(p_note, 2000), status = 'accepted'
  where id = qid;
  return true;
end $$;

revoke all on function public.get_public_quote(text) from public;
revoke all on function public.choose_quote_version(text, uuid, text) from public;
grant execute on function public.get_public_quote(text) to anon, authenticated;
grant execute on function public.choose_quote_version(text, uuid, text) to anon, authenticated;

-- Storage per video e copertine dei lavori
insert into storage.buckets (id, name, public) values ('works', 'works', true)
  on conflict (id) do nothing;
create policy "team carica works" on storage.objects for insert to authenticated
  with check (bucket_id = 'works' and (select public.is_team()));
create policy "team aggiorna works" on storage.objects for update to authenticated
  using (bucket_id = 'works' and (select public.is_team()));
create policy "team elimina works" on storage.objects for delete to authenticated
  using (bucket_id = 'works' and (select public.is_team()));
