-- ============================================================
-- Multi-administrateurs (plusieurs codes admin possibles)
-- À exécuter dans Supabase > SQL Editor
--
-- La table admins accepte plusieurs lignes : chaque administrateur
-- a son code haché + un nom lisible. check_admin valide contre
-- l'ensemble. Impossible de retirer le dernier administrateur.
-- ============================================================

-- 1) Colonne nom (lisible) pour chaque administrateur
alter table public.admins
  add column if not exists name text not null default '';

-- 2) check_admin : valide contre TOUTES les lignes
drop function if exists public.check_admin(text);

create or replace function public.check_admin(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
begin
  if public.too_many_attempts('admin', p_code) then
    return jsonb_build_object('ok', false, 'locked', true);
  end if;

  select exists (
    select 1 from public.admins
    where crypt(p_code, code_hash) = code_hash
  )
  into is_admin;

  if is_admin then
    perform public.clear_attempts('admin', p_code);
    return jsonb_build_object('ok', true, 'locked', false);
  end if;

  perform public.record_failed_attempt('admin', p_code);
  return jsonb_build_object('ok', false, 'locked', false);
end;
$$;

-- L'ancien admin unique (nom vide) devient « Admin » pour l'affichage
update public.admins set name = 'Admin'
where name = '' and (select count(*) from public.admins) = 1;

-- 3) Liste des administrateurs (noms uniquement, jamais les codes)
create or replace function public.admin_list_admins(p_admin_code text)
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
    select name
    from public.admins
  ) t;

  return jsonb_build_object('ok', true, 'admins', list);
end;
$$;

-- 4) Ajout d'un administrateur (par un admin existant)
create or replace function public.admin_add_admin(
  p_admin_code text,
  p_new_code text,
  p_new_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  if length(coalesce(p_new_code, '')) = 0 then
    return jsonb_build_object('error', 'code_requis');
  end if;

  if length(coalesce(p_new_name, '')) = 0 then
    return jsonb_build_object('error', 'nom_requis');
  end if;

  if exists (
    select 1 from public.admins
    where crypt(p_new_code, code_hash) = code_hash
  ) then
    return jsonb_build_object('error', 'deja_admin');
  end if;

  insert into public.admins (code_hash, name)
  values (crypt(p_new_code, gen_salt('bf')), trim(p_new_name));

  return jsonb_build_object('ok', true);
end;
$$;

-- 5) Retrait d'un administrateur (impossible de retirer le dernier)
create or replace function public.admin_remove_admin(
  p_admin_code text,
  p_target_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_admin boolean;
  total integer;
begin
  select (public.check_admin(p_admin_code))->>'ok' into is_admin;
  if is_admin is distinct from 'true' then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select count(*) into total from public.admins;

  if total <= 1 then
    return jsonb_build_object('error', 'dernier_admin');
  end if;

  delete from public.admins
  where crypt(p_target_code, code_hash) = code_hash;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;