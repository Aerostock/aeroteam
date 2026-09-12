-- ============================================================
-- Correctif Consignes v6 — envoi de messages dans les dossiers
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
--
-- La migration v6 avait oublié de rendre consigne_id facultatif :
-- chaque message posté dans un dossier (semaine ou avion) échouait
-- avec une erreur "null value in column consigne_id".
-- ============================================================

alter table public.consignes_messages
  alter column consigne_id drop not null;
