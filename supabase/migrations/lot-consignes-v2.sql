-- ============================================================
-- Espace Consignes v2 — conversations par messages + photos
-- À exécuter dans Supabase > SQL Editor
--
-- Transforme les sujets en conversations : chaque réponse est
-- un message séparé (auteur, date, contenu, photos via Storage).
-- Le contenu initial d'un sujet devient son premier message.
-- ============================================================

-- 1) Table des messages (une ligne = une réponse)
create table if not exists public.consignes_messages (
  id uuid primary key default gen_random_uuid(),
  consigne_id uuid not null references public.consignes(id) on delete cascade,
  auteur text not null default '',
  contenu text not null default '',
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists consignes_messages_idx
  on public.consignes_messages (consigne_id, created_at);

alter table public.consignes_messages enable row level security;

-- 2) Migration : le contenu existant de chaque sujet devient
--    son premier message
insert into public.consignes_messages (consigne_id, auteur, contenu, created_at)
select id, '', contenu, updated_at
from public.consignes
where contenu is not null and contenu <> '';

-- 3) Le sujet ne garde plus que son titre, sa couleur et ses métadonnées
alter table public.consignes drop column if exists contenu;

-- 4) Stockage des photos (bucket public en lecture)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consignes-images',
  'consignes-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "consignes images read" on storage.objects
  for select to anon using (bucket_id = 'consignes-images');
create policy "consignes images upload" on storage.objects
  for insert to anon with check (bucket_id = 'consignes-images');
create policy "consignes images delete" on storage.objects
  for delete to anon using (bucket_id = 'consignes-images');

-- 5) RPC — liste des sujets (sans messages)
drop function if exists public.get_consignes();

create or replace function public.get_consignes()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  list jsonb;
begin
  select coalesce(jsonb_agg(t order by t.updated_at desc), '[]'::jsonb)
  into list
  from (
    select id::text as id, titre, couleur, ordre, updated_by, updated_at
    from public.consignes
  ) t;

  return jsonb_build_object('ok', true, 'consignes', list);
end;
$$;

-- 6) RPC — messages d'un sujet (du plus ancien au plus récent)
create or replace function public.get_messages(p_consigne_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  list jsonb;
begin
  select coalesce(jsonb_agg(t order by t.created_at), '[]'::jsonb)
  into list
  from (
    select id::text as id, auteur, contenu, images, created_at
    from public.consignes_messages
    where consigne_id = p_consigne_id
  ) t;

  return jsonb_build_object('ok', true, 'messages', list);
end;
$$;

-- 7) RPC — ajout d'un sujet (avec son premier message)
drop function if exists public.add_consigne(text, text, text, text);

create or replace function public.add_consigne(
  p_titre text,
  p_couleur text,
  p_contenu_initial text,
  p_updated_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  if length(coalesce(p_titre, '')) = 0 then
    return jsonb_build_object('error', 'titre_requis');
  end if;

  insert into public.consignes (titre, couleur, updated_by)
  values (p_titre, coalesce(p_couleur, '#0ea5e9'), coalesce(p_updated_by, ''))
  returning id into new_id;

  insert into public.consignes_messages (consigne_id, auteur, contenu)
  values (new_id, coalesce(p_updated_by, ''), coalesce(p_contenu_initial, ''));

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

-- 8) RPC — modification d'un sujet (titre / couleur seulement)
drop function if exists public.save_consigne(uuid, text, text, text, text);

create or replace function public.save_consigne(
  p_id uuid,
  p_titre text,
  p_couleur text,
  p_updated_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if length(coalesce(p_titre, '')) = 0 then
    return jsonb_build_object('error', 'titre_requis');
  end if;

  update public.consignes
  set titre = p_titre,
      couleur = coalesce(p_couleur, '#0ea5e9'),
      updated_by = coalesce(p_updated_by, ''),
      updated_at = now()
  where id = p_id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 9) RPC — ajout d'une réponse
create or replace function public.add_message(
  p_consigne_id uuid,
  p_contenu text,
  p_images jsonb,
  p_auteur text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  if length(coalesce(p_contenu, '')) = 0 and coalesce(p_images, '[]'::jsonb) = '[]'::jsonb then
    return jsonb_build_object('error', 'message_vide');
  end if;

  insert into public.consignes_messages (consigne_id, auteur, contenu, images)
  values (p_consigne_id, coalesce(p_auteur, ''), coalesce(p_contenu, ''), coalesce(p_images, '[]'::jsonb))
  returning id into new_id;

  update public.consignes
  set updated_at = now(), updated_by = coalesce(p_auteur, updated_by)
  where id = p_consigne_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

-- 10) RPC — suppression d'une réponse
create or replace function public.delete_message(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.consignes_messages where id = p_id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;