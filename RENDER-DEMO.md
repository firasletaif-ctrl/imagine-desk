# Déployer l’aperçu sur Render

Deux modes possibles, selon l’objectif :

| Objectif | Base | Durable ? |
|---|---|---|
| **Démo publique** (offerte) | SQLite dans le conteneur | ❌ non : perdue à chaque redémarrage / redéploiement |
| **Vrai congrès** | **PostgreSQL Render** (`DATABASE_URL`) | ✅ oui : survit aux redéploiements et aux mises en veille |

## Pré-requis du dépôt

Le dépôt connecté à Render doit contenir `render.yaml`, le `Dockerfile`, `server.py`, `requirements.txt`, `alwaysdata_wsgi.py` et le dossier `public/`. Utiliser une archive propre, sans `data/imagine_desk.sqlite3` (ignoré par `.gitignore`).

## Mode recommandé : PostgreSQL Render

L’application utilise **automatiquement PostgreSQL dès que la variable `DATABASE_URL` existe** : les tables sont créées au premier démarrage, et rien d’autre n’est à installer côté serveur (`psycopg2-binary` est dans `requirements.txt`).

### Étapes dans le tableau de bord

1. **Créer la base** : *New* → *Postgres* → nom `imagine-events-db`, région identique au web service, plan souhaité.
2. **Connecter le web service** : ouvrir le service → onglet *Environment* → vérifier que `DATABASE_URL` référence la base (propriété *Internal Database URL*). C’est ce que fait automatiquement le `render.yaml` (`fromDatabase`).
3. **Redéployer** (*Manual Deploy* → *Deploy latest commit*). Au démarrage, les journaux doivent afficher :
   ```
   Base PostgreSQL : postgresql://imagine:***@dpg-…/imagine_events
   ```
   et `/api/health` doit répondre `"storage":"postgres"`.
4. **Créer le premier administrateur** sur l’URL `onrender.com`. Si `IMAGINE_SETUP_TOKEN` est défini, saisir ce code.
5. Vérifier dans **Comptes → Où sont mes données** : le panneau doit indiquer *PostgreSQL (DATABASE_URL)* et *Base PostgreSQL connectée*.

> Le premier écran de configuration apparaît parce que la base PostgreSQL est vide. Ce n’est pas une perte de données : SQLite et PostgreSQL sont deux bases distinctes.

### Bon à savoir

- **Offre gratuite Render** : les bases PostgreSQL gratuites **expirent** (ordre de grandeur : 30 jours) et sont alors supprimées. Pour un vrai congrès, prévoir une base payante et exporter une sauvegarde avant chaque événement.
- **Une seule instance** suffit : PostgreSQL gère plusieurs connexions simultanées, contrairement au fichier SQLite.
- **Mise en veille** : le service gratuit s’endort après inactivité ; la première requête suivante est plus lente, mais les données restent dans PostgreSQL.
- **HTTPS** : garder `COOKIE_SECURE=1` (déjà dans `render.yaml`) pour que le cookie de session exige HTTPS.

## Sauvegarde et restauration (depuis le navigateur)

Tout se fait dans l’application : **aucun `psql`**, aucune ligne de commande, aucun outil externe.

**Exporter** — *Comptes → Sauvegarde et restauration → **Exporter la sauvegarde*** télécharge
`imagine-events-sauvegarde-AAAAMMJJ-HHMM.zip`, **identique en PostgreSQL et en SQLite** :

- `manifest.json` (format, version, moteur, date, nombre de lignes) ;
- `01_events.csv`, `02_users.csv`, `03_participants.csv` (paiements inclus), `04_sync_operations.csv` ;
- `INSTRUCTIONS.txt`.

Les sessions ne sont pas exportées ; les mots de passe restent hachés (PBKDF2 + sel).

**Restaurer** — *Comptes → **Restaurer une sauvegarde*** : choisir le `.zip`, saisir **son propre mot
de passe**, confirmer. Le serveur contrôle tout le fichier (manifeste, doublons, références, empreintes)
puis remplace les données en **une seule transaction** : en cas d’erreur, rien n’est modifié. Le compte
qui restaure reste administrateur avec le même mot de passe, et les sessions des autres appareils sont
fermées. Le panneau *Où sont mes données* affiche la date de la dernière sauvegarde exportée.

## Rotation mensuelle de la base gratuite (30 jours)

La base PostgreSQL gratuite de Render expire après ~30 jours, et **une seule base gratuite** est
autorisée par espace de travail : il faut donc supprimer l’ancienne avant de créer la nouvelle. Le ZIP
permet de tout emporter puis de tout remettre, en quelques minutes, sans rien saisir à la main.

1. **Avant l’échéance : exporter.** Ouvrir l’application → *Comptes* → **Exporter la sauvegarde**.
   Vérifier que le `.zip` est bien téléchargé (l’ouvrir : `manifest.json` + 4 CSV) et le conserver hors
   de Render, dans un endroit privé.
2. **Supprimer l’ancienne base** : Render → *Dashboard* → base `imagine-events-db` → *Delete*.
   (Ne le faire qu’après l’étape 1.)
3. **Créer la nouvelle base** : *New → Postgres*, **même région**, plan **Free**. Attendre l’état *Available*.
4. **Recopier l’URL** : base → *Connect* → **Internal Database URL**. Dans le web service →
   *Environment* → remplacer la valeur de `DATABASE_URL` → *Save* (le service redéploie).
5. **Ouvrir l’application** : l’écran de premier démarrage apparaît (base vide) → créer l’administrateur
   (`IMAGINE_SETUP_TOKEN` si défini). `/api/health` doit afficher `"storage":"postgres"`.
6. **Restaurer** : *Comptes* → **Restaurer une sauvegarde** → choisir le `.zip` → mot de passe → confirmer.
   Vérifier le message (nombre de congrès, d’inscrits et de comptes) puis la liste des inscrits.
7. **Noter la nouvelle échéance** : définir `IMAGINE_DB_EXPIRES_AT=AAAA-MM-JJ` (date de création + 30 jours)
   dans *Environment* pour que l’application alerte 7 jours avant. Refaire l’étape 1 avant l’expiration suivante.

> **Variante sans suppression** : une base **Neon** gratuite n’expire pas. Coller son URL de connexion
> dans `DATABASE_URL`, redéployer, puis restaurer le même `.zip` depuis *Comptes* : la procédure est identique.

## Reprendre des données déjà saisies en SQLite

Inutile désormais de ressaisir quoi que ce soit : **le ZIP est le même dans les deux moteurs**.

1. Sur l’ancienne installation SQLite, *Comptes* → **Exporter la sauvegarde** (fichier `.zip`).
2. Sur la nouvelle installation PostgreSQL, *Comptes* → **Restaurer une sauvegarde** → ce `.zip` → mot de passe.

Congrès, inscrits, arrivées, paiements (statut, montant, moyen, référence, date, agent), comptes et
historique de synchronisation sont repris. Seules les sessions sont ignorées : chacun se reconnecte
avec son mot de passe habituel.

## Mode démo sans base (offerte)

Sans `DATABASE_URL`, le service retombe sur SQLite (chemin `IMAGINE_DB_PATH`). Sur Render, le disque du conteneur est éphémère : la base peut disparaître à un redémarrage, une mise en veille ou un redéploiement. **Ne pas y importer de vraies listes.** Le serveur affiche un avertissement au démarrage et l’administrateur voit un bandeau orange dans **Comptes**.
