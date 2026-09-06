-- ============================================================
-- Lot admin — liste des profils + suppression (admin uniquement)
-- À exécuter dans Supabase > SQL Editor
--
-- Les codes de profils ne sont JAMAIS renvoyés au client,
-- seule l'administration (vérifiée côté serveur) peut lister
-- et supprimer des profils par leur id.
-- ============================================================

-- 1) Liste des profils (nom, avion, date de création — sans le code)
create or replace function public.admin_list_profiles(p_admin_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
  list jsonb;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select coalesce(jsonb_agg(t order by t.name), '[]'::jsonb)
  into list
  from (
    select id::text as id, name, aircraft, created_at
    from public.profiles
  ) t;

  return jsonb_build_object('ok', true, 'profiles', list);
end;
$$;

-- 2) Suppression d'un profil par id (admin uniquement)
create or replace function public.admin_delete_profile(p_admin_code text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
  target_code text;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select code into target_code from public.profiles where id = p_id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  delete from public.login_attempts where code = target_code;
  delete from public.profiles where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;