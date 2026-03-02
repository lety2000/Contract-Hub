# Vertragsmanager - Installation auf Synology NAS

Diese Anleitung erklärt Schritt für Schritt, wie du den Vertragsmanager auf deiner Synology DS220+ mit Portainer installierst und unter `vertraege.letang2000.synology.me` erreichbar machst.

---

## Voraussetzungen

- Synology NAS (DS220+ oder ähnlich) mit Docker-Unterstützung
- **Container Manager** (früher Docker) installiert (aus dem Paket-Zentrum)
- **Portainer** installiert (optional, aber empfohlen für einfachere Verwaltung)
- Synology DDNS mit `letang2000.synology.me` bereits eingerichtet

---

## Schritt 1: Ordner auf der NAS erstellen

Verbinde dich per SSH oder über die File Station mit deiner NAS und erstelle den Ordner:

```
/volume1/docker/vertragsmanager/
```

**Über File Station:**
1. Öffne File Station
2. Navigiere zu `docker` (erstelle den Ordner falls nicht vorhanden)
3. Erstelle darin einen neuen Ordner `vertragsmanager`

---

## Schritt 2: Dateien hochladen

Lade folgende Ordner in `/volume1/docker/vertragsmanager/` hoch:

```
vertragsmanager/
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── docker-compose.yml
│   └── nginx.conf
├── backend/
│   ├── server.py
│   └── requirements.txt
└── frontend/
    ├── app/
    ├── src/
    ├── package.json
    ├── yarn.lock
    └── ... (alle anderen Dateien)
```

**Tipp:** Du kannst die Dateien als ZIP herunterladen und über File Station entpacken.

---

## Schritt 3: Umgebungsvariablen konfigurieren

Erstelle eine `.env` Datei im `docker` Ordner mit folgendem Inhalt:

```bash
# Sicherheit - UNBEDINGT ändern!
JWT_SECRET=dein-sehr-langes-sicheres-passwort-mindestens-32-zeichen

# E-Mail Einstellungen (optional - kann auch später in der App konfiguriert werden)
# SMTP_USER=deine.email@gmail.com
# SMTP_PASSWORD=dein-app-passwort
# SMTP_FROM_EMAIL=deine.email@gmail.com
# SMTP_FROM_NAME=Vertragsmanager
```

**Wichtig:** Das `JWT_SECRET` sollte mindestens 32 zufällige Zeichen lang sein!

---

## Schritt 4: Mit Portainer deployen

### 4.1 Portainer öffnen

Öffne Portainer in deinem Browser (normalerweise: `http://deine-nas-ip:9000`)

### 4.2 Stack erstellen

1. Gehe zu **Stacks** → **Add Stack**
2. **Name:** `vertragsmanager`
3. **Build method:** Wähle "Web editor"
4. Kopiere folgenden Inhalt:

```yaml
version: '3.8'

services:
  mongo:
    image: mongo:7
    container_name: vertragsmanager-db
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
    networks:
      - vertragsmanager-net
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    build:
      context: /volume1/docker/vertragsmanager
      dockerfile: docker/Dockerfile.backend
    container_name: vertragsmanager-backend
    restart: unless-stopped
    environment:
      - MONGO_URL=mongodb://mongo:27017
      - DB_NAME=vertragsmanager
      - JWT_SECRET=${JWT_SECRET:-bitte-unbedingt-aendern}
    depends_on:
      mongo:
        condition: service_healthy
    networks:
      - vertragsmanager-net

  frontend:
    build:
      context: /volume1/docker/vertragsmanager
      dockerfile: docker/Dockerfile.frontend
    container_name: vertragsmanager-frontend
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      - backend
    networks:
      - vertragsmanager-net

volumes:
  mongo_data:
    driver: local

networks:
  vertragsmanager-net:
    driver: bridge
```

### 4.3 Environment Variables hinzufügen

Unter dem Editor findest du "Environment variables". Klicke auf "Add environment variable" und füge hinzu:

| Name | Wert |
|------|------|
| JWT_SECRET | (dein sicheres Passwort, z.B. `mein-super-geheimes-jwt-secret-2024`) |

### 4.4 Deploy

Klicke auf **Deploy the stack**

⏳ **Hinweis:** Der erste Build kann 5-10 Minuten dauern, da Docker alle Abhängigkeiten herunterladen und das Frontend kompilieren muss.

---

## Schritt 5: Synology Reverse Proxy einrichten

### 5.1 Systemsteuerung öffnen

1. Öffne die **Systemsteuerung**
2. Gehe zu **Anmeldungsportal** → **Erweitert** → **Reverse Proxy**

### 5.2 Neue Regel erstellen

Klicke auf **Erstellen** und fülle folgende Werte aus:

**Allgemein:**
| Feld | Wert |
|------|------|
| Beschreibung | Vertragsmanager |

**Quelle:**
| Feld | Wert |
|------|------|
| Protokoll | HTTPS |
| Hostname | `vertraege.letang2000.synology.me` |
| Port | 443 |

**Ziel:**
| Feld | Wert |
|------|------|
| Protokoll | HTTP |
| Hostname | localhost |
| Port | 8080 |

### 5.3 WebSocket Support aktivieren

1. Klicke auf **Benutzerdefinierte Kopfzeile**
2. Klicke auf **Erstellen** → **WebSocket**
3. Speichern

---

## Schritt 6: SSL-Zertifikat (falls nicht vorhanden)

Falls du noch kein SSL-Zertifikat für deine Synology DDNS hast:

1. Öffne **Systemsteuerung** → **Sicherheit** → **Zertifikat**
2. Klicke auf **Hinzufügen** → **Neues Zertifikat hinzufügen**
3. Wähle **Zertifikat von Let's Encrypt abrufen**
4. Domainname: `letang2000.synology.me`
5. Alternative Namen: `vertraege.letang2000.synology.me`
6. E-Mail eingeben und bestätigen

---

## Fertig!

Dein Vertragsmanager ist jetzt erreichbar unter:

**https://vertraege.letang2000.synology.me**

### Erste Schritte in der App:

1. Öffne die URL in deinem Browser
2. Klicke auf **Registrieren** und erstelle einen Account
3. Nach der Anmeldung kannst du sofort Verträge anlegen
4. Unter **Einstellungen** → **SMTP-Einstellungen** kannst du deine E-Mail-Daten für Erinnerungen hinterlegen

---

## Fehlerbehebung

### Container starten nicht
- Prüfe die Logs in Portainer: **Containers** → **vertragsmanager-backend** → **Logs**
- Stelle sicher, dass Port 8080 nicht von einer anderen Anwendung belegt ist

### Webseite nicht erreichbar
- Teste erst den direkten Zugriff: `http://deine-nas-ip:8080`
- Prüfe die Reverse Proxy Einstellungen
- Stelle sicher, dass Port 443 in deinem Router zur NAS weitergeleitet ist

### E-Mails werden nicht gesendet
- Öffne in der App: **Einstellungen** → **SMTP-Einstellungen**
- Für Gmail brauchst du ein **App-Passwort** (nicht dein normales Passwort!)
- App-Passwort erstellen: https://myaccount.google.com/apppasswords

### Login funktioniert nicht
- Lösche den Browser-Cache und Cookies
- Prüfe, ob die Container alle laufen (in Portainer sollten alle grün sein)

---

## Backup

### Über die App (empfohlen)
1. Öffne **Einstellungen** → **Backup erstellen**
2. Speichere die JSON-Datei an einem sicheren Ort

### Docker Volume sichern
```bash
# Backup erstellen
docker exec vertragsmanager-db mongodump --out /backup
docker cp vertragsmanager-db:/backup ./mongodb-backup-$(date +%Y%m%d)
```

---

## Update

Um die App zu aktualisieren:

1. Lade die neuen Dateien in `/volume1/docker/vertragsmanager/` hoch
2. In Portainer: **Stacks** → **vertragsmanager**
3. Klicke auf **Stop** und dann **Remove**
4. Klicke auf **Add Stack** und deploye erneut (wie in Schritt 4)

**Wichtig:** Die Datenbank (MongoDB) wird in einem separaten Volume gespeichert und bleibt erhalten!

---

## Mobiler Zugriff

Die App funktioniert auch auf Smartphones. Für ein App-ähnliches Erlebnis:

**iOS:**
Safari → Teilen → Zum Home-Bildschirm

**Android:**
Chrome → Menü (3 Punkte) → Zum Startbildschirm hinzufügen

---

Bei Fragen stehe ich gerne zur Verfügung!
