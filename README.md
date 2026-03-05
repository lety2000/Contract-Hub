# Vertragsmanager - Synology Deployment

## Quick Start für Portainer

### 1. In Portainer: Stacks → Add Stack

### 2. Build method: Repository

### 3. Repository URL eingeben:
```
https://github.com/DEIN-USERNAME/DEIN-REPO
```

### 4. Compose path:
```
docker-compose.yml
```

### 5. Environment Variables hinzufügen:

| Name | Wert |
|------|------|
| JWT_SECRET | `ein-langes-sicheres-passwort-min-32-zeichen` |

### 6. Deploy klicken

---

## Nach dem Deploy

Die App ist erreichbar unter:
- **Direkt:** `http://SYNOLOGY-IP:8080`
- **Mit Reverse Proxy:** `https://vertraege.letang2000.synology.me`

### Reverse Proxy einrichten (Synology)

1. Systemsteuerung → Anmeldungsportal → Erweitert → Reverse Proxy
2. Erstellen:
   - Quelle: HTTPS, `vertraege.letang2000.synology.me`, Port 443
   - Ziel: HTTP, localhost, Port 8080
3. Benutzerdefinierte Kopfzeile → Erstellen → WebSocket

---

## Fehlerbehebung

### Container starten nicht
- Warten Sie 1-2 Minuten nach dem Deploy
- Prüfen Sie die Logs in Portainer

### Login funktioniert nicht
- Browser-Cache leeren (Strg+Shift+Del)
- Prüfen Sie ob alle 3 Container laufen (grün)
