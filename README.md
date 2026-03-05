# Vertragsmanager - Synology Deployment

## 🔧 Root Cause des bisherigen Problems

Die Frontend `.env` Datei enthielt eine hardcodierte Preview-URL (`https://vertrag-hub-1.preview.emergentagent.com`), die beim Docker-Build in die App eingebettet wurde. Dadurch gingen alle API-Aufrufe an die falsche URL statt über den nginx-Proxy.

**Fix:** Das Dockerfile kopiert jetzt nur die benötigten Dateien (ohne `.env`) und erstellt eine neue leere `.env`.

---

## 🚀 Deployment in Portainer

### Schritt 1: Alten Stack komplett löschen

1. In Portainer: **Stacks** → `vertragsmanager` → **Remove**
2. **Volumes** → `vertragsmanager_mongo_data` → **Remove** (für sauberen Start)
3. **Images** → Alle `vertragsmanager-*` Images löschen

### Schritt 2: Neuen Stack erstellen

1. **Stacks** → **Add Stack**
2. **Name:** `vertragsmanager`
3. **Build method:** Repository
4. **Repository URL:** `https://github.com/IHR-USERNAME/IHR-REPO`
5. **Compose path:** `docker-compose.yml`
6. **Environment variables:**
   - Name: `JWT_SECRET`
   - Value: Ein langes sicheres Passwort (mind. 32 Zeichen)
7. **Deploy the stack**

### Schritt 3: Warten

Der erste Build dauert **5-10 Minuten**. Warten Sie, bis alle 3 Container grün sind:
- `vertragsmanager-db` (MongoDB)
- `vertragsmanager-backend` (API)
- `vertragsmanager-frontend` (Web App)

---

## 🌐 Zugriff

- **Direkt:** `http://SYNOLOGY-IP:8080`
- **Mit Reverse Proxy:** `https://vertraege.xxx.synology.me`

### Reverse Proxy einrichten

1. **Systemsteuerung** → **Anmeldungsportal** → **Erweitert** → **Reverse Proxy**
2. **Erstellen:**
   - Beschreibung: `Vertragsmanager`
   - Quelle: HTTPS, `vertraege.xxx.synology.me`, Port 443
   - Ziel: HTTP, `localhost`, Port 8080
3. **Benutzerdefinierte Kopfzeile** → **Erstellen** → **WebSocket**
4. **Speichern**

---

## ❓ Fehlerbehebung

### Login funktioniert nicht
1. Browser-Cache komplett leeren (Strg+Shift+Del)
2. In Portainer: Container-Logs prüfen
3. Test: `http://SYNOLOGY-IP:8080/api/health` sollte `{"status":"healthy"}` zeigen

### Container starten nicht
1. Logs in Portainer prüfen
2. Sicherstellen, dass Port 8080 frei ist
3. Stack löschen, Volumes löschen, neu deployen

### Frontend zeigt Fehler
- Images löschen und Stack neu bauen (Force Rebuild)
