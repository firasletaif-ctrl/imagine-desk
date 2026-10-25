FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py ./server.py
COPY public ./public

ENV HOST=0.0.0.0
ENV PORT=8000
# Secours SQLite si DATABASE_URL n’est pas fourni. Sur un hébergeur, préférer
# DATABASE_URL (PostgreSQL) : le disque des conteneurs est éphémère.
ENV IMAGINE_DB_PATH=/app/data/imagine_desk.sqlite3
EXPOSE 8000
CMD ["python", "server.py"]
