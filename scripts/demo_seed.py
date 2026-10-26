#!/usr/bin/env python3
"""Crée un jeu de données de démonstration reproductible.

Usage (depuis la racine du dépôt) :

    python scripts/demo_seed.py            # crée les données si la base est vide
    python scripts/demo_seed.py --reset    # remplace la base par la démo

La base visée est celle que le serveur utilisera : `IMAGINE_DB_PATH` si la variable
existe, sinon `data/imagine_desk.sqlite3`. Ce fichier reste hors de Git (.gitignore)
et ne doit contenir aucune donnée réelle.
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import server  # noqa: E402  (après ajustement du chemin d'import)

DEMO_USERS = [
    ("usr-demo-admin", "demo.accueil", "DemoAccueil2026!", "admin"),
    ("usr-demo-desk", "desk.accueil", "DemoDesk2026!", "desk"),
]

DEMO_EVENT = ("evt-demo-automne", "Congrès d’automne 2026", "2026-11-12", "Hôtel Laico, Tunis", "TND")

# Congrès volontairement dans la corbeille (supprimé il y a 4 jours) pour montrer
# le compte à rebours de 30 jours et la restauration.
DEMO_TRASH_EVENT = ("evt-demo-printemps", "Congrès de printemps 2026", "2026-04-18", "Palais des congrès, Sousse", "TND")
DEMO_TRASH_DAYS_AGO = 4
DEMO_TRASH_PEOPLE = [
    ("Sami Khelifi", "sami.khelifi@example.tn", "Réseau Sud", "participant", "paid", 120.5),
    ("Hela Zribi", "hela.zribi@example.tn", "Institut Français", "speaker", "exempt", 0),
    ("Bilel Mansour", "bilel.mansour@example.tn", "Agence Mer", "press", "unpaid", 0),
]

DEMO_PEOPLE = [
    # nom, e-mail, organisation, catégorie, statut paiement, montant, moyen, référence, heure arrivée, confirmé par
    ("Amira Ben Salem", "amira.bensalem@example.tn", "Entreprise Exemple", "vip", "paid", 150.0, "cash", "REC-1042", "09:12", "demo.accueil"),
    ("Mehdi Trabelsi", "mehdi.trabelsi@example.tn", "Groupe Medina", "participant", "paid", 120.5, "transfer", "VIR-2201", "09:25", "desk.accueil"),
    ("Leila Haddad", "leila.haddad@example.tn", "Université de Tunis", "speaker", "exempt", 0, "", "", "09:31", "demo.accueil"),
    ("Karim Bouazizi", "karim.bouazizi@example.tn", "TechLab", "participant", "unpaid", 0, "", "", "", ""),
    ("Salma Riahi", "salma.riahi@example.tn", "Media Plus", "press", "paid", 80.0, "card", "", "10:02", "desk.accueil"),
    ("Youssef Ferchichi", "youssef.f@example.tn", "Cabinet Nord", "participant", "unpaid", 0, "", "", "", ""),
    ("Nour El Abed", "nour.elabed@example.tn", "Imagine Events", "team", "exempt", 0, "", "", "08:45", "demo.accueil"),
    ("Rania Chaabane", "rania.chaabane@example.tn", "Startup Village", "participant", "paid", 120.5, "mobile", "D17-889", "10:18", "desk.accueil"),
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Données de démonstration Imagine Events Desk")
    parser.add_argument("--reset", action="store_true", help="supprime les données existantes avant de recréer la démo")
    args = parser.parse_args()

    server.DB_PATH = Path(os.environ.get("IMAGINE_DB_PATH") or ROOT / "data" / "imagine_desk.sqlite3")
    if server.USE_POSTGRES:
        print("Base PostgreSQL détectée (DATABASE_URL).")
    if args.reset and server.USE_POSTGRES:
        print("--reset est ignoré en PostgreSQL : supprimez les lignes depuis psql si nécessaire.")
    if args.reset and not server.USE_POSTGRES:
        for suffix in ("", "-wal", "-shm"):
            candidate = Path(str(server.DB_PATH) + suffix)
            if candidate.exists():
                candidate.unlink()
        print(f"Base supprimée : {server.DB_PATH}")

    server.init_db()
    con = server.connect()
    now = server.utc_now()
    try:
        created_users = 0
        for user_id, username, password, role in DEMO_USERS:
            if con.execute("SELECT 1 FROM users WHERE lower(username)=lower(?)", (username,)).fetchone():
                continue
            salt, digest = server.make_password_hash(password)
            con.execute(
                "INSERT INTO users(id,username,password_salt,password_hash,role,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
                (user_id, username, salt, digest, role, 1, now, now),
            )
            created_users += 1

        event_id, name, date, venue, currency = DEMO_EVENT
        values = (event_id, name, date, venue, "active", currency, now, now)
        columns = "id,name,event_date,venue,status,currency,created_at,updated_at"
        placeholders = ",".join("?" for _ in values)
        if server.USE_POSTGRES:
            con.execute(
                f"INSERT INTO events ({columns}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING",
                values,
            )
        else:
            con.execute(f"INSERT OR IGNORE INTO events ({columns}) VALUES ({placeholders})", values)

        # Congrès en corbeille : supprimé il y a DEMO_TRASH_DAYS_AGO jours.
        trash_id, trash_name, trash_date, trash_venue, trash_currency = DEMO_TRASH_EVENT
        deleted_at = (
            datetime.now(timezone.utc) - timedelta(days=DEMO_TRASH_DAYS_AGO)
        ).isoformat(timespec="microseconds")
        trash_values = (trash_id, trash_name, trash_date, trash_venue, "active", trash_currency,
                        now, now, deleted_at, "demo.accueil")
        trash_columns = "id,name,event_date,venue,status,currency,created_at,updated_at,deleted_at,deleted_by"
        trash_placeholders = ",".join("?" for _ in trash_values)
        if server.USE_POSTGRES:
            con.execute(
                f"INSERT INTO events ({trash_columns}) VALUES ({trash_placeholders}) ON CONFLICT (id) DO NOTHING",
                trash_values,
            )
        else:
            con.execute(f"INSERT OR IGNORE INTO events ({trash_columns}) VALUES ({trash_placeholders})", trash_values)
        for index, (full_name, email, company, category, status, amount) in enumerate(DEMO_TRASH_PEOPLE, start=1):
            person_id = f"p-demo-trash-{index}"
            if con.execute("SELECT 1 FROM participants WHERE id=?", (person_id,)).fetchone():
                continue
            con.execute(
                """INSERT INTO participants(
                    id,event_id,name,email,company,category,code,checked_in_at,
                    payment_status,payment_amount,payment_confirmed_at,payment_confirmed_by,
                    created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (person_id, trash_id, full_name, email, company, category, f"IE-9{index:03d}",
                 f"{trash_date}T09:0{index}:00+01:00" if status != "unpaid" else None,
                 status, amount, now if status != "unpaid" else None,
                 "demo.accueil" if status != "unpaid" else "", now, now),
            )

        created_people = 0
        for index, (full_name, email, company, category, status, amount, method, reference, hhmm, confirmed_by) in enumerate(DEMO_PEOPLE, start=1):
            person_id = f"p-demo-{index}"
            if con.execute("SELECT 1 FROM participants WHERE id=?", (person_id,)).fetchone():
                continue
            checked_at = f"2026-11-12T{hhmm}:00+01:00" if hhmm else None
            confirmed_at = f"2026-11-12T{hhmm}:00+01:00" if status != "unpaid" else None
            con.execute(
                """INSERT INTO participants(
                    id,event_id,name,email,company,category,code,checked_in_at,
                    payment_status,payment_amount,payment_method,payment_reference,payment_confirmed_at,payment_confirmed_by,
                    created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (person_id, event_id, full_name, email, company, category, f"IE-{100 + index:04d}", checked_at,
                 status, amount, method, reference, confirmed_at, confirmed_by, now, now),
            )
            created_people += 1
    finally:
        con.close()

    print(f"Base : {server.db_display_path()}")
    print(f"Comptes créés : {created_users} — Participants créés : {created_people}")
    print("Comptes de démonstration :")
    for _, username, password, role in DEMO_USERS:
        print(f"  - {username} / {password} ({role})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
