-- ============================================================
-- Espace Consignes — tuiles partagées entre tous les profils
-- À exécuter dans Supabase > SQL Editor
--
-- Table unique "consignes" : tous les profils lisent et écrivent.
-- Accès exclusivement via des RPC SECURITY DEFINER (RLS fermée).
-- Aucune donnée sensible : le profil (nom) qui a modifié est
-- conservé à titre indicatif.
-- ============================================================

create table if not exists public.consignes (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  couleur text not null default '#0ea5e9',
  contenu text not null default '',
  ordre integer not null default 0,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.consignes enable row level security;

-- 1) Liste complète des consignes (tous les profils)
create or replace function public.get_consignes()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  list jsonb;
begin
  select coalesce(jsonb_agg(t order by t.ordre, t.titre), '[]'::jsonb)
  into list
  from (
    select id::text as id, titre, couleur, contenu, ordre, updated_by, updated_at
    from public.consignes
  ) t;

  return jsonb_build_object('ok', true, 'consignes', list);
end;
$$;

-- 2) Ajout d'une consigne
create or replace function public.add_consigne(
  p_titre text,
  p_couleur text,
  p_contenu text,
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

  insert into public.consignes (titre, couleur, contenu, updated_by)
  values (p_titre, coalesce(p_couleur, '#0ea5e9'), coalesce(p_contenu, ''), coalesce(p_updated_by, ''))
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

-- 3) Modification d'une consigne (remplace titre/couleur/contenu/auteur)
create or replace function public.save_consigne(
  p_id uuid,
  p_titre text,
  p_couleur text,
  p_contenu text,
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
      contenu = coalesce(p_contenu, ''),
      updated_by = coalesce(p_updated_by, ''),
      updated_at = now()
  where id = p_id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 4) Suppression d'une consigne
create or replace function public.delete_consigne(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.consignes where id = p_id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;