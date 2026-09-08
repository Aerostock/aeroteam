-- ============================================================
-- Consignes v4 — arborescence par semaine puis avion
-- À exécuter dans Supabase > SQL Editor
--
-- Chaque sujet appartient à un dossier "Semaine XX" puis à un
-- dossier d'avion (ex. "F-GKXT"). Les sujets existants sont
-- conservés (semaine/avion vides = dossiers "Sans semaine",
-- "Sans avion", modifiables par la suite).
-- ============================================================

alter table public.consignes
  add column if not exists semaine text not null default '';

alter table public.consignes
  add column if not exists avion text not null default '';

create index if not exists consignes_week_idx
  on public.consignes (semaine, avion);

-- 1) Création d'un sujet avec sa semaine et son avion
drop function if exists public.add_consigne(text, text, text, text, text, text);

create or replace function public.add_consigne(
  p_titre text,
  p_couleur text,
  p_contenu text,
  p_contenu_html text,
  p_updated_by text,
  p_auteur_key text,
  p_semaine text,
  p_avion text
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

  insert into public.consignes (titre, couleur, updated_by, semaine, avion)
  values (
    p_titre,
    coalesce(p_couleur, '#0ea5e9'),
    coalesce(p_updated_by, ''),
    coalesce(p_semaine, ''),
    coalesce(p_avion, '')
  )
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

-- 2) Modification d'un sujet (titre / couleur / semaine / avion)
drop function if exists public.save_consigne(uuid, text, text, text);

create or replace function public.save_consigne(
  p_id uuid,
  p_titre text,
  p_couleur text,
  p_semaine text,
  p_avion text,
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
      semaine = coalesce(p_semaine, semaine),
      avion = coalesce(p_avion, avion),
      updated_by = coalesce(p_updated_by, ''),
      updated_at = now()
  where id = p_id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 3) La liste renvoie semaine et avion
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
  select coalesce(jsonb_agg(t order by t.semaine desc, t.avion, t.titre), '[]'::jsonb)
  into list
  from (
    select id::text as id, titre, couleur, ordre, semaine, avion, updated_by, updated_at
    from public.consignes
  ) t;

  return jsonb_build_object('ok', true, 'consignes', list);
end;
$$;