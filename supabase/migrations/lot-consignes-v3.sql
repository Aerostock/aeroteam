-- ============================================================
-- Consignes v3 — messages formatés (HTML) + propriété des messages
-- À exécuter dans Supabase > SQL Editor
--
-- 1) chaque message mémorise l'empreinte du code de son auteur :
--    seule cette empreinte (ou un admin) permet la suppression.
-- 2) les messages peuvent contenir du HTML formaté (barre d'outils)
--    en plus du texte simple (compatibilité messages existants).
-- ============================================================

alter table public.consignes_messages
  add column if not exists auteur_key text not null default '';

alter table public.consignes_messages
  add column if not exists contenu_html text not null default '';

-- 1) Ajout d'un sujet : l'empreinte de l'auteur est enregistrée
--    avec son premier message
drop function if exists public.add_consigne(text, text, text, text);

create or replace function public.add_consigne(
  p_titre text,
  p_couleur text,
  p_contenu text,
  p_contenu_html text,
  p_updated_by text,
  p_auteur_key text
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

  insert into public.consignes_messages (consigne_id, auteur, contenu, contenu_html, auteur_key)
  values (
    new_id,
    coalesce(p_updated_by, ''),
    coalesce(p_contenu, ''),
    coalesce(p_contenu_html, ''),
    coalesce(p_auteur_key, '')
  );

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

-- 2) Ajout d'une réponse : l'empreinte de l'auteur est enregistrée
drop function if exists public.add_message(uuid, text, jsonb, text);

create or replace function public.add_message(
  p_consigne_id uuid,
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
begin
  if length(coalesce(p_contenu, '')) = 0
     and length(coalesce(p_contenu_html, '')) = 0
     and coalesce(p_images, '[]'::jsonb) = '[]'::jsonb then
    return jsonb_build_object('error', 'message_vide');
  end if;

  insert into public.consignes_messages (consigne_id, auteur, contenu, contenu_html, images, auteur_key)
  values (
    p_consigne_id,
    coalesce(p_auteur, ''),
    coalesce(p_contenu, ''),
    coalesce(p_contenu_html, ''),
    coalesce(p_images, '[]'::jsonb),
    coalesce(p_auteur_key, '')
  )
  returning id into new_id;

  update public.consignes
  set updated_at = now(), updated_by = coalesce(p_auteur, updated_by)
  where id = p_consigne_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

-- 3) Suppression d'une réponse : auteur (empreinte) ou admin uniquement,
--    jamais un autre profil
drop function if exists public.delete_message(uuid);

create or replace function public.delete_message(
  p_id uuid,
  p_auteur_key text default '',
  p_admin_code text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
  message_key text;
begin
  select auteur_key into message_key from public.consignes_messages where id = p_id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if length(coalesce(p_admin_code, '')) > 0 then
    select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  end if;

  if is_admin = 'true' or (length(coalesce(p_auteur_key, '')) > 0 and p_auteur_key = message_key) then
    delete from public.consignes_messages where id = p_id;
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('error', 'not_authorized');
end;
$$;

-- 4) La lecture renvoie les nouveaux champs
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
    select id::text as id,
           auteur,
           contenu,
           contenu_html,
           auteur_key,
           images,
           created_at
    from public.consignes_messages
    where consigne_id = p_consigne_id
  ) t;

  return jsonb_build_object('ok', true, 'messages', list);
end;
$$;