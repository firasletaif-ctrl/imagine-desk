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

## Sauvegarde et restauration

**Comptes → Sauvegarde de la base → Exporter la base** produit :

- en **PostgreSQL** : un fichier `.sql` (congrès, inscrits, paiements, historique de synchronisation et comptes — les sessions sont exclues, les mots de passe restent hachés) ;
- en **SQLite** : un fichier `.sqlite3`.

Réimport PostgreSQL, au choix :

```bash
psql "$DATABASE_URL" -f imagine-events-backup-AAAAMMJJ-HHMMSS.sql
```

ou *Restore* depuis la page de la base dans Render (selon l’offre). L’import d’un fichier `.sqlite3` depuis l’interface est réservé au stockage SQLite et affiche un message explicite en PostgreSQL.

## Reprendre des données déjà saisies en SQLite

La base SQLite locale n’est **pas** convertible automatiquement en PostgreSQL. Le plus simple, congrès par congrès :

1. sur l’ancienne version, **Rapports → Exporter CSV** ;
2. sur la version PostgreSQL, **Participants → Importer CSV / Excel** et choisir ce fichier ;
3. vérifier les colonnes *Paiement*, *Montant* et *Moyen de paiement* dans la liste, puis recréer les comptes de l’équipe dans **Comptes**.

Limites connues de ce transfert : l’heure d’arrivée et la référence de paiement ne sont pas reprises par l’import (le statut, le montant et le moyen le sont).

## Mode démo sans base (offerte)

Sans `DATABASE_URL`, le service retombe sur SQLite (chemin `IMAGINE_DB_PATH`). Sur Render, le disque du conteneur est éphémère : la base peut disparaître à un redémarrage, une mise en veille ou un redéploiement. **Ne pas y importer de vraies listes.** Le serveur affiche un avertissement au démarrage et l’administrateur voit un bandeau orange dans **Comptes**.
