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

## Profils de match — activité de Mbappé

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
- L'ancien JSON contient toujours l'indice relatif v1, à titre de provenance / compatibilité.
- Le nouveau graphique utilise **148 actions StatsBomb horodatées** et enregistrées
  dans `src/data/matches/2022-final-mbappe-actions.json`, indépendamment des
  éventuelles réécritures du JSON v1 par le pipeline privé.
- Le barème éditorial v2 est explicite : score initial 50, −1 chaque minute,
  +5 par passe réussie, +5 par dribble réussi, +45 par but, plancher zéro.
  L'interpolation visuelle conserve les valeurs calculées à chaque minute.
- Chaque événement est visible dans le journal et sur la bande sous le graphique.
  Aucune action manquante n'est inventée. L'indice n'est ni une donnée GPS,
  ni un effort physique, ni une mesure de vitesse.
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

## Réseau de passes animé — Messi, finale 2022

La page `/datafoot_app/matchs/finale-2022/messi/` montre Messi au centre des 10 partenaires avec lesquels il échange le plus de passes réussies pendant la finale de 2022. Les projectiles cyan et orange matérialisent passes données et reçues, et les lignes épaississent selon le cumul. Lecture, pause, accélération, filtre par partenaire, navigation temporelle et prise en charge du mouvement réduit.

Le fichier réel `src/data/matches/2022-final-messi-passes.json` est construit dans le dépôt privé `trexdbg/datafoot` par `python -m datafoot.messi_passes`, puis publié en double dans `public/data/matches`. Quand ce fichier est absent, l'interface affiche **un mode démonstration explicitement fictif**, sans faire passer des nombres simulés pour des statistiques réelles. Dès la publication, le navigateur charge les données réelles de StatsBomb automatiquement. Attribution StatsBomb et lien vers la source sur la page.

## Messi Pass Wars — réseau de passes multi-saisons

Page : `/datafoot_app/joueurs/messi/pass-wars/`. Elle exploite exclusivement les **vraies passes réussies** issues de `datafoot.messi_pass_wars` (StatsBomb Open Data), dans un **échantillon multi-saisons** : ce n’est pas un bilan exhaustif de carrière. Jusqu’à 30 partenaires (top calculé dynamiquement avec les filtres équipe, saison, compétition) ; deux sens en cyan/orange, particules lumineuses, ondes d’impact, épaississement progressif, accélération, mode Battle et classement. Aucune statistique simulée en cas de source absente : un message d’erreur explicite s’affiche.

Les fichiers `src/data/players/messi-pass-wars*.json` et `public/data/players/messi-pass-wars*.json` sont produits par le workflow hebdomadaire `datafoot/.github/workflows/pass-wars.yml`, qui peut aussi être lancé manuellement. Les événements raw StatsBomb ne sont pas copiés sur GitHub Pages : seul le JSON dérivé utile à l’animation est exposé. Credits StatsBomb/Hudl visibles.
