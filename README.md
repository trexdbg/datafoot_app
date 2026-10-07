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
