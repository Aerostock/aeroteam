-- ============================================================
-- Schéma Supabase pour l'app de maintenance aéronautique
-- Exécuter dans Supabase > SQL Editor
--
-- Modèle : chaque profil est identifié par un CODE secret.
-- L'accès aux données se fait EXCLUSIVEMENT par des fonctions
-- RPC (SECURITY DEFINER) qui prennent le code en paramètre.
-- Aucun accès direct à la table n'est permis (RLS activé).
-- ============================================================

-- 1) Table des profils
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default '',
  aircraft text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 2) Activer RLS pour bloquer tout accès direct
alter table public.profiles enable row level security;

-- Aucune politique SELECT/INSERT/UPDATE/DELETE pour anon :
-- l'accès se fait uniquement via les fonctions RPC ci-dessous.

-- 3) Créer un profil (contrôle des doublons de code)
create or replace function public.create_profile(
  p_code text,
  p_name text,
  p_aircraft text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if exists (select 1 from public.profiles where code = p_code) then
    return jsonb_build_object('error', 'code_exists');
  end if;

  insert into public.profiles (code, name, aircraft, data)
  values (p_code, p_name, p_aircraft, '{}'::jsonb)
  returning id into new_id;

  return jsonb_build_object(
    'id', new_id,
    'code', p_code,
    'name', p_name,
    'aircraft', p_aircraft
  );
end;
$$;

-- 4) Récupérer un profil (avec ses données) par code
create or replace function public.get_profile(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select to_jsonb(t)
  into result
  from (
    select id::text as id, name, aircraft, data
    from public.profiles
    where code = p_code
  ) t;

  return coalesce(result, jsonb_build_object('error', 'not_found'));
end;
$$;

-- 5) Vérifier si un code existe (sans renvoyer les données)
create or replace function public.profile_exists(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (select 1 from public.profiles where code = p_code);
end;
$$;

-- 6) Enregistrer les données complètes d'un profil (tasks/teams/assignments/members)
create or replace function public.save_profile_data(p_code text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.profiles where code = p_code) then
    return jsonb_build_object('error', 'not_found');
  end if;

  update public.profiles
  set data = p_data
  where code = p_code;

  select to_jsonb(t)
  into result
  from (
    select id::text as id, name, aircraft
    from public.profiles
    where code = p_code
  ) t;

  return coalesce(result, jsonb_build_object('error', 'not_found'));
end;
$$;

-- 7) Mettre à jour les métadonnées (nom / avion) sans toucher aux données
create or replace function public.update_profile_meta(p_code text, p_name text, p_aircraft text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  update public.profiles
  set name = p_name, aircraft = p_aircraft
  where code = p_code;

  select to_jsonb(t)
  into result
  from (
    select id::text as id, name, aircraft
    from public.profiles
    where code = p_code
  ) t;

  return coalesce(result, jsonb_build_object('error', 'not_found'));
end;
$$;

-- 8) Supprimer un profil (toutes ses données) par code
create or replace function public.delete_profile(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where code = p_code;
  return found;
end;
$$;
