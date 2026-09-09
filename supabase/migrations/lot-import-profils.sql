-- ============================================================
-- Import en masse des profils avion (admin uniquement)
-- À exécuter dans Supabase > SQL Editor
--
-- La création de profil par l'import manager autorise les codes
-- COURTS (immatriculations type F-GSQB, 6 caractères) — dérogation
-- à la règle des 8 caractères, uniquement via cette RPC vérifiée
-- par le code administrateur.
-- ============================================================

create or replace function public.admin_create_profile(
  p_admin_code text,
  p_code text,
  p_name text,
  p_aircraft text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
  new_id uuid;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  if length(coalesce(p_code, '')) = 0 then
    return jsonb_build_object('error', 'code_requis');
  end if;

  if exists (select 1 from public.profiles where code = p_code) then
    return jsonb_build_object('error', 'code_exists');
  end if;

  insert into public.profiles (code, name, aircraft, data)
  values (trim(p_code), coalesce(p_name, ''), coalesce(p_aircraft, ''), '{}'::jsonb)
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id, 'rev', 0);
end;
$$;