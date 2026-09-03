# Maintenance Aviation

Application web de gestion des équipes de maintenance aéronautique. Permet d'importer une liste de tâches depuis un fichier Excel, de créer des équipes et de répartir les tâches.

## Fonctionnalités

- **Import Excel** : chargez votre fichier (`.xlsx`, `.xls`, `.csv`), détection automatique des colonnes
- **Tableau de bord** : statistiques, répartition par catégorie, charge par équipe
- **Tâches** : liste organisée par catégorie avec couleurs automatiques
- **Équipes** : création modulable (1 à N membres)
- **Affectation** : drag & drop ou menu déroulant pour assigner les tâches
- **Export** : téléchargement du planning en Excel ou JSON

## Démarrage local

```bash
npm install
npm run dev
```

## Build production

```bash
npm run build
```

## Déploiement sur GitHub Pages

1. Créez un dépôt sur GitHub
2. Poussez le code :
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/VOTRE_COMPTE/VOTRE_DEPOT.git
   git push -u origin main
   ```
3. Dans GitHub : **Settings → Pages → Source → GitHub Actions**
4. Le site sera disponible à `https://VOTRE_COMPTE.github.io/VOTRE_DEPOT/`

## Format du fichier Excel

Colonnes supportées (détection automatique des en-têtes) :

| Colonne | Rôle |
|---------|------|
| Description / Libellé | Description de la tâche (obligatoire) |
| Catégorie / Type | Classée par couleur automatiquement |
| Priorité | Haute / Moyenne / Basse |
| Temps / Durée | Estimation |
| Avion | Appareil concerné |
| Zone / Emplacement | Zone de travail |
| Date | Échéance |
| Statut | État de la tâche |

Les données sont stockées dans le navigateur (localStorage).
