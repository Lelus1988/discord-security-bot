# Private Security-Bot

Ein modularer, privater Discord-Sicherheitsbot (TypeScript, discord.js v14) mit Whitelist-Enforcement, Owner-Präsenzprüfung, Anti-Raid, Anti-Spam, vollständiger Moderation, Ticket-System, eigenen Server-Befehlen (BotGhost-Stil) und einem vollwertigen Web-Dashboard mit Live-Mitgliederliste, Online-Status, Rollenverwaltung, Willkommens-/Abschiedsnachrichten, Regeln und Logs.

## Voraussetzungen

- **Node.js** ≥ 18 (empfohlen: 20 LTS) — [nodejs.org](https://nodejs.org)
- **MongoDB** ≥ 6 (lokal oder z.B. [MongoDB Atlas](https://www.mongodb.com/atlas) kostenlos)
- Ein Discord-Bot-Token + Application aus dem [Discord Developer Portal](https://discord.com/developers/applications)

## Installation

```bash
cd discord-security-bot
npm install
```

Das installiert automatisch alle in `package.json` gelisteten Pakete (discord.js, mongoose, express, etc. — siehe Tabelle unten).

## Discord Developer Portal – wichtige Einstellungen

Unter **Bot** müssen diese drei privilegierten Intents aktiviert sein (Schalter "ON"):
- **Server Members Intent** (für Mitgliederliste & Anti-Raid)
- **Presence Intent** (für Online/Idle/DND/Offline-Status im Dashboard)
- **Message Content Intent** (für Anti-Spam & eigene Text-Befehle)

Unter **OAuth2 → Redirects** muss eingetragen sein (exakt, inkl. Protokoll):
```
http://localhost:3000/auth/callback
```
(oder deine eigene Domain, falls du es online hostest)

## Konfiguration

```bash
cp .env.example .env
```
Dann ausfüllen: `DISCORD_TOKEN`, `CLIENT_ID`, `CLIENT_SECRET`, `MONGO_URI`, `ALLOWED_GUILDS`, `SESSION_SECRET`. `OWNER_ID` ist bereits voreingestellt.

## Starten

```bash
# Slash-Commands einmalig bei Discord registrieren (nach jeder Command-Änderung erneut)
npm run deploy

# Bot + Web-Dashboard zusammen starten (ein einziger Prozess, Hot-Reload)
npm run dev
```

Danach im Browser `http://localhost:3000` öffnen und mit Discord einloggen.

**Wichtig:** Bot und Web-Dashboard laufen jetzt **im selben Prozess** (ein einziger `npm run dev` Befehl reicht), damit das Dashboard live auf Mitglieder, Rollen, Online-Status etc. zugreifen kann.

```bash
# Produktion: erst bauen, dann starten
npm run build
npm start
```

## Bot dauerhaft im Hintergrund laufen lassen (auch ohne VS Code, mit Autostart)

Standardmäßig läuft der Bot nur, solange das Terminal-Fenster (`npm run dev`) offen ist. Für den Dauerbetrieb nutzt du **PM2**, einen Prozess-Manager, der den Bot:
- im Hintergrund laufen lässt (Terminal/VS Code kann geschlossen werden)
- bei einem Absturz automatisch neu startet
- beim Hochfahren von Windows automatisch mitstartet

### Einmalige Einrichtung

```bash
# 1. PM2 global installieren
npm install -g pm2

# 2. Projekt einmal bauen (PM2 startet die kompilierte Version, nicht ts-node)
npm run build

# 3. Bot über PM2 starten
npm run service:start

# 4. Den aktuellen Stand "einfrieren", damit PM2 ihn beim Windows-Start wiederherstellt
pm2 save

# 5. Windows-Autostart für PM2 einrichten
npm install -g pm2-windows-startup
pm2-startup install
```

Ab jetzt startet der Bot automatisch mit, sobald du deinen PC einschaltest — du musst kein Terminal mehr offen lassen.

### Nützliche Befehle danach

```bash
npm run service:status    # Zeigt, ob der Bot läuft
npm run service:logs      # Live-Logs ansehen (Strg+C zum Beenden, Bot läuft weiter)
npm run service:restart   # Bot neu starten (z.B. nach Code-Änderungen)
npm run service:stop      # Bot stoppen
```

### Wichtig bei Code-Änderungen

Da PM2 die **kompilierte** Version (`dist/`) nutzt, musst du nach jeder Änderung am Code neu bauen und neu starten:
```bash
npm run build
npm run service:restart
```

### Web-Dashboard im Hintergrund-Betrieb

Das Dashboard läuft automatisch mit (gleicher Prozess wie der Bot), du erreichst es weiterhin unter `http://localhost:3000`, auch wenn kein Terminal offen ist.

---



Nach dem Login (`http://localhost:3000`) siehst du alle Server, auf denen du "Server verwalten"-Rechte hast und der Bot aktiv ist. Pro Server gibt es folgende Tabs:

| Tab | Funktion |
|---|---|
| **📊 Übersicht** | Mitgliederzahl, Online-Anzahl, Bots, Kanäle, Ränge, Boost-Level |
| **👥 Mitglieder** | Live-Liste mit Online-Status (●online/idle/dnd/offline), Rollen direkt zuweisen/entfernen, Kick/Ban/Mute/Unmute per Klick |
| **🎭 Ränge** | Ränge erstellen, Farbe/Name bearbeiten, löschen, Mitgliederzahl pro Rang sehen |
| **👋 Willkommen & Abschied** | Nachrichtentext mit Platzhaltern (`{user}`, `{username}`, `{server}`, `{memberCount}`), Kanal wählen, Embed an/aus, Live-Vorschau |
| **📜 Regeln** | Regeltext + Kanal festlegen, als Embed im Kanal posten |
| **⚡ Eigene Befehle** | Wie BotGhost: Präfix festlegen (z.B. `!`), eigene Text-Befehle pro Server erstellen (`!regeln` → Antworttext), aktivieren/deaktivieren, Nutzungszähler |
| **📋 Logs** | Alle Moderations-/Sicherheits-Ereignisse, filterbar nach Typ |
| **🛡️ Einstellungen** | Anti-Raid/Anti-Spam an/aus, Schwellenwerte, Log-Kanal, Mod-Rolle, Ticket-Kategorie, Whitelist (nur Bot-Owner) |

Alle Aktionen im Dashboard (Kick/Ban/Mute, Rollen zuweisen) laufen über dieselbe `ModerationService`-Logik wie die Slash-Commands und werden identisch geloggt.

## Eigene Befehle (Custom Commands)

Eigene Befehle werden **pro Server** im Dashboard-Tab "⚡ Eigene Befehle" angelegt und funktionieren als Text-Trigger im Chat (kein Slash-Command-Redeploy nötig):
```
!regeln  →  "Lies dir bitte #regeln durch!"
```
Reservierte Namen (z.B. `ban`, `kick`, `config`) können nicht überschrieben werden.

## Projektstruktur

```
src/
  commands/         # Slash-Commands (moderation, admin, tickets)
  events/           # Discord-Event-Handler (guildCreate, messageCreate, …)
  services/         # Kernlogik (Guild, Moderation, Raid, Spam, Logging, Ticket,
                     #            Welcome, CustomCommand, Member, Role)
  database/         # Mongoose-Modelle + Connection
  handlers/         # Lädt Commands & Events automatisch
  middleware/        # Berechtigungs-/Whitelist-Prüfungen
  utils/             # Logger & Helferfunktionen
  client.ts          # Singleton: macht den Bot-Client für das Webpanel zugänglich
  config.ts          # Zentrale Konfiguration aus .env
  index.ts           # Einstiegspunkt – startet Bot UND Webpanel im selben Prozess
  deploy-commands.ts # Registriert Slash-Commands bei Discord
webpanel/
  server.ts          # Express-Server (wird von src/index.ts gestartet)
  routes/            # /auth, /api/guilds, /api/members, /api/roles, /api/welcome,
                      # /api/rules, /api/commands, /api/logs, /api/config, /api/channels
  middleware/         # Session-Auth-Guard
  utils/              # Zugriffsprüfung (OAuth-Berechtigung + Bot-Live-Status)
  public/             # Statisches Frontend (HTML/CSS/Vanilla-JS, kein Build-Schritt nötig)
    dashboard.html    # Server-Übersicht
    server.html        # Tabbed Admin-Panel (Mitglieder, Ränge, Logs, …)
    css/style.css
    js/                # common.js, dashboard.js, server.js
```

## Sicherheitsmechanismen

- **Whitelist-Enforcement**: Bot verlässt automatisch jeden Server, der nicht in `ALLOWED_GUILDS` steht.
- **Owner-Präsenzprüfung**: Verlässt den Server sofort, wenn die Owner-ID den Server verlässt/gekickt/gebannt wird.
- **Anti-Raid**: Join-Schwellenwert + Scoring → automatischer Lockdown mit Wiederherstellung nach Ablauf.
- **Anti-Spam**: Nachrichtenrate, Wiederholungen, Mass-Mentions, Spam-Links → Auto-Mute + Löschung.
- **Rollen-Hierarchie-Check**: Moderatoren (auch über das Dashboard) können niemals höher- oder gleichrangige Mitglieder sanktionieren.
- **Dashboard-Zugriff**: Nur Discord-Nutzer mit "Server verwalten"-Berechtigung (per OAuth2 verifiziert) sehen/bearbeiten einen Server; die Whitelist selbst kann nur der Bot-Owner ändern.
- **Audit-Logging**: Jede Aktion (Slash-Command UND Dashboard) landet in MongoDB und optional in einem konfigurierbaren Log-Kanal.

## Pakete (zur Referenz)

**Runtime-Abhängigkeiten:** `discord.js`, `@discordjs/rest`, `mongoose`, `express`, `express-session`, `axios`, `cors`, `dotenv`
**Dev-Abhängigkeiten:** `typescript`, `ts-node`, `ts-node-dev`, `@types/node`, `@types/express`, `@types/express-session`, `@types/cors`

Alle werden automatisch durch `npm install` installiert.

## Nächste Schritte / mögliche Erweiterungen

- Bot-Berechtigungen beim Invite-Link mindestens: `Ban Members`, `Kick Members`, `Moderate Members`, `Manage Channels`, `Manage Roles`, `Manage Messages`, `View Audit Log`.
- Für Produktion: Reverse-Proxy (z.B. nginx) + HTTPS vor das Dashboard schalten, `SESSION_SECRET` auf einen langen Zufallswert setzen, `NODE_ENV=production`, `OAUTH2_REDIRECT_URI` auf die echte Domain anpassen (und im Developer Portal nachtragen).
- MongoDB-Backups einplanen (`mongodump` per Cron oder Managed-Service-Backups).
