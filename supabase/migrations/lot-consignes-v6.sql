-- ============================================================
-- Consignes v6 — les conversations vivent directement dans
-- les sous-dossiers avion (plus d'étape "sujet")
-- À exécuter dans Supabase > SQL Editor
--
-- 1) Les dossiers avion deviennent des conversations : ils
--    gagnent une couleur et un suivi d'activité.
-- 2) Les messages sont rattachés au dossier avion (les messages
--    existants sont déplacés automatiquement depuis leurs sujets).
-- ============================================================

-- 1) Dossiers : couleur + activité
alter table public.consignes_folders
  add column if not exists couleur text not null default '#0ea5e9';

alter table public.consignes_folders
  add column if not exists updated_by text not null default '';

alter table public.consignes_folders
  add column if not exists updated_at timestamptz not null default now();

-- 2) Messages : rattachés au dossier avion
alter table public.consignes_messages
  add column if not exists dossier_id uuid
  references public.consignes_folders(id) on delete cascade;

-- 3) Déplacement des messages existants : sujet -> dossier avion
update public.consignes_messages as m
set dossier_id = c.dossier_id
from public.consignes as c
where m.consigne_id = c.id
  and m.dossier_id is null;

-- 4) RPC — liste des dossiers (avec couleur et activité)
drop function if exists public.get_folders();

create or replace function public.get_folders()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  list jsonb;
begin
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  into list
  from (
    select id::text as id,
           parent_id::text as parent_id,
           name,
           couleur,
           created_by,
           updated_by,
           updated_at
    from public.consignes_folders
  ) t;

  return jsonb_build_object('ok', true, 'folders', list);
end;
$$;

-- 5) RPC — création d'un dossier (semaine si p_parent_id NULL, sinon avion)
drop function if exists public.add_folder(uuid, text, text);

create or replace function public.add_folder(
  p_parent_id uuid,
  p_name text,
  p_couleur text,
  p_created_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  if length(coalesce(p_name, '')) = 0 then
    return jsonb_build_object('error', 'nom_requis');
  end if;

  insert into public.consignes_folders (parent_id, name, couleur, created_by)
  values (p_parent_id, trim(p_name), coalesce(p_couleur, '#0ea5e9'), coalesce(p_created_by, ''))
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

-- 6) RPC — messages d'un dossier avion
--    (p_dossier_id = '__none__' renvoie les messages sans dossier)
drop function if exists public.get_messages(uuid);

create or replace function public.get_messages(p_dossier_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  list jsonb;
begin
  if p_dossier_id = '__none__' then
    select coalesce(jsonb_agg(t order by t.created_at), '[]'::jsonb)
    into list
    from (
      select id::text as id, auteur, contenu, contenu_html, auteur_key, images, created_at
      from public.consignes_messages
      where dossier_id is null
    ) t;
  else
    select coalesce(jsonb_agg(t order by t.created_at), '[]'::jsonb)
    into list
    from (
      select id::text as id, auteur, contenu, contenu_html, auteur_key, images, created_at
      from public.consignes_messages
      where dossier_id = p_dossier_id::uuid
    ) t;
  end if;

  return jsonb_build_object('ok', true, 'messages', list);
end;
$$;

-- 7) RPC — ajout d'une réponse dans un dossier avion
drop function if exists public.add_message(uuid, text, text, jsonb, text, text);

create or replace function public.add_message(
  p_dossier_id text,
  p_contenu text,
  p_contenu_html text,
  p_images jsonb,
  p_auteur text,
  p_auteur_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
  target_id uuid;
begin
  if length(coalesce(p_contenu, '')) = 0
     and length(coalesce(p_contenu_html, '')) = 0
     and coalesce(p_images, '[]'::jsonb) = '[]'::jsonb then
    return jsonb_build_object('error', 'message_vide');
  end if;

  if p_dossier_id is not null and p_dossier_id <> '__none__' then
    target_id := p_dossier_id::uuid;
  end if;

  insert into public.consignes_messages (dossier_id, auteur, contenu, contenu_html, images, auteur_key)
  values (
    target_id,
    coalesce(p_auteur, ''),
    coalesce(p_contenu, ''),
    coalesce(p_contenu_html, ''),
    coalesce(p_images, '[]'::jsonb),
    coalesce(p_auteur_key, '')
  )
  returning id into new_id;

  if target_id is not null then
    update public.consignes_folders
    set updated_at = now(), updated_by = coalesce(p_auteur, updated_by)
    where id = target_id;
  end if;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;