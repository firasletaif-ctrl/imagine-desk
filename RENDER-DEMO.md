# Déployer l’aperçu sur Render (offre gratuite)

Cette configuration sert à une **démo seulement**. La base SQLite est volontairement dans le système de fichiers temporaire du service; les comptes, congrès et participants peuvent disparaître à un redémarrage, une mise en veille ou un redéploiement. Ne pas y importer de vraies listes.

## Pré-requis du dépôt

Le dépôt connecté à Render doit contenir `render.yaml`, le `Dockerfile`, `server.py`, `requirements.txt` et le dossier `public/`. Utiliser une archive propre, sans `data/imagine_desk.sqlite3`. Si GitHub reste inaccessible, Render accepte également un dépôt GitLab ou Bitbucket.

## Étapes Render

1. Dans Render, créer un **Blueprint** depuis le dépôt (ou un Web Service utilisant le `Dockerfile` à la racine).
2. Au premier déploiement, saisir une valeur aléatoire et longue pour `IMAGINE_SETUP_TOKEN` dans le tableau de bord Render. Ne pas l’ajouter au dépôt ni la partager dans le chat.
3. Laisser Render construire l’application et attendre que le health check `/api/health` passe.
4. Ouvrir l’URL `onrender.com` générée, saisir le même code de configuration, puis créer un compte administrateur avec un mot de passe provisoire unique.
5. Pour que la démo reste active, envoyer une requête périodique est possible, mais cela ne rend pas le stockage persistant; les services gratuits peuvent redémarrer et s’endorment après une période sans trafic.

Le `render.yaml` configure le plan gratuit, le health check, HTTPS pour le cookie et `IMAGINE_DB_PATH=/tmp/imagine_desk.sqlite3`. Aucune base n’est incluse dans le dépôt.

## Exporter et restaurer la base

Dans l’application, connectez-vous comme Admin, ouvrez **Comptes**, puis utilisez **Exporter la base**. Le navigateur télécharge un fichier `.sqlite3`; enregistrez-le régulièrement sur un appareil sûr, en dehors de Render. Render Free n’offre pas de stockage persistant : le bouton ne fait pas de sauvegarde automatique et ne peut pas récupérer des données déjà perdues lors d’un redémarrage.

Pour restaurer, déployez l’application, créez d’abord un Admin sur la base vide, ouvrez **Comptes > Importer une base**, puis choisissez le fichier exporté ou l’ancienne base SQLite (`.sqlite3`, `.sqlite` ou `.db`, limite 50 Mo). L’import remplace les congrès, participants et historique de synchronisation présents sur le serveur. Les comptes actuellement présents sont conservés; les anciens comptes de l’archive sont ajoutés si leurs identifiants ne font pas conflit. Les sessions ne sont jamais reprises. Avant l’import, exportez la base actuelle, synchronisez les postes et fermez les desks. Le fichier exporté contient les empreintes de mots de passe : protégez-le comme une donnée sensible.

## Pour une version durable

Render Free ne permet pas d’attacher un disque persistant. Une mise en production sur Render nécessite un service payant avec disque monté, par exemple `/var/data`, et `IMAGINE_DB_PATH=/var/data/imagine_desk.sqlite3`. Le plus petit compute payant est affiché à 7 USD/mois; le disque est facturé séparément à 0,25 USD/Go/mois selon la grille consultée en octobre 2026. Garder une seule instance tant que le stockage est SQLite. Vérifier le prix courant dans le tableau de bord avant toute activation.
