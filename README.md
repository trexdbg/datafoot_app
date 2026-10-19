# DataFoot App

Site public statique de DataFoot, construit avec Astro et déployé sur GitHub Pages.

## Stack

- Astro 7
- TypeScript
- Markdown Content Collections
- CSS natif
- GitHub Actions
- GitHub Pages

Aucun backend n'est nécessaire pour le MVP.

## Données affichées

Le site est déjà prévu pour afficher :

- articles Markdown générés par le pipeline ;
- statistiques joueurs / xG provenant d'Understat ;
- résultats et fixtures provenant d'OpenLigaDB ;
- provenance et liens vers les sources ;
- dataset JSON brut dans `public/data/stats.json`.

Sorare sera ajouté au dataset public lorsque les requêtes GraphQL métier seront configurées avec les identifiants/API du dépôt privé.

## Profils de match — météo de Mbappé

Le premier profil historique est disponible à
\`/datafoot_app/matchs/finale-2022/mbappe/\` (finale du Mondial 2022,
Argentine–France). C'est une page Astro intégralement pré-rendue :
aucune clé et aucune API appelée par le visiteur.

- Données à construire **uniquement dans le dépôt privé**
  [trexdbg/datafoot](https://github.com/trexdbg/datafoot), avec
  \`python -m datafoot.match_profiles\`.
- Publication automatique du même JSON dans
  \`src/data/matches/2022-final-mbappe.json\` (import Astro au build) et
  \`public/data/matches/2022-final-mbappe.json\` (téléchargement).
- Le JSON initial est issu des vrais événements publics StatsBomb de la finale
  et sera remplacé par la sortie reproductible du producteur.
- Le score 0–100 est un **indice d'activité événementielle relatif au match**.
  Il ne représente ni un capteur GPS, ni une distance parcourue.
- Le flux brut StatsBomb n'est pas servi par GitHub Pages ; seul un profil
  dérivé et ses métadonnées de provenance sont publiés.
- Attribution obligatoire à StatsBomb (logo officiel et lien vers Open Data).

Le build est vérifié par \`.github/workflows/match-profile-check.yml\`
sur les PR concernées. Le lien est présent sur l'accueil et dans la navigation.

## Développement local

```bash
npm install
npm run dev
```

Validation et build :

```bash
npm run build
```

## Contenu automatisé

Le dépôt privé `trexdbg/datafoot` écrit automatiquement :

```
src/content/articles/*.md
src/data/stats.json
public/data/stats.json
```

Un push sur `main` déclenche ensuite le workflow de déploiement GitHub Pages.

## GitHub Pages

Le projet est configuré pour être servi avec le préfixe :

```
/datafoot_app
```

URL cible :

```
https://trexdbg.github.io/datafoot_app/
```

Dans **Settings -> Pages**, la source de publication doit être configurée sur **GitHub Actions**.

## Structure

```
src/
├── components/
├── content/
│   └── articles/
├── data/
│   └── stats.json
├── layouts/
├── pages/
│   ├── articles/
│   ├── index.astro
│   └── stats.astro
└── styles/
```

Le site et son build sont entièrement statiques : aucun serveur applicatif n'est nécessaire.
