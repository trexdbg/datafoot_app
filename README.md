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


## Atlas Mondial 2022 — module phare

Le nouvel explorateur global de 2022 est le point d'entrée principal :
`/datafoot_app/mondial-2022/`. Il ne met en avant ni Mbappé ni la France par défaut.

- **Par match** (`/mondial-2022/`) : les **64 rencontres** de la Coupe du monde 2022, filtrables par pays, phase et texte. Chaque match affiche les profils individuels des deux équipes, sans courbe collective superposée (`/mondial-2022/matchs/<id>/`).
- **Par pays** (`/mondial-2022/pays/`) : les **32 sélections**, leur parcours match par match, et tous les joueurs observés (`/mondial-2022/pays/<slug>/`).
- **Par joueur** (`/mondial-2022/joueurs/`) : annuaire alphabétique de tous les participants recensés, avec recherche par nom/pays et une fiche par joueur (`/mondial-2022/joueurs/<id>/`).
- **Analyse détaillée** (`/mondial-2022/matchs/<id>/profil/?joueur=<player-id>`) : une seule page par match, sélecteur entre tous les joueurs, bascule activité / impact indicatif, points d'action sous l'axe X, moments clés, inspection minute par minute et journal filtrable. Les courbes individuelles ne superposent jamais le collectif.
- **Accès direct aux données** : `/data/worldcup-2022/index.json`, `/data/worldcup-2022/players.json` et `/data/worldcup-2022/matches/<id>.json` (préfixés de `/datafoot_app`).

### Provenance, génération et indicateurs

La génération reproductible est dans `scripts/build-worldcup-2022.mjs` (`npm run data:worldcup`). Elle télécharge les 64 fichiers événementiels et la liste des matchs **StatsBomb Open Data**, compétition `43`, saison `106`. Les données sont générées avant la compilation Astro dans GitHub Actions, puis mises en cache. Les fichiers détaillés produits dans `src/data/worldcup/2022` et leur version publique ne sont pas committés manuellement. Pour travailler en local après un clone neuf :

```bash
npm install
npm run data:worldcup
npm run test:worldcup
npm run test:pulse
npm run build
```

Pulse est un **indice éditorial** d'activité à deux mémoires (3 et 10 minutes), pas une mesure GPS, de course ou une note de performance. Chaque joueur commence à **50/100 à son entrée** sur le terrain (y compris les remplaçants). Chez les **joueurs de champ**, cette réserve initiale décroît avec une demi-vie de **25 minutes** en l'absence d'actions. Chez les **gardiens**, la valeur neutre de **50/100 reste constante** durant les périodes sans intervention : arrêts (dont penalties), ballons captés, sorties et dégagements aux poings créent des pics qui reviennent vers 50, et un but encaissé n'est pas automatiquement traité comme une faute. Les **moyennes collectives excluent les gardiens** pour ne pas inclure artificiellement ce niveau neutre. Les tentatives ratées comptent comme de l'activité mais entraînent un **malus très léger** (ex. passe incomplète −0,15, dribble raté −0,65 unité d'impulsion). Les courbes sont bornées de 0 à 100 et affichées avec un **dégradé thermique continu** du **blanc froid (0)** au **jaune (20–40)**, **orange (60)**, **rouge (75)**, puis **violet (90–100)**. La frise minute par minute utilise exactement la même couleur pour chaque valeur, sans modifier le calcul Pulse. L'Impact reste monochrome bleu et la comparaison des pays conserve ses deux couleurs d'équipe fixes. Survoler ou toucher une courbe affiche les actions de la minute dans un encart. La lecture « impact » est un indicateur heuristique : elle tient compte de la nature des actions, de la progression longitudinale des passes et des xG StatsBomb des tirs lorsque disponibles. Ce n'est **pas** un xT/VAEP validé. Les événements sont horodatés et les remplacements / cartons rouges interrompent le profil. Le résultat final de séance de tirs au but n'entre pas dans le graphique. La source StatsBomb/Hudl est explicitement indiquée dans l'interface.

Les anciens parcours centrés sur la France (`/equipes/france/`, `/joueurs/mbappe/`, `/matchs/coupe-du-monde-2022/...`) restent accessibles par compatibilité, mais ne sont plus le chemin principal.

## Explorateur des matchs — DataFoot Pulse V3 / France 2022

- `/equipes/france/` : sept profils collectifs autonomes, un par match. Chaque vue du collectif représente la moyenne des joueurs présents, **sans superposition** avec Mbappé.
- `/joueurs/mbappe/` et `/joueurs/<id>/` : courbes d'activité individuelles pour les matchs couverts, **sans moyenne de la France superposée**.
- `/matchs/coupe-du-monde-2022/<id>/` : tous les joueurs de la rencontre, avec courbes compactes et accès aux profils détaillés.
- `/matchs/coupe-du-monde-2022/<id>/profils/<player-id>/` : profil individuel détaillé avec bascule *Activité / Impact*, marqueurs sous l'axe X, accès direct aux pics / buts, lecture à la minute et journal filtrable. `/profils/france/` expose une vue collective autonome.

### Méthode (éditoriale, explicable)

Pulse remplace le cumul fixe « 50 points initiaux, -1/min, +5/passe, +45/but » **dans l'explorateur**. L'ancien prototype historique `/matchs/finale-2022/mbappe/` reste archivé en version V2.

Chaque action apporte deux poids définis par `pulseWeight` dans `src/lib/match-activity.mjs` : *activité* (présence dans le jeu) et *impact indicatif* (importance de l'action selon son type et son issue). Les deux indices sont calculés séparément avec une mémoire courte de **3 minutes** (65 %) et une longue de **10 minutes** (35 %), puis transformés par saturation exponentielle dans une échelle stable **0–100**. Les secondes des actions sont prises en compte, aucune action future n'influence une minute passée. Les périodes hors du terrain ne sont pas représentées.

L'impact **n'est pas** un xT, un VAEP ou une probabilité de but : le JSON compact de cette version ne contient pas la position/contextualisation spatiale indispensable à un tel modèle. Les poids sont des hypothèses éditoriales à valider. Le but apparaît comme marqueur ponctuel et n'ajoute pas automatiquement +45 à l'activité.

Les profils ne couvrent actuellement que les **7 matchs de la France au Mondial 2022**, pas la carrière de Mbappé. Données d'événements : StatsBomb Open Data / Hudl, tirs au but de séance finale exclus.

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

La page `/datafoot_app/matchs/finale-2022/messi/` montre Messi au centre des 10 partenaires avec lesquels il échange le plus de passes réussies pendant la finale de 2022. Les billes de couleurs propres aux joueurs matérialisent passes données et reçues, sans aucune ligne de liaison. Lecture, pause, accélération, filtre par partenaire, navigation temporelle et prise en charge du mouvement réduit.

Le fichier réel `src/data/matches/2022-final-messi-passes.json` est construit dans le dépôt privé `trexdbg/datafoot` par `python -m datafoot.messi_passes`, puis publié en double dans `public/data/matches`. Quand ce fichier est absent, l'interface affiche **un mode démonstration explicitement fictif**, sans faire passer des nombres simulés pour des statistiques réelles. Dès la publication, le navigateur charge les données réelles de StatsBomb automatiquement. Attribution StatsBomb et lien vers la source sur la page.

## Messi Pass Wars — réseau de passes multi-saisons

Page : `/datafoot_app/joueurs/messi/pass-wars/`. Elle exploite les **vraies passes réussies** issues du collecteur unifié `datafoot.messi_full_open_data` (StatsBomb Open Data), pour tous les matchs de Messi identifiés dans les données publiques à chaque exécution : ce n’est pas un bilan exhaustif de carrière. Jusqu’à 30 partenaires, uniquement ceux ayant **strictement plus de 95 passes** échangées dans la sélection (96 au minimum). Le top se recalcule avec les filtres équipe, saison, compétition : couleur par joueur, positions aléatoires à chaque chargement, stables pendant la lecture et sans chevauchement, ni ordre d'horloge ni traits, projectiles paintball, éclaboussures, Battle et classement. Aucune statistique simulée en cas de source absente : un message d’erreur explicite s’affiche.

Les fichiers `src/data/players/messi-pass-wars*.json` et `public/data/players/messi-pass-wars*.json` sont produits par le workflow hebdomadaire `datafoot/.github/workflows/pass-wars.yml`, qui peut aussi être lancé manuellement. Les événements raw StatsBomb ne sont pas copiés sur GitHub Pages : seul le JSON dérivé utile à l’animation est exposé. Credits StatsBomb/Hudl visibles.


### Pass Wars — paintball sans liens (interface)
Les traits de connexion et les sillages ont été supprimés : seuls les projectiles isolés, les éclaboussures persistantes et les nœuds sont dessinés. Chaque partenaire possède une couleur déterministe, attribuée une seule fois depuis le classement global des joueurs StatsBomb puis conservée pour les filtres et les tris. La même teinte est appliquée aux projectiles des deux sens, à la peinture, au contour du nœud et au classement. Les directions restent lisibles par le sens du déplacement et les compteurs ↗ (Messi donne) / ↙ (Messi reçoit). Le seuil de **plus de 95 passes échangées** (96 minimum) est recalculé pour chaque filtre.


### Aucune ligne dans les visualisations Messi

Les vues `/joueurs/messi/pass-wars/` et `/matchs/finale-2022/messi/` ne dessinent **aucun trait** : ni segments fixes entre joueurs, ni cercles de guidage, ni lignes de traînée, ni anneaux d'impact. Ne subsistent que les joueurs, des billes isolées en mouvement et des gouttes de peinture à l'arrivée. Les identités colorées des partenaires sont conservées. Le contrôle `tests/pass-wars.test.mjs` protège les deux vues contre le retour de traits.


### Messi Paintball V3 : portraits et noms usuels

Le module \`src/lib/messi-player-profiles.mjs\` normalise les noms d'affichage des joueurs par **identifiant StatsBomb** (ex. \`20131\` → **Xavi**, \`19757\` → **Deco**, \`25879\` → **Ronaldinho**) sans modifier les événements ni les noms bruts du JSON source. Les **11 partenaires** au-dessus du seuil de **95 passes** dans le jeu actuel, plus Messi, ont une photographie Wikimedia Commons attribuée à leur auteur et liée à sa licence. Les photos sont affichées dans les cercles Canvas et dans le classement. Sur échec de chargement, les initiales remplacent le portrait, sans cacher le joueur ni bloquer l'animation. Le panneau « Crédits photos » liste les auteurs, licences et fichiers. Si de nouveaux joueurs entrent dans le top à l'avenir, ils restent lisibles même sans portrait. Les coordonnées sont tirées avec une nouvelle graine à chaque chargement, indépendamment de l’ordre du classement, avec protection contre les collisions et exclusion du centre ; les portraits restent en place pendant la lecture.

### Frise mois / année directement sous Messi Paintball

Les deux pages Messi Paintball affichent désormais un indicateur **MM/AAAA** dans l'aire du graphique et un curseur mensuel immédiatement dessous, au-dessus de la légende. La piste parcourt les vrais mois du premier au dernier événement observé (2004–2022 sur l'échantillon courant). Le glissement recalcule les passes cumulées et les taches au dernier événement du mois choisi, y compris les mois sans match couvert. Pendant l'animation, chaque mois occupe désormais la même durée, même sans match, et les passes arrivent selon la vraie date des événements. Les graduations sont proportionnelles aux mois calendaires. L'encart MM/AAAA est placé hors du Canvas pour ne plus masquer un portrait. Lecture, pause et vitesse restent dans les commandes habituelles. La période affichée sur le tableau latéral passe aussi au format mois/année. Tests dans tests/pass-wars.test.mjs.


## StatsBomb Open Data : toutes les rencontres de Messi disponibles

La publication des quatre jeux dérivés est désormais assurée par le workflow
`trexdbg/datafoot/.github/workflows/pass-wars.yml`, en exploitant le
**catalogue complet des saisons publiques**, sans prélèvement arbitraire de
trois matchs par saison :

- `messi-pass-wars.json` : partenaires et agrégats ;
- `messi-pass-wars-events.json` : toutes les passes source identifiées ;
- `messi-encounters.json` : adversaires, tirs et buts dans les matchs ouverts ;
- `messi-open-data-coverage.json` : audit de la couverture réelle et des échecs.

Les JSON sont mis à jour **ensemble** et uniquement après vérification
des résultats. Le serveur public ne distribue pas les milliers de fichiers
bruts StatsBomb ; ceux-ci restent dans le cache du collecteur. Seuls les
événements dérivés et les métadonnées nécessaires à la visualisation sont
publiés. « Tous les matchs ouverts où Messi a été identifié » ne signifie
jamais « carrière complète ».


### Messi Pass Wars — animation fluide des dizaines de milliers de passes

Depuis la collecte des **602 rencontres Messi identifiées dans StatsBomb Open Data**
(62 259 passes échangées dans le jeu publié le 19 octobre 2026), le moteur
ne déclenche plus chaque événement du même match simultanément. L’axe
mois/année reste proportionnel au calendrier réel, et chaque passe est
**intégralement prise en compte** dans les compteurs, filtres, classements
et recherches de partenaires.

Pour préserver des mouvements lisibles à l’échelle de toute la période,
les billes sont un **échantillon de passes réelles**, lancé à cadence
régulière avec une file bornée. Le mode Battle accélère le débit,
sans produire de rafale après un retour d’onglet ou un changement de date.
Un joueur isolé ne reçoit que les animations de ses propres échanges.
Le jeu ne synthétise aucune fausse passe : seules les visualisations animées
sont échantillonnées, les totaux restent exhaustifs pour la couverture
StatsBomb téléchargée.

Les tests `tests/pass-wars.test.mjs` vérifient la sélection de véritables
événements, la file limitée, le filtrage joueur et la chronologie linéaire.
