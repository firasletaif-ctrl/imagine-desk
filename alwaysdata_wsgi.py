"""Adaptateur WSGI pour déployer Imagine Events Desk sur un hébergeur WSGI.

Le serveur de développement intégré à server.py reste disponible pour l'usage local.
Cette passerelle réutilise les routes HTTP existantes sans lancer de serveur socket.
"""
from __future__ import annotations

import json
import sys
from email.message import Message
from http import HTTPStatus
from io import BytesIO
from pathlib import Path

APP_DIR = str(Path(__file__).resolve().parent)
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

from server import Handler, MAX_BACKUP_REQUEST, init_db

# Le compte WSGI reçoit les requêtes derrière le proxy HTTPS de l'hébergeur.
# L'initialisation est idempotente et ne crée pas de données métier.
init_db()


def _error_response(status: int, message: str):
    body = json.dumps({"error": message}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return status, [
        ("Content-Type", "application/json; charset=utf-8"),
        ("Content-Length", str(len(body))),
        ("Cache-Control", "no-store"),
        ("X-Content-Type-Options", "nosniff"),
    ], body


def application(environ, start_response):
    """Callable WSGI standard: application(environ, start_response)."""
    method = (environ.get("REQUEST_METHOD") or "GET").upper()
    path = environ.get("PATH_INFO") or "/"
    query = environ.get("QUERY_STRING") or ""
    request_path = path + ("?" + query if query else "")

    headers = Message()
    for key, value in environ.items():
        if key.startswith("HTTP_") and value is not None:
            header_name = "-".join(piece.capitalize() for piece in key[5:].split("_"))
            headers[header_name] = str(value)
    content_type = environ.get("CONTENT_TYPE")
    if content_type:
        headers["Content-Type"] = str(content_type)
    content_length = environ.get("CONTENT_LENGTH")
    headers["Content-Length"] = str(content_length if content_length not in (None, "") else "0")

    # Permet au code d'authentification existant d'émettre un cookie Secure derrière HTTPS.
    forwarded_proto = environ.get("HTTP_X_FORWARDED_PROTO") or environ.get("wsgi.url_scheme") or "http"
    if not headers.get("X-Forwarded-Proto"):
        headers["X-Forwarded-Proto"] = str(forwarded_proto)

    try:
        try:
            length = int(headers.get("Content-Length", "0"))
        except (TypeError, ValueError):
            length = 0
        request_body = b""
        if 0 < length <= MAX_BACKUP_REQUEST:
            stream = environ.get("wsgi.input")
            if stream is not None:
                request_body = stream.read(length)

        response = {"status": 200, "headers": []}
        handler = Handler.__new__(Handler)
        handler.path = request_path
        handler.command = method
        handler.headers = headers
        handler.rfile = BytesIO(request_body)
        handler.wfile = BytesIO()
        handler.client_address = (environ.get("REMOTE_ADDR", "unknown"), 0)

        def capture_status(status, *args, **kwargs):
            response["status"] = int(status)

        def capture_header(name, value):
            response["headers"].append((str(name), str(value)))

        handler.send_response = capture_status
        handler.send_header = capture_header
        handler.end_headers = lambda: None

        if method == "HEAD":
            handler.do_GET()
        else:
            dispatch = getattr(handler, "do_" + method, None)
            if dispatch is None:
                response["status"], response["headers"], body = _error_response(405, "Méthode HTTP non prise en charge.")
                response_headers = response["headers"]
                status_code = response["status"]
                body_bytes = body
                phrase = HTTPStatus(status_code).phrase
                start_response(f"{status_code} {phrase}", response_headers)
                return [body_bytes]
            dispatch()

        body_bytes = handler.wfile.getvalue()
        if method == "HEAD":
            body_bytes = b""
        status_code = response["status"]
        response_headers = response["headers"]
        phrase = HTTPStatus(status_code).phrase if status_code in HTTPStatus._value2member_map_ else "Unknown"
        start_response(f"{status_code} {phrase}", response_headers)
        return [body_bytes]
    except Exception as exc:
        print("WSGI request error:", repr(exc), flush=True)
        status_code, response_headers, body_bytes = _error_response(500, "Erreur interne du serveur.")
        start_response(f"{status_code} {HTTPStatus(status_code).phrase}", response_headers)
        return [body_bytes]
