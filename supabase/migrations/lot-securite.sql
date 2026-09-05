-- ============================================================
-- Lot sécurité — code admin hors bundle + anti force brute
-- À exécuter dans Supabase > SQL Editor
--
-- 1) L'admin n'est plus un code en dur dans le JS : le code est
--    stocké HACHÉ (bcrypt via pgcrypto) dans la table admins.
-- 2) Les tentatives de connexion sont limitées : 5 échecs par
--    code et par usage -> verrouillage 15 minutes.
-- 3) Les nouveaux codes de profil doivent faire 8 caractères.
--
-- APRÈS exécution de ce script, il RESTE À DÉFINIR le premier
-- code admin (voir le bloc "BOOTSTRAP" en bas de fichier).
-- ============================================================

create extension if not exists pgcrypto;

-- 1) Table des codes admins (une seule ligne, hash bcrypt)
create table if not exists public.admins (
  code_hash text primary key
);

-- 2) Table des tentatives échouées (un enregistrement par essai)
create table if not exists public.login_attempts (
  purpose text not null,
  code text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists login_attempts_idx
  on public.login_attempts (purpose, code, attempted_at);

-- RLS : aucune politique -> anon ne peut ni lire ni écrire ces tables
alter table public.admins enable row level security;
alter table public.login_attempts enable row level security;

-- 3) Helpers partagés (utilisés par les fonctions SECURITY DEFINER)

-- 5 échecs sur les 15 dernières minutes ?
create or replace function public.too_many_attempts(p_purpose text, p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select count(*) >= 5
  from public.login_attempts
  where purpose = p_purpose and code = p_code
    and attempted_at > now() - interval '15 minutes';
$$;

create or replace function public.record_failed_attempt(p_purpose text, p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.login_attempts (purpose, code) values (p_purpose, p_code);
$$;

create or replace function public.clear_attempts(p_purpose text, p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.login_attempts where purpose = p_purpose and code = p_code;
$$;

-- 4) Connexion profil : intègre le verrouillage
drop function if exists public.profile_exists(text);

create or replace function public.profile_exists(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.too_many_attempts('profile', p_code) then
    return jsonb_build_object('ok', false, 'locked', true);
  end if;

  if exists (select 1 from public.profiles where code = p_code) then
    perform public.clear_attempts('profile', p_code);
    return jsonb_build_object('ok', true, 'locked', false);
  end if;

  perform public.record_failed_attempt('profile', p_code);
  return jsonb_build_object('ok', false, 'locked', false);
end;
$$;

drop function if exists public.get_profile(text);

create or replace function public.get_profile(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if public.too_many_attempts('profile', p_code) then
    return jsonb_build_object('error', 'locked');
  end if;

  select to_jsonb(t)
  into result
  from (
    select id::text as id, name, aircraft, rev, updated_at, data
    from public.profiles
    where code = p_code
  ) t;

  if result is not null then
    perform public.clear_attempts('profile', p_code);
    return result;
  end if;

  perform public.record_failed_attempt('profile', p_code);
  return jsonb_build_object('error', 'not_found');
end;
$$;

-- 5) Création de profil : code d'au moins 8 caractères
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
  if length(coalesce(p_code, '')) < 8 then
    return jsonb_build_object('error', 'code_too_short');
  end if;

  if exists (select 1 from public.profiles where code = p_code) then
    return jsonb_build_object('error', 'code_exists');
  end if;

  insert into public.profiles (code, name, aircraft, data)
  values (p_code, p_name, p_aircraft, '{}'::jsonb)
  returning id into new_id;

  return jsonb_build_object(
    'id', new_id, 'code', p_code, 'name', p_name, 'aircraft', p_aircraft, 'rev', 0
  );
end;
$$;

-- 6) Vérification du code administrateur (utilisée à la connexion)
create or replace function public.check_admin(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h text;
begin
  if public.too_many_attempts('admin', p_code) then
    return jsonb_build_object('ok', false, 'locked', true);
  end if;

  select code_hash into h from public.admins limit 1;

  if h is null then
    -- Aucun code admin défini : personne n'est admin
    return jsonb_build_object('ok', false, 'locked', false);
  end if;

  if crypt(p_code, h) = h then
    perform public.clear_attempts('admin', p_code);
    return jsonb_build_object('ok', true, 'locked', false);
  end if;

  perform public.record_failed_attempt('admin', p_code);
  return jsonb_build_object('ok', false, 'locked', false);
end;
$$;

-- 7) Changement du code administrateur (ancien code exigé, hash remplacé)
create or replace function public.set_admin_code(p_old text, p_new text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h text;
begin
  if public.too_many_attempts('admin', p_old) then
    return jsonb_build_object('error', 'locked');
  end if;

  select code_hash into h from public.admins limit 1;

  if h is not null and crypt(p_old, h) <> h then
    perform public.record_failed_attempt('admin', p_old);
    return jsonb_build_object('error', 'bad_old');
  end if;

  if length(coalesce(p_new, '')) < 8 then
    return jsonb_build_object('error', 'code_too_short');
  end if;

  delete from public.admins;
  insert into public.admins (code_hash) values (crypt(p_new, gen_salt('bf')));
  perform public.clear_attempts('admin', p_old);
  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- BOOTSTRAP — À EXÉCUTER UNE SEULE FOIS, APRÈS CE SCRIPT :
-- remplacez VOTRE_CODE_ADMIN par le code que vous choisissez
-- (8 caractères minimum, ne le partagez jamais, ne le mettez
-- jamais dans un fichier du dépôt).
--
-- set search_path = public, extensions;
-- insert into public.admins (code_hash)
-- select crypt('VOTRE_CODE_ADMIN', gen_salt('bf'))
-- where not exists (select 1 from public.admins);
-- ============================================================