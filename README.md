# Imagine Events — Desk d’accueil multi-congrès

Prototype web réutilisable pour gérer plusieurs congrès, importer des participants depuis CSV et Excel (.xlsx), confirmer les arrivées, imprimer des badges et exporter les rapports. Il inclut maintenant des comptes d’accès pour l’équipe. L’interface utilise JavaScript natif; le serveur utilise Python, SQLite et `openpyxl`.

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
- **Agent desk** : consulte les événements, recherche les inscrits, confirme les arrivées et ajoute un participant au desk.
- Les mots de passe sont hachés côté serveur (PBKDF2); les sessions expirent après 12 heures. Chaque utilisateur peut changer son mot de passe; l’administrateur peut désactiver un compte ou réinitialiser le mot de passe d’un autre membre.
- Les mots de passe ne doivent pas être partagés. Au premier test dans l’aperçu, utilisez un mot de passe provisoire, pas votre mot de passe personnel.

## Import CSV ou Excel

Dans « Participants », choisissez « Importer CSV / Excel », puis votre fichier. Le CSV accepte les séparateurs virgule ou point-virgule. Pour Excel, utilisez un classeur `.xlsx` : l’application lit la première feuille. Les anciens fichiers `.xls` doivent être enregistrés en `.xlsx`.

Colonnes reconnues : nom complet (ou prénom + nom), e-mail, organisation/entreprise, catégorie, code badge et statut. Les doublons sont rapprochés par e-mail ou code badge. Modèle Excel : `public/modele-import-participants.xlsx`; l’application propose aussi les modèles CSV et Excel.

## Plusieurs postes et mode de secours

Les événements et les inscrits sont enregistrés séparément dans `data/imagine_desk.sqlite3`. Les postes connectés au même serveur reçoivent les check-ins des autres desks en quelques secondes. Chaque navigateur conserve aussi un cache local; les check-ins et les ajouts individuels faits pendant une coupure sont mis en file, puis synchronisés au retour de la connexion. Pour le secours hors ligne, ouvrez d’abord l’application et chargez la liste sur chaque appareil, puis gardez l’onglet ouvert. L’import de fichiers CSV/Excel nécessite une connexion au serveur. Le cache local contient des données de participants : utilisez des appareils de confiance et déconnectez-vous en fin de service (la file en attente est conservée jusqu’à sa synchronisation).

## Déploiement Render

Le projet contient un `Dockerfile` et un `render.yaml` pour lancer une démo sur Render Free. Instructions détaillées : `RENDER-DEMO.md`. L’offre gratuite a un système de fichiers éphémère et le service peut s’endormir; la base SQLite peut donc être perdue après redémarrage ou redéploiement. **Ne pas y importer de vraies listes.**

Pour conserver les données sur Render, il faut un service payant avec disque persistant monté (par exemple `/var/data`) et `IMAGINE_DB_PATH=/var/data/imagine_desk.sqlite3`. Le coût dépend du plan; vérifier la grille Render avant activation. Conserver une seule instance tant que le stockage est SQLite. Pour plusieurs instances, migrer vers PostgreSQL.

Dans **Comptes** (Admin), les boutons **Exporter la base** et **Importer une base** permettent de télécharger une sauvegarde SQLite et de restaurer un ancien fichier `.sqlite3`, `.sqlite` ou `.db` (50 Mo maximum). L’import remplace les congrès/participants, conserve les comptes du serveur et n’importe jamais les sessions. C’est une sauvegarde manuelle : le fichier doit être téléchargé avant la perte des données et gardé hors de Render. Protégez-le, car il contient les empreintes des mots de passe.

Render accepte des dépôts Git connectés et des images Docker préconstruites. Ne jamais publier le fichier `data/imagine_desk.sqlite3`; si GitHub est indisponible, utiliser un dépôt GitLab/Bitbucket autorisé ou une image de registre, sans mettre de données réelles dans l’image.

## Démo WSGI (Alwaysdata ou autre hébergeur WSGI)

`alwaysdata_wsgi.py` expose les routes existantes sous forme WSGI, sans lancer de serveur TCP. Guide de configuration : `ALWAYSDATA-DEMO.md`. L’offre gratuite Alwaysdata est annoncée pour un usage personnel et exclut les objectifs commerciaux; vérifier les conditions avant de l’utiliser pour Imagine Events. La démo doit rester avec des données fictives. Le fichier SQLite doit rester dans un dossier privé persistant du compte, jamais dans Git.

## À sécuriser avant un congrès réel

C’est un **prototype/MVP**, pas une garantie de disponibilité permanente. Les comptes sont présents, mais le dépôt ne fournit pas encore de sauvegardes distantes automatiques, de bascule haute disponibilité ni de procédure de reprise éprouvée. Avant d’importer de vraies données : héberger derrière HTTPS, sauvegarder la base, sécuriser les appareils partagés et tester le réseau ainsi que les imprimantes sur place. L’aperçu de démonstration n’est pas un hébergement permanent de production.
