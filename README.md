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

- **Administrateur** : crée et archive les congrès, importe les listes, gère les comptes et les mots de passe.
- **Agent desk** : consulte les événements, recherche les inscrits, confirme les arrivées, confirme les paiements et ajoute un participant au desk.
- Les mots de passe sont hachés côté serveur (PBKDF2); les sessions expirent après 12 heures. Chaque utilisateur peut changer son mot de passe; l’administrateur peut désactiver un compte ou réinitialiser le mot de passe d’un autre membre.
- Les mots de passe ne doivent pas être partagés. Au premier test dans l’aperçu, utilisez un mot de passe provisoire, pas votre mot de passe personnel.

## Import CSV ou Excel

Dans « Participants », choisissez « Importer CSV / Excel », puis votre fichier. Le CSV accepte les séparateurs virgule ou point-virgule. Pour Excel, utilisez un classeur `.xlsx` : l’application lit la première feuille. Les anciens fichiers `.xls` doivent être enregistrés en `.xlsx`.

Colonnes reconnues : nom complet (ou prénom + nom), e-mail, organisation/entreprise, catégorie, code badge, statut de présence et, en option, `Paiement` (Payé / Non payé / Exonéré), `Montant` et `Moyen de paiement`. Une cellule de paiement vide ne modifie pas un paiement déjà confirmé; renseigner une ligne l’écrase explicitement. Les doublons sont rapprochés par e-mail ou code badge. Modèle Excel : `public/modele-import-participants.xlsx`; l’application propose aussi les modèles CSV et Excel.

## Confirmation des paiements

Chaque congrès possède une devise (TND par défaut, modifiable dans ses paramètres). Depuis la liste des participants, la colonne **Paiement** (ou la fiche de l’inscrit) ouvre une fenêtre de confirmation :

- **Payé** : montant encaissé (3 décimales maximum), moyen de paiement (espèces, carte, virement, chèque, paiement mobile, autre) et référence/justificatif facultative.
- **Exonéré** : invité, intervenant ou membre dispensé de paiement; aucun montant n’est compté.
- **Non payé** : annule une confirmation précédente (montant et référence sont effacés).

Chaque confirmation est horodatée et enregistrée au nom de l’agent connecté; les autres postes reçoivent le changement en quelques secondes. En cas de coupure, la confirmation rejoint la file locale du navigateur puis est synchronisée automatiquement. Le desk peut toujours confirmer les arrivées : un avertissement rappelle simplement qu’un inscrit n’a pas de paiement confirmé, sans bloquer l’accueil.

Le tableau de bord affiche le nombre de paiements confirmés et le montant encaissé, l’onglet **Rapports** détaille les encaissements (statut, montant, moyen, référence, date, agent) et l’export CSV contient le détail du paiement pour chaque inscrit. Les paiements sont inclus dans la sauvegarde `.zip` exportée depuis **Comptes**.

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

Pour recréer une démo complète (2 comptes, 1 congrès, 8 inscrits avec paiements variés) :

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
- `01_events.csv`, `02_users.csv`, `03_participants.csv` (avec les paiements), `04_sync_operations.csv` — séparateur `;`, BOM UTF-8, ouvrables dans Excel ;
- `INSTRUCTIONS.txt`.

Les sessions ne sont jamais exportées et les mots de passe restent **hachés** (PBKDF2 + sel) : le fichier ne permet pas de les lire, mais il faut le garder dans un endroit privé.

**Restaurer une sauvegarde** : choisir le `.zip`, saisir **son propre mot de passe** pour confirmer, puis valider. Le serveur vérifie tout le fichier (format, manifeste, doublons, références, empreintes) **avant** d’écrire, puis remplace congrès, inscrits, paiements, comptes et historique en **une seule transaction** : au moindre problème, rien n’est modifié. Le compte qui restaure reste administrateur et conserve son mot de passe, les sessions des autres appareils sont fermées, et un seul compte administrateur suffit.

Limites : 50 Mo compressé, 150 Mo décompressé, 50 Mo par fichier, 50 entrées maximum. Un ZIP sur mesure ne sert à rien : seuls les fichiers et les colonnes du manifeste sont lus.

Render accepte des dépôts Git connectés et des images Docker préconstruites. Ne jamais publier le fichier `data/imagine_desk.sqlite3`; si GitHub est indisponible, utiliser un dépôt GitLab/Bitbucket autorisé ou une image de registre, sans mettre de données réelles dans l’image.

## Démo WSGI (Alwaysdata ou autre hébergeur WSGI)

`alwaysdata_wsgi.py` expose les routes existantes sous forme WSGI, sans lancer de serveur TCP. Guide de configuration : `ALWAYSDATA-DEMO.md`. L’offre gratuite Alwaysdata est annoncée pour un usage personnel et exclut les objectifs commerciaux; vérifier les conditions avant de l’utiliser pour Imagine Events. La démo doit rester avec des données fictives. Le fichier SQLite doit rester dans un dossier privé persistant du compte, jamais dans Git.

## À sécuriser avant un congrès réel

C’est un **prototype/MVP**, pas une garantie de disponibilité permanente. Les comptes sont présents, mais le dépôt ne fournit pas encore de sauvegardes distantes automatiques, de bascule haute disponibilité ni de procédure de reprise éprouvée. Avant d’importer de vraies données : héberger derrière HTTPS, sauvegarder la base, sécuriser les appareils partagés et tester le réseau ainsi que les imprimantes sur place. L’aperçu de démonstration n’est pas un hébergement permanent de production.
