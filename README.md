# AeroTeam — Maintenance Aviation

Application web de gestion des équipes de maintenance aéronautique. Permet d'importer une liste de tâches depuis un fichier Excel, de créer des équipes et de répartir les tâches, avec sauvegarde dans le cloud (Supabase), synchronisation entre appareils et utilisation hors ligne.

## Fonctionnalités

- **Import Excel** (`.xlsx`, `.xls`, `.csv`) : détection automatique des colonnes, filtres configurables (skills `CABB*`, statuts `ACTV` / `PAUSE`)
- **Tableau de bord** : statistiques, répartition par bloc, charge par équipe, impression du récap équipe
- **Tâches** : liste organisée par zone avec recherche et filtres par bloc/statut
- **Équipes** : création modulable (1 à N membres), **verrouillage par équipe** (une équipe verrouillée ne reçoit plus de tâches à la répartition automatique)
- **Affectation** : drag & drop ou menus, **répartition automatique assistée** (choix des blocs et des sous-blocs, équilibre par nombre de tâches, Found Fault prioritaire, annulation), retrait / changement d'équipe par tâche, corbeille de désaffectation dans le récap
- **Préparation de charge** : pochettes virtuelles, impression et **export PDF** des pochettes
- **Export** : planning Excel ou JSON
- **Sauvegarde robuste** : statut de sauvegarde visible, reprise automatique hors connexion, **versionnage avec détection de conflit** entre appareils (recharger / écraser)
- **Synchronisation entre appareils** : mise à jour toutes les 15 s
- **PWA hors ligne** : installation sur écran d'accueil, consultation et édition sans réseau (cache local des profils)
- **Sécurité** : code administrateur vérifié côté serveur (hash bcrypt, jamais dans le client), verrouillage anti force brute (5 échecs / 15 min), codes de profil ≥ 8 caractères

## Architecture

- React 19 + Vite 8 + Tailwind CSS 4, déployé sur **GitHub Pages** (GitHub Actions)
- Données stockées dans **Supabase** (Postgres) : un profil par code, données dans un `jsonb`, accès exclusivement via des fonctions RPC `SECURITY DEFINER` (RLS bloquée côté anon)
- Tests unitaires : **Vitest** (`npm test`)

## Démarrage local

```bash
npm install
```

Copier `.env.example` en `.env` et renseigner les valeurs du projet Supabase
(Project Settings → API) :

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

> La clé `anon` est publique par conception : toute la protection repose sur les
> fonctions RPC. Ne jamais y associer de données sensibles côté client.

```bash
npm run dev
```

## Base de données (Supabase)

Dans Supabase → SQL Editor, exécuter dans l'ordre :

1. `supabase/schema.sql` — schéma de base (table `profiles`, fonctions RPC initiales)
2. `supabase/migrations/lot-3-1-versionnement.sql` — révisions + conflits
3. `supabase/migrations/lot-securite.sql` — admin haché, anti force brute, codes ≥ 8 caractères
4. **Bootstrap admin** (une seule fois, à la main, jamais dans un fichier du dépôt) :

```sql
set search_path = public, extensions;
insert into public.admins (code_hash)
select crypt('VOTRE_CODE_ADMIN', gen_salt('bf'))
where not exists (select 1 from public.admins);
```

## Déploiement

Dans GitHub → Settings → Secrets and variables → Actions, configurer :

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Pousser sur `main` déclenche automatiquement le build et le déploiement sur
GitHub Pages (`https://VOTRE_COMPTE.github.io/aeroteam/`). Penser à un
rechargement forcé (Ctrl+F5) après chaque déploiement, ou en navigation privée.

## Format du fichier Excel

Colonnes supportées (détection par alias, insensible à la casse et aux accents) :

| Colonne | Rôle |
|---------|------|
| Seq._Nr. | Numéro de ligne |
| Task_Name | Description de la tâche (obligatoire) |
| Skills | Métier (filtré sur CABB par défaut) |
| MTX_Status | État (ACTV / PAUSE gardés par défaut) |
| Task_Type | Bloc (JIC, CORR, MPC, ADHOC, EO…) |
| Work_Area | Zone de travail (sous-bloc) |
| Phase, Shift | Affectation / poste |
| Scheduled_Start_Date / Scheduled_End_Date | Échéances |
| Scheduled_Hours | Estimation |
| Aircraft_Registration | Appareil |
| Work_Package_Barcode, Task_Barcode | Références |

Les règles de filtrage sont configurables dans `src/utils/helpers.js` (`IMPORT_FILTERS`).

## Scripts

```bash
npm run dev      # serveur de développement
npm run build    # build de production
npm run lint     # oxlint
npm test         # tests unitaires (Vitest)
```

## Licence

Non définie — à décider avec la direction (dépôt public).