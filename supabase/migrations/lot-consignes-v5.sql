-- ============================================================
-- Consignes v5 — vrais dossiers (semaine -> avion -> sujets)
-- À exécuter dans Supabase > SQL Editor
--
-- Les sujets appartiennent désormais à un sous-dossier avion.
-- Les dossiers de niveau 1 = semaines (nom saisi manuellement),
-- les dossiers de niveau 2 = immatriculations (ex. F-GKXT).
-- Les données existantes (semaine/avion) sont converties
-- automatiquement en dossiers.
-- ============================================================

-- 1) Table des dossiers (parent_id NULL = dossier semaine)
create table if not exists public.consignes_folders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.consignes_folders(id) on delete cascade,
  name text not null,
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists consignes_folders_idx
  on public.consignes_folders (parent_id);

alter table public.consignes_folders enable row level security;

-- 2) Les sujets pointent vers leur sous-dossier avion
alter table public.consignes
  add column if not exists dossier_id uuid
  references public.consignes_folders(id) on delete cascade;

-- 3) Conversion des sujets existants : semaine/avion -> dossiers
--    (uniquement si les colonnes semaine/avion existent, c'est-à-dire
--    si la migration v4 a été appliquée ; sinon tout reste en place)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'consignes'
      and column_name = 'semaine'
  ) then

    insert into public.consignes_folders (name, created_by)
    select distinct coalesce(nullif(semaine, ''), 'Sans semaine')
    from public.consignes
    where dossier_id is null;

    update public.consignes as c
    set dossier_id = (
      select f1.id
      from public.consignes_folders as f1
      where f1.parent_id is null
        and f1.name = coalesce(nullif(c.semaine, ''), 'Sans semaine')
        and c.dossier_id is null
      limit 1
    );

    insert into public.consignes_folders (parent_id, name, created_by)
    select distinct
      (select f1.id from public.consignes_folders as f1
       where f1.parent_id is null
         and f1.name = coalesce(nullif(c.semaine, ''), 'Sans semaine')
       limit 1),
      coalesce(nullif(c.avion, ''), 'Sans avion'),
      ''
    from public.consignes as c
    where c.dossier_id is null;

    update public.consignes as c
    set dossier_id = (
      select f2.id
      from public.consignes_folders as f2
      where f2.parent_id is not null
        and f2.name = coalesce(nullif(c.avion, ''), 'Sans avion')
        and f2.parent_id = (
          select f1.id from public.consignes_folders as f1
          where f1.parent_id is null
            and f1.name = coalesce(nullif(c.semaine, ''), 'Sans semaine')
          limit 1
        )
        and c.dossier_id is null
      limit 1
    );

    alter table public.consignes drop column if exists semaine;
    alter table public.consignes drop column if exists avion;
  end if;
end $$;

-- 5) RPC — liste des dossiers
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
           created_by,
           created_at
    from public.consignes_folders
  ) t;

  return jsonb_build_object('ok', true, 'folders', list);
end;
$$;

-- 6) RPC — création d'un dossier (p_parent_id NULL = semaine)
create or replace function public.add_folder(
  p_parent_id uuid,
  p_name text,
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

  insert into public.consignes_folders (parent_id, name, created_by)
  values (p_parent_id, trim(p_name), coalesce(p_created_by, ''))
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

-- 7) RPC — renommage d'un dossier
create or replace function public.rename_folder(p_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if length(coalesce(p_name, '')) = 0 then
    return jsonb_build_object('error', 'nom_requis');
  end if;

  update public.consignes_folders set name = trim(p_name) where id = p_id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 8) RPC — suppression d'un dossier (supprime aussi ses sous-dossiers
--    et tous les sujets qu'il contient, en cascade)
create or replace function public.delete_folder(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.consignes_folders where id = p_id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 9) Sujets : dossier au lieu de semaine/avion
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
  select coalesce(jsonb_agg(t order by t.titre), '[]'::jsonb)
  into list
  from (
    select id::text as id, titre, couleur, ordre,
           dossier_id::text as dossier_id,
           updated_by, updated_at
    from public.consignes
  ) t;

  return jsonb_build_object('ok', true, 'consignes', list);
end;
$$;

drop function if exists public.add_consigne(text, text, text, text, text, text, text, text);

create or replace function public.add_consigne(
  p_dossier_id uuid,
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

  if p_dossier_id is null then
    return jsonb_build_object('error', 'dossier_requis');
  end if;

  insert into public.consignes (titre, couleur, updated_by, dossier_id)
  values (p_titre, coalesce(p_couleur, '#0ea5e9'), coalesce(p_updated_by, ''), p_dossier_id)
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

drop function if exists public.save_consigne(uuid, text, text, text, text, text);

create or replace function public.save_consigne(
  p_id uuid,
  p_titre text,
  p_couleur text,
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
      updated_by = coalesce(p_updated_by, ''),
      updated_at = now()
  where id = p_id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;