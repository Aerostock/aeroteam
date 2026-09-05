-- ============================================================
-- Lot 3.1 — Versionnage des profils + gestion de conflit
-- À exécuter dans Supabase > SQL Editor
--
-- Ajoute rev (numéro de révision) et updated_at sur profiles.
-- save_profile_data devient conditionnel : la sauvegarde ne
-- réussit que si la révision envoyée correspond à la révision
-- serveur (sinon { error: 'conflict' }). Le client peut ensuite
-- recharger (get_profile) ou forcer l'écrasement (p_force = true).
-- ============================================================

-- 1) Colonnes de versionnage (non destructif : les profils
--    existants démarrent à rev = 0 et updated_at = now)
alter table public.profiles
  add column if not exists rev bigint not null default 0;

alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

-- 2) create_profile : renvoie aussi la révision initiale (0)
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
    'aircraft', p_aircraft,
    'rev', 0
  );
end;
$$;

-- 3) get_profile : renvoie rev et updated_at (consultation seule)
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
    select id::text as id, name, aircraft, rev, updated_at, data
    from public.profiles
    where code = p_code
  ) t;

  return coalesce(result, jsonb_build_object('error', 'not_found'));
end;
$$;

-- 4) save_profile_data : écriture optimiste conditionnelle
--    - p_rev   : révision connue du client
--    - p_force : true = écrasement manuel demandé par l'utilisateur
--    Succès   : rev = rev + 1, updated_at = now()
--    Conflit  : { error: 'conflict', rev, updated_at } sans écrire
create or replace function public.save_profile_data(
  p_code text,
  p_data jsonb,
  p_rev bigint default 0,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  current_rev bigint;
begin
  select rev
  into current_rev
  from public.profiles
  where code = p_code;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if not p_force and current_rev <> coalesce(p_rev, 0) then
    return jsonb_build_object(
      'error', 'conflict',
      'rev', current_rev,
      'updated_at', (select updated_at from public.profiles where code = p_code)
    );
  end if;

  update public.profiles
  set data = p_data, rev = rev + 1, updated_at = now()
  where code = p_code;

  select to_jsonb(t)
  into result
  from (
    select id::text as id, name, aircraft, rev, updated_at
    from public.profiles
    where code = p_code
  ) t;

  return coalesce(result, jsonb_build_object('error', 'not_found'));
end;
$$;