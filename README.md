# Imagine Events — Desk d’accueil multi-congrès

Prototype web réutilisable pour gérer plusieurs congrès, importer des participants depuis CSV et Excel (.xlsx), confirmer les arrivées **et les paiements**, imprimer des badges et exporter les rapports. Il inclut maintenant des comptes d’accès pour l’équipe. L’interface utilise JavaScript natif; le serveur utilise Python, SQLite et `openpyxl`.

## Test local

1. Installez Python 3.10 ou plus récent.
2. Depuis ce dossier, installez la dépendance Excel et lancez le serveur :

   ```bash
   pip install -r requirements.txt
   python server.py
   ```

3. Ouvrez `http://localhost:8000`.
4. Au premier lancement, créez le compte administrateur avec un mot de passe unique d’au moins 12 caractères. Ensuite, ce compte peut créer les comptes des agents depuis **Comptes**.
5. Pour plusieurs appareils sur le même réseau, ouvrez **la même adresse du serveur** sur chaque poste, par exemple `http://192.168.1.20:8000`.

## Comptes et permissions

- **Administrateur** : crée, archive et supprime (corbeille 30 jours) les congrès, importe les listes, gère les comptes et les mots de passe.
- **Agent desk** : consulte les événements, recherche les inscrits, confirme les arrivées, confirme les paiements (et gère la grille tarifaire et les modèles de badge du congrès), ajoute un participant et le met à la corbeille.
- **Corbeille** : la suppression est ouverte à **tous les comptes** et reste réversible ; seul l’administrateur peut **effacer définitivement** (voir « Supprimer ou restaurer un inscrit »).
- Les mots de passe sont hachés côté serveur (PBKDF2); les sessions expirent après 12 heures. Chaque utilisateur peut changer son mot de passe; l’administrateur peut désactiver un compte ou réinitialiser le mot de passe d’un autre membre.
- Les mots de passe ne doivent pas être partagés. Au premier test dans l’aperçu, utilisez un mot de passe provisoire, pas votre mot de passe personnel.

## Supprimer ou restaurer un inscrit (corbeille)

**Tout le monde** (administrateur et agent desk) peut retirer un inscrit, mais rien n’est jamais
détruit immédiatement : l’inscrit part dans la **corbeille** du congrès.

- **Un inscrit à la fois** : icône corbeille sur sa ligne (ou bouton **Corbeille** dans sa fiche).
- **Plusieurs à la fois** : cochez les cases de la colonne de gauche (la case d’en-tête sélectionne
  tout ce qui est affiché, filtres et recherche compris), puis **Mettre à la corbeille**.
- Une fenêtre récapitule les noms concernés avant de valider.

Un inscrit supprimé disparaît **partout** : liste, filtres et compteurs, tableau de bord, rapports,
page Badges et impression, export CSV, totaux du congrès. Son **code badge reste réservé** pendant
qu’il est dans la corbeille, pour qu’une restauration soit toujours possible.

**Onglet Participants → Corbeille** (le compteur rouge indique le nombre d’inscrits) :

- **Restaurer** (tous les comptes) : l’inscrit revient exactement comme avant, avec son arrivée et son
  paiement. Réimporter une ligne dont l’e-mail ou le code correspond à un inscrit de la corbeille le
  restaure aussi.
- **Effacer définitivement** / **Vider la corbeille** (administrateur uniquement, case de confirmation
  obligatoire) : la suppression devient irréversible.

Points à connaître :

- un congrès **archivé** refuse suppression et restauration : réactivez-le d’abord ;
- les actions sont tracées (qui, quand) et la sauvegarde ZIP conserve la corbeille
  (`deleted_at` / `deleted_by` dans `03_participants.csv`) : restaurer une sauvegarde restitue aussi
  les inscrits supprimés ;
- la suppression demande une connexion au serveur (contrairement au check-in et au paiement, qui
  fonctionnent hors ligne) ;
- les sauvegardes antérieures à la version 5 restent valides : leurs inscrits sont simplement tous
  considérés comme actifs.

## Supprimer ou restaurer un congrès (corbeille, 30 jours)

Un congrès qui n’a plus lieu d’être ne se détruit pas d’un coup : il part dans la
**corbeille des congrès** et reste restaurable **30 jours**.

- **Mettre à la corbeille** : *Mes congrès* → icône ⚙ du congrès → **Mettre le
  congrès à la corbeille** (ou *Paramètres* depuis le desk). L’administrateur seul
  peut le faire, et une fenêtre rappelle le nombre d’inscrits, d’arrivées et le
  montant encaissé avant de valider.
- Effet immédiat : le congrès disparaît de la liste, du sélecteur du haut, des
  badges, des rapports et des exports. Le desk ne le sert plus (l’API renvoie
  « Événement introuvable ») et les postes encore ouverts basculent sur un autre
  congrès.
- **Restaurer** (tous les comptes) : le congrès revient **exactement comme avant** —
  inscrits (corbeille comprise), arrivées, paiements, grille tarifaire et modèles
  de badge.
- **Effacer définitivement** (administrateur uniquement, case de confirmation
  obligatoire) : suppression immédiate et irréversible du congrès **et de toutes
  ses données** (inscrits, arrivées, paiements, tarifs, modèles de badge,
  historique de synchronisation).

La corbeille est visible en bas de la page **Mes congrès**, avec le nombre de jours
restants pour chaque congrès. À l’échéance des 30 jours, l’effacement est
automatique : le nettoyage est vérifié au démarrage du serveur puis à chaque
consultation de la liste des congrès (aucune tâche de fond à installer).

Points à connaître :

- un congrès **archivé** peut être mis à la corbeille — l’archivage et la
  suppression sont deux choses différentes (l’archivage ferme le desk, la
  corbeille retire le congrès) ;
- les données locales du navigateur de ce congrès (liste, file d’attente,
  tarifs, modèles) sont effacées au moment de la suppression ; une restauration
  les recharge depuis le serveur ;
- les actions de check-in en attente sur un poste ne peuvent pas être synchronisées
  vers un congrès en corbeille ;
- la sauvegarde ZIP conserve la corbeille des congrès (`deleted_at` / `deleted_by`
  dans `01_events.csv`, format v6) : restaurer une sauvegarde restitue aussi les
  congrès supprimés, avec leur compte à rebours ;
- les sauvegardes v5 et antérieures restent valides : leurs congrès sont
  simplement tous considérés comme actifs.

## Import CSV ou Excel

Dans « Participants », choisissez « Importer CSV / Excel », puis votre fichier. Le CSV accepte les séparateurs virgule ou point-virgule. Pour Excel, utilisez un classeur `.xlsx` : l’application lit la première feuille. Les anciens fichiers `.xls` doivent être enregistrés en `.xlsx`.

Colonnes reconnues : nom complet (ou prénom + nom), e-mail, organisation/entreprise, catégorie, code badge, statut de présence et, en option, `Paiement` (Payé / Non payé / Exonéré), `Montant` et `Moyen de paiement`. Une cellule de paiement vide ne modifie pas un paiement déjà confirmé; renseigner une ligne l’écrase explicitement. Les doublons sont rapprochés par e-mail ou code badge. Modèle Excel : `public/modele-import-participants.xlsx`; l’application propose aussi les modèles CSV et Excel.

## Grille tarifaire par congrès

Chaque congrès a sa propre grille, avec **autant de lignes que nécessaire** et **plusieurs tarifs
par catégorie** — indispensable quand l’hébergement diffère d’un inscrit à l’autre :

| Libellé | Catégorie | Montant |
|---|---|---|
| Participant — 2 nuits d’hôtel | Participant | 450 |
| Participant — 1 nuit d’hôtel | Participant | 300 |
| Participant — sans hébergement | Participant | 150 |
| Étudiant — sans hébergement | Participant | 80 |
| Intervenant | Intervenant | 0 |

**Paramètres du congrès → Grille tarifaire** : ajouter une ligne, retirer, réordonner, activer ou
désactiver un tarif (un tarif désactivé n’apparaît plus au desk mais reste dans l’historique). Le bouton
*Modèle hébergement* crée les trois lignes « 2 nuits / 1 nuit / sans hébergement » à compléter. La
grille est enregistrée sur le serveur, puis mise en cache sur chaque poste : elle reste disponible
hors ligne. **Tous les comptes** (administrateur et agent desk) peuvent la consulter et la modifier.

Au moment du paiement, les tarifs actifs apparaissent en **gros boutons** (ceux de la catégorie de
l’inscrit d’abord) : un appui choisit le tarif, remplit le montant et passe le statut à « Payé ». Le
moyen de paiement et la référence restent modifiables, et la saisie d’un montant libre demeure
possible.

**Modifier la grille ne change jamais les montants déjà encaissés** : chaque paiement conserve son
montant et le libellé du tarif appliqué (visible dans la fiche de l’inscrit, le rapport et l’export
CSV). L’onglet **Rapports** ajoute une ventilation *Encaissements par tarif* et signale les tarifs
actifs encore inutilisés. La grille est incluse dans la sauvegarde `.zip` (`05_event_prices.csv`) et
restaurée avec le reste ; les anciennes sauvegardes, qui n’en contiennent pas, restent valides.

## Modèles de badge, QR code et impression

Chaque congrès a **ses propres modèles de badge**. Le *modèle de test* est fourni d’origine (90 × 60 mm,
nom, organisation, catégorie, congrès, référence et QR code) et reste disponible en permanence : on y
ajoute ses modèles importés sans le supprimer.

**Onglet Badges → Modèles de badge** ouvre l’atelier :

1. **Format libre** : largeur et hauteur en millimètres (30 à 300 mm), par exemple 90 × 60, 100 × 70,
   105 × 74 (A7) ou 148 × 105 (A6), y compris les dos de badge au format carte.
2. **Fond importé** : PNG, JPEG, WebP ou SVG, redimensionné automatiquement dans le navigateur
   (plafond 1,8 Mo côté serveur). Le visuel peut être le recto **et** le verso.
3. **Placement à la souris** : glissez chaque bloc (nom, organisation, catégorie, congrès, référence,
   QR code, texte libre) sur le visuel. Le déplacement suit le curseur image par image, sans
   reconstruction de l’aperçu, et une pastille affiche la position en millimètres. Maintenez **Maj**
   pour un pas de 1 % ou utilisez les **flèches du clavier** (Maj + flèche = 2 %) pour un ajustement
   fin. Cliquez sur un bloc pour régler taille (mm), largeur, graisse, couleur, alignement et
   majuscules. L’aperçu est au même rendu que l’impression (unités relatives au badge).
4. **QR code** : généré dans le navigateur, sans internet ni service externe. Deux contenus possibles :
   - **la référence du badge** (`IE-0101`), lue par un lecteur USB ou une application de scan ;
   - **un lien vers le site** : `…/p/CODE`, où `CODE` est la référence. Le serveur redirige
     `/p/CODE` vers `/?badge=CODE` et le desk ouvre directement la fiche de l’inscrit.
     L’adresse peut être remplacée (par exemple `https://mon-domaine.tn/p/`) ou contenir `{code}`.
5. **Recto-verso** : une face verso vide signifie « recto seulement » ; sinon l’impression propose
   d’imprimer le verso au dos.

**Enregistrement** : `Modèles de badge → Enregistrer les modèles` (12 modèles maximum par congrès,
noms uniques). Le modèle coché « par défaut » est celui utilisé pour les aperçus et l’impression du
congrès. **Tous les comptes** peuvent modifier les modèles ; un congrès archivé doit être réactivé
d’abord. Les modèles sont mis en cache sur chaque poste pour rester disponibles hors ligne.

### Imprimer sur une feuille A4, même déjà entamée

`Imprimer` (un badge) ou `Imprimer N badges` (la sélection) ouvre la fenêtre d’impression :

- **Planche A4** : plusieurs badges par feuille. Les marges (haut, gauche, droite, bas), les écarts
  horizontal/vertical et un décalage fin (0,5 mm) permettent d’aligner la planche sur le papier.
- **Première case libre** : la grille affichée est la feuille A4 réelle ; cliquez sur la première case
  encore libre. L’impression démarre à cette case et **n’utilise pas le papier déjà imprimé**
  (cas d’une feuille dont un badge a été découpé en haut à droite).
- **Repères de coupe** : cochez pour ajouter des repères fins aux quatre angles.
- **Un badge par page** : page au format exact du badge (par exemple 90 × 60 mm).
- **Recto-verso** : le verso est retourné (miroir horizontal) pour rester aligné après passage de la
  feuille. Vérifiez ce réglage sur une feuille de brouillon.

Dans la fenêtre du navigateur : **marges « Aucune »**, **échelle 100 %** et, si le visuel importé est
un fond de couleur, **« Graphiques d’arrière-plan »**. Les images importées s’impriment dans tous les
cas. L’aperçu initial peut donc sembler décalé si une marge par défaut est encore appliquée.

Les modèles sont inclus dans la sauvegarde `.zip` (`06_badge_templates.csv`) et restaurés avec le
reste ; les sauvegardes plus anciennes, qui n’en contiennent pas, restent valides (le modèle de test
est alors proposé).

## Confirmation des paiements

Chaque congrès possède une devise (TND par défaut, modifiable dans ses paramètres). Depuis la liste des participants, la colonne **Paiement** (ou la fiche de l’inscrit) ouvre une fenêtre de confirmation :

- **Payé** : montant encaissé (3 décimales maximum), moyen de paiement (espèces, carte, virement, chèque, paiement mobile, autre) et référence/justificatif facultative.
- **Exonéré** : invité, intervenant ou membre dispensé de paiement; aucun montant n’est compté.
- **Non payé** : annule une confirmation précédente (montant et référence sont effacés).

Chaque confirmation est horodatée et enregistrée au nom de l’agent connecté; les autres postes reçoivent le changement en quelques secondes. En cas de coupure, la confirmation rejoint la file locale du navigateur puis est synchronisée automatiquement. Le desk peut toujours confirmer les arrivées : un avertissement rappelle simplement qu’un inscrit n’a pas de paiement confirmé, sans bloquer l’accueil.

Le tableau de bord affiche le nombre de paiements confirmés et le montant encaissé, l’onglet **Rapports** détaille les encaissements (statut, montant, tarif, moyen, référence, date, agent) et l’export CSV contient le détail du paiement pour chaque inscrit. Les paiements sont inclus dans la sauvegarde `.zip` exportée depuis **Comptes**.

## Plusieurs postes et mode de secours

Les événements et les inscrits sont enregistrés séparément dans la base (PostgreSQL, ou `data/imagine_desk.sqlite3` en local). Les postes connectés au même serveur reçoivent les check-ins des autres desks en quelques secondes. Chaque navigateur conserve aussi un cache local; les check-ins, les confirmations de paiement et les ajouts individuels faits pendant une coupure sont mis en file, puis synchronisés au retour de la connexion. Pour le secours hors ligne, ouvrez d’abord l’application et chargez la liste sur chaque appareil, puis gardez l’onglet ouvert. L’import de fichiers CSV/Excel nécessite une connexion au serveur. Le cache local contient des données de participants : utilisez des appareils de confiance et déconnectez-vous en fin de service (la file en attente est conservée jusqu’à sa synchronisation).

## Base de données : SQLite ou PostgreSQL

L’application fonctionne avec **SQLite par défaut** (zéro installation) et bascule **automatiquement sur PostgreSQL dès que la variable `DATABASE_URL` est définie** — c’est le cas sur Render, OVH, Neon, etc. Les tables sont créées au premier démarrage; aucun script de migration n’est à lancer.

| Variable | Effet |
|---|---|
| `DATABASE_URL` | `postgresql://…` → stockage PostgreSQL durable (prioritaire) |
| `IMAGINE_DB_PATH` | chemin du fichier SQLite si `DATABASE_URL` est absent (défaut : `data/imagine_desk.sqlite3`) |
| `PORT` / `HOST` | écoute du serveur (`0.0.0.0` par défaut) |
| `COOKIE_SECURE=1` | cookie de session limité à HTTPS (hébergement) |
| `IMAGINE_SETUP_TOKEN` | code exigé pour créer le premier administrateur |
| `IMAGINE_DB_EXPIRES_AT` | date d’échéance de la base (`AAAA-MM-JJ`) : l’application alerte 7 jours avant (base Render gratuite) |

Le moteur réellement utilisé est visible sur `/api/health` (`"storage":"postgres"` ou `"sqlite"`) et dans **Comptes → Où sont mes données**. La sauvegarde depuis **Comptes** produit un fichier `.zip` identique dans les deux moteurs, restaurable depuis le navigateur (voir « Sauvegarder et restaurer » plus bas). Guide Render détaillé : `RENDER-DEMO.md`.

## Charte graphique

L’interface suit la charte **Imagine Events** (celle du site `i-maginevents.com` et de l’application
`imagine-inventory`) :

| Élément | Valeur |
|---|---|
| Bleu profond | `#0B1D3A` (navigation, titres, boutons principaux) |
| Bleu institutionnel | `#13294B` / `#1E4D8C` (dégradés, liens, états actifs) |
| Rouge de marque | `#C41E3A` (accent, action « Nouveau congrès », repère de navigation) |
| Fonds | `#F4F7FB` (page) et `#FFFFFF` (cartes) |
| Titres | **Plus Jakarta Sans** (linéale) — titres de page, cartes, chiffres clés |
| Texte | **Inter** — corps en 17 px, tableaux en 16,5 px, plus petite taille 12 px |
| Polices | chargées depuis Google Fonts avec repli système (`Segoe UI`, `system-ui`) |

Le logo officiel est dans `public/img/logo.png` (fond transparent) et `logo-chip.png`.
Les polices sont chargées depuis Google Fonts ; hors ligne, l’application retombe sur les polices
système sans perdre en lisibilité. Toutes les couleurs et polices sont centralisées dans le bloc
`CHARTE IMAGINE EVENTS` en fin de `public/styles.css` : modifier ce bloc suffit à rethémer l’app.

## Où sont enregistrées les données

Tout (comptes, congrès, inscrits, arrivées, paiements) est enregistré dans une **base unique** :

- **PostgreSQL** quand `DATABASE_URL` est défini (mode hébergement recommandé — voir la section précédente) ;
- sinon **SQLite** dans `data/imagine_desk.sqlite3`.

Le serveur crée ce dossier et ce fichier automatiquement au premier lancement; le chemin exact s’affiche au démarrage et, pour l’administrateur, dans **Comptes → Où sont mes données**. Une variable `IMAGINE_DB_PATH` permet de pointer ailleurs.

**Actualiser la page ne supprime rien** : les participants reviennent depuis la base. En revanche, les données disparaissent si la base est écrite dans un **dossier temporaire** (par exemple `/tmp`), car ce dossier est vidé à chaque redémarrage du serveur ou redéploiement de l’hébergeur. Le serveur affiche alors un avertissement au démarrage et l’administrateur voit un bandeau orange dans **Comptes**. Pour cette raison :

- en local et dans l’aperçu, gardez le chemin par défaut `data/imagine_desk.sqlite3` (dossier du projet, non versionné : voir `.gitignore`);
- sur un hébergement, connectez une **base PostgreSQL** (`DATABASE_URL`) — c’est la solution la plus simple et la plus fiable sur Render; à défaut, montez un disque persistant et renseignez `IMAGINE_DB_PATH=/chemin/persistant/imagine_desk.sqlite3`;
- ne versionnez jamais le fichier `.sqlite3` : il contient des données de participants et les empreintes des mots de passe. Les fichiers `data/`, `*.sqlite3`, `*-wal` et `*-shm` sont ignorés par Git.

Le navigateur conserve aussi un cache local de la liste pour le mode hors ligne. Si vous videz les données du site (« vider le cache »), il suffit de vous reconnecter pour recharger la liste depuis la base.

### Jeu de données de démonstration

Pour recréer une démo complète (2 comptes, 1 congrès actif de 8 inscrits avec paiements variés, plus 1 congrès dans la corbeille depuis 4 jours pour illustrer la restauration sur 30 jours) :

```bash
python scripts/demo_seed.py           # crée les données manquantes
python scripts/demo_seed.py --reset   # repart d’une base de démo neuve
```

Comptes créés : `demo.accueil` / `DemoAccueil2026!` (admin) et `desk.accueil` / `DemoDesk2026!` (agent). Ces données sont fictives : ne les remplacez pas par de vraies listes dans une démo publique.

## Déploiement Render

Le projet contient un `Dockerfile` et un `render.yaml` (Blueprint) pour Render. Le fichier crée une **base PostgreSQL `imagine-events-db`** et la relie au service via `DATABASE_URL` : les congrès, inscrits et paiements y sont conservés et survivent aux redéploiements. Instructions détaillées : `RENDER-DEMO.md`.

Attention aux offres gratuites : la base PostgreSQL gratuite de Render **expire** (de l’ordre de 30 jours) et est supprimée ensuite; le web service gratuit s’endort après inactivité. Pour un vrai congrès, prévoir les offres payantes correspondantes et exporter une sauvegarde `.zip` avant chaque événement (procédure de rotation complète dans `RENDER-DEMO.md`). Sans `DATABASE_URL`, l’application retombe sur SQLite dans le conteneur : les données sont alors perdues à chaque redémarrage, et l’interface le signale explicitement.

## Sauvegarder et restaurer la base (ZIP, depuis le navigateur)

Tout se fait dans **Comptes** (Admin), sans `psql` ni outil en ligne de commande — en PostgreSQL comme en SQLite.

**Exporter la sauvegarde** télécharge `imagine-events-sauvegarde-AAAAMMJJ-HHMM.zip` :

- `manifest.json` (format, version, moteur, date, nombre de lignes) ;
- `01_events.csv` (avec la corbeille des congrès), `02_users.csv`, `03_participants.csv` (avec les paiements et la corbeille des inscrits), `04_sync_operations.csv`, `05_event_prices.csv` (grilles tarifaires), `06_badge_templates.csv` (modèles de badge, fonds et placements) — séparateur `;`, BOM UTF-8, ouvrables dans Excel ;
- `INSTRUCTIONS.txt`.

Les sessions ne sont jamais exportées et les mots de passe restent **hachés** (PBKDF2 + sel) : le fichier ne permet pas de les lire, mais il faut le garder dans un endroit privé.

**Restaurer une sauvegarde** : choisir le `.zip`, saisir **son propre mot de passe** pour confirmer, puis valider. Le serveur vérifie tout le fichier (format, manifeste, doublons, références, empreintes) **avant** d’écrire, puis remplace congrès, inscrits, paiements, comptes et historique en **une seule transaction** : au moindre problème, rien n’est modifié. Le compte qui restaure reste administrateur et conserve son mot de passe, les sessions des autres appareils sont fermées, et un seul compte administrateur suffit.

Limites : 50 Mo compressé, 150 Mo décompressé, 50 Mo par fichier, 50 entrées maximum. Un ZIP sur mesure ne sert à rien : seuls les fichiers et les colonnes du manifeste sont lus.

Render accepte des dépôts Git connectés et des images Docker préconstruites. Ne jamais publier le fichier `data/imagine_desk.sqlite3`; si GitHub est indisponible, utiliser un dépôt GitLab/Bitbucket autorisé ou une image de registre, sans mettre de données réelles dans l’image.

## Démo WSGI (Alwaysdata ou autre hébergeur WSGI)

`alwaysdata_wsgi.py` expose les routes existantes sous forme WSGI, sans lancer de serveur TCP. Guide de configuration : `ALWAYSDATA-DEMO.md`. L’offre gratuite Alwaysdata est annoncée pour un usage personnel et exclut les objectifs commerciaux; vérifier les conditions avant de l’utiliser pour Imagine Events. La démo doit rester avec des données fictives. Le fichier SQLite doit rester dans un dossier privé persistant du compte, jamais dans Git.

## À sécuriser avant un congrès réel

C’est un **prototype/MVP**, pas une garantie de disponibilité permanente. Les comptes sont présents, mais le dépôt ne fournit pas encore de sauvegardes distantes automatiques, de bascule haute disponibilité ni de procédure de reprise éprouvée. Avant d’importer de vraies données : héberger derrière HTTPS, sauvegarder la base, sécuriser les appareils partagés et tester le réseau ainsi que les imprimantes sur place. L’aperçu de démonstration n’est pas un hébergement permanent de production.
