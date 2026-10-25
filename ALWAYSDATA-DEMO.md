# Démo WSGI sur Alwaysdata — à vérifier avant usage

`alwaysdata_wsgi.py` adapte les routes de l’application à WSGI/uWSGI; il ne démarre pas le serveur TCP de développement. Un test local de cette passerelle a réussi pour la santé API, la création du premier admin, le cookie HTTPS, l’authentification, un événement, un participant et les fichiers statiques.

## Important : conditions de l’offre gratuite

Alwaysdata annonce son offre gratuite pour un **usage personnel** et interdit les objectifs commerciaux/lucratifs, notamment l’hébergement du site d’une entreprise. Le forfait gratuit annonce 1 Go de disque, 256 Mo de RAM, ¼ de CPU et 3 jours de sauvegardes; le sous-domaine du site est en `alwaysdata.net`. Consultez les conditions actuelles avant de créer le site. Si l’usage est considéré comme celui d’Imagine Events ou de son activité, ne déployez pas sur l’offre gratuite : demandez confirmation à Alwaysdata ou choisissez une offre autorisant cet usage.

Dans tous les cas, cette configuration est une **démo**, avec des données fictives seulement. SQLite n’est pas une base de production éprouvée pour un service d’accueil multi-postes.

Références officielles : [offres et prix](https://www.alwaysdata.com/en/offers/), [restrictions de l’offre gratuite](https://help.alwaysdata.com/en/docs/admin-billing/profile/suspension/), [configuration Python WSGI](https://help.alwaysdata.com/en/docs/web-hosting/languages/python/configuration/).

## Déploiement

1. **Vérifier l’éligibilité de l’usage**, puis créer un compte Alwaysdata et un compte d’hébergement. Le forfait gratuit est sans carte bancaire, mais ses restrictions d’usage s’appliquent.
2. Extraire l’archive `ImagineEvents-Desk-Alwaysdata-Demo.zip`, puis téléverser le dossier `imagine-desk/` dans le compte via SFTP/SSH. L’application doit contenir `server.py`, `alwaysdata_wsgi.py`, `requirements.txt` et `public/` au même niveau.
3. Dans l’administration, choisir Python 3.12 ou une autre version Python 3 compatible. Avec SSH, depuis le dossier de l’application, créer un environnement et installer les dépendances :

   ```sh
   cd ~/imagine-desk
   python -m venv ~/venvs/imagine-desk
   ~/venvs/imagine-desk/bin/python -m pip install -r ~/imagine-desk/requirements.txt
   ```

4. Dans **Web > Sites**, ajouter un site de type **Python WSGI** :
   - adresse : le sous-domaine `…alwaysdata.net` fourni par le compte;
   - chemin de l’application : `/home/<COMPTE>/imagine-desk/alwaysdata_wsgi.py`;
   - répertoire de travail : `/home/<COMPTE>/imagine-desk`;
   - environnement virtuel : `/home/<COMPTE>/venvs/imagine-desk`.

   Remplacer `<COMPTE>` par le nom réel du compte et faire correspondre la version Python du site à celle utilisée pour créer l’environnement virtuel.
5. Dans les variables d’environnement du site, définir :

   ```text
   IMAGINE_DB_PATH=/home/<COMPTE>/imagine-desk-data/imagine_desk.sqlite3
   COOKIE_SECURE=1
   IMAGINE_SETUP_TOKEN=<un-secret-aleatoire-long>
   ```

   Le dossier de base sera créé automatiquement si le compte WSGI a le droit d’écrire dans `/home/<COMPTE>`. Garder la base en dehors du dossier public/Git. Ne pas mettre le secret dans le dépôt ou dans le navigateur. Pour générer un secret depuis un terminal Python : `python -c "import secrets; print(secrets.token_urlsafe(32))"`.
6. Recharger le site. Ouvrir son URL, saisir `IMAGINE_SETUP_TOKEN` à l’écran de configuration initiale et créer un compte admin avec un mot de passe provisoire unique. Tester uniquement avec une liste factice.
7. Après la création du compte admin, `IMAGINE_SETUP_TOKEN` peut être retiré des variables du site; la route de première configuration reste fermée parce qu’un compte existe déjà. Garder une copie de la base hors hébergement si le test contient des données qu’on souhaite conserver.

### En cas d’erreur

- Consulter les logs WSGI dans l’interface Alwaysdata.
- Vérifier le chemin WSGI, le répertoire de travail, la version Python et l’environnement virtuel.
- Si l’import Excel échoue, réinstaller `requirements.txt`; l’import CSV reste disponible.
- Le point de contrôle API est `/api/health`.

L’adaptateur est WSGI et pourrait aussi servir sur un autre hébergeur WSGI, après configuration propre à celui-ci. Ne pas copier une base réelle de l’application de production vers cet environnement de démonstration.
