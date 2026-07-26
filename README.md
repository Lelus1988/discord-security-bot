<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=28&pause=4000&color=68818F&center=true&vCenter=true&repeat=true&width=700&lines=Privater+Discord-Sicherheitsbot;Whitelist+%2B+Anti-Raid+%2B+Anti-Spam;Vollwertiges+Web-Dashboard" alt="Typing SVG" />

</div>

<p align="center">
<a href="https://nodejs.org"><img alt="Node.js" src="https://img.shields.io/badge/Node.js-1f1f1f?style=for-the-badge&logo=nodedotjs&logoColor=1f1f1f&labelColor=68818f&color=1f1f1f"></a>&nbsp;
<a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-1f1f1f?style=for-the-badge&logo=typescript&logoColor=1f1f1f&labelColor=68818f&color=1f1f1f"></a>&nbsp;
<a href="https://discord.js.org/"><img alt="Discord.js" src="https://img.shields.io/badge/discord.js%20v14-1f1f1f?style=for-the-badge&logo=discord&logoColor=1f1f1f&labelColor=68818f&color=1f1f1f"></a>&nbsp;
<a href="https://www.mongodb.com/"><img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-1f1f1f?style=for-the-badge&logo=mongodb&logoColor=1f1f1f&labelColor=68818f&color=1f1f1f"></a>&nbsp;
<a href="https://expressjs.com/"><img alt="Express" src="https://img.shields.io/badge/Express-1f1f1f?style=for-the-badge&logo=express&logoColor=1f1f1f&labelColor=68818f&color=1f1f1f"></a>
</p>

- Installation: [hier](#installation)
- Konfiguration: [hier](#konfiguration)
- Starten: [hier](#starten)
- Dauerbetrieb mit PM2: [hier](#dauerbetrieb)
- Web-Dashboard: [hier](#dashboard)
- Projektstruktur: [hier](#projektstruktur)
- Sicherheitsmechanismen: [hier](#sicherheit)
- Troubleshooting: [hier](#troubleshooting)

Überblick:

- **Private Security-Bot** ist ein privater, modularer Discord-Sicherheitsbot, geschrieben in **TypeScript** mit **discord.js v14**.
- Der Bot ist auf Whitelist-Server beschränkt und prüft dauerhaft die Präsenz des Bot-Owners.
- Enthält Anti-Raid, Anti-Spam, vollständige Moderation, ein Ticket-System und eigene Server-Befehle im Stil von BotGhost.
- Bot und Web-Dashboard laufen im selben Prozess und teilen sich dieselbe Logik.
- Das Dashboard bietet eine Live-Mitgliederliste, Online-Status, Rollenverwaltung, Willkommens-/Abschiedsnachrichten, Regeln und Logs.

---

<h2 id="features"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Kernfunktionen" alt="Typing SVG" /></h2>

* **Whitelist-Enforcement:** Der Bot verlässt automatisch jeden Server, der nicht in der Konfiguration eingetragen ist.
* **Owner-Präsenzprüfung:** Verlässt den Server sofort, sobald die Owner-ID den Server verlässt, gekickt oder gebannt wird.
* **Anti-Raid:** Join-Schwellenwert mit Scoring, löst bei Überschreitung einen automatischen Lockdown mit Wiederherstellung nach Ablauf aus.
* **Anti-Spam:** Erkennt Nachrichtenrate, Wiederholungen, Mass-Mentions und Spam-Links, reagiert mit Auto-Mute und Löschung.
* **Rollen-Hierarchie-Check:** Moderatoren können, auch über das Dashboard, niemals höher- oder gleichrangige Mitglieder sanktionieren.
* **Vollwertiges Web-Dashboard:** Live-Mitgliederliste, Rollenverwaltung, Willkommens-/Abschiedsnachrichten, Regeln, eigene Befehle und Logs, alles über OAuth2 abgesichert.
* **Eigene Server-Befehle:** Pro Server konfigurierbare Text-Trigger im BotGhost-Stil, ohne Slash-Command-Redeploy.
* **Audit-Logging:** Jede Aktion, ob per Slash-Command oder Dashboard, wird identisch in MongoDB und optional in einem Log-Kanal protokolliert.

---

<h2 id="voraussetzungen"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Voraussetzungen" alt="Typing SVG" /></h2>

| Komponente | Anforderung |
|---|---|
| Node.js | Version 18 oder höher (empfohlen: 20 LTS), [nodejs.org](https://nodejs.org) |
| MongoDB | Version 6 oder höher, lokal oder z.B. [MongoDB Atlas](https://www.mongodb.com/atlas) kostenlos |
| Discord-Bot | Token + Application aus dem [Discord Developer Portal](https://discord.com/developers/applications) |

---

<h2 id="installation"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Installation" alt="Typing SVG" /></h2>

### 1. Abhängigkeiten installieren

```bash
cd discord-security-bot
npm install
```

Das installiert automatisch alle in `package.json` gelisteten Pakete (discord.js, mongoose, express usw., siehe [Pakete](#pakete)).

> [!IMPORTANT]
> Unter **Bot** im [Discord Developer Portal](https://discord.com/developers/applications) müssen diese drei privilegierten Intents aktiviert sein (Schalter auf ON):
> - **Server Members Intent** (für Mitgliederliste und Anti-Raid)
> - **Presence Intent** (für Online-/Idle-/DND-/Offline-Status im Dashboard)
> - **Message Content Intent** (für Anti-Spam und eigene Text-Befehle)

> [!IMPORTANT]
> Unter **OAuth2 → Redirects** muss exakt, inklusive Protokoll, folgender Eintrag stehen:
> ```
> http://localhost:3000/auth/callback
> ```
> (oder deine eigene Domain, falls du den Bot online hostest)

---

<h2 id="konfiguration"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Konfiguration" alt="Typing SVG" /></h2>

```bash
cp .env.example .env
```

Danach folgende Werte ausfüllen: `DISCORD_TOKEN`, `CLIENT_ID`, `CLIENT_SECRET`, `MONGO_URI`, `ALLOWED_GUILDS`, `SESSION_SECRET`. `OWNER_ID` ist bereits voreingestellt.

> [!TIP]
> `ALLOWED_GUILDS` nimmt eine kommagetrennte Liste von Server-IDs entgegen. Nur diese Server darf der Bot betreten, alle anderen verlässt er automatisch wieder.

---

<h2 id="starten"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Starten" alt="Typing SVG" /></h2>

```bash
# Slash-Commands einmalig bei Discord registrieren (nach jeder Command-Änderung erneut ausführen)
npm run deploy

# Bot und Web-Dashboard zusammen starten (ein einziger Prozess, Hot-Reload)
npm run dev
```

Danach im Browser `http://localhost:3000` öffnen und mit Discord einloggen.

> [!TIP]
> Bot und Web-Dashboard laufen im selben Prozess. Ein einziger `npm run dev` Befehl reicht aus, damit das Dashboard live auf Mitglieder, Rollen und Online-Status zugreifen kann.

```bash
# Produktion: erst bauen, dann starten
npm run build
npm start
```

---

<h2 id="dauerbetrieb"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Dauerbetrieb+mit+PM2" alt="Typing SVG" /></h2>

Standardmäßig läuft der Bot nur, solange das Terminal-Fenster (`npm run dev`) offen ist. Für den Dauerbetrieb wird [PM2](https://pm2.keymetrics.io/) genutzt, ein Prozess-Manager, der den Bot:

- im Hintergrund laufen lässt (Terminal oder VS Code kann geschlossen werden)
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

# 4. Aktuellen Stand einfrieren, damit PM2 ihn beim Windows-Start wiederherstellt
pm2 save

# 5. Windows-Autostart für PM2 einrichten
npm install -g pm2-windows-startup
pm2-startup install
```

Ab jetzt startet der Bot automatisch mit, sobald der PC eingeschaltet wird. Ein offenes Terminal ist nicht mehr nötig.

### Nützliche Befehle danach

```bash
npm run service:status    # Zeigt, ob der Bot läuft
npm run service:logs      # Live-Logs ansehen (Strg+C zum Beenden, Bot läuft weiter)
npm run service:restart   # Bot neu starten (z.B. nach Code-Änderungen)
npm run service:stop      # Bot stoppen
```

> [!IMPORTANT]
> Da PM2 die **kompilierte** Version (`dist/`) nutzt, muss nach jeder Code-Änderung neu gebaut und neu gestartet werden:
> ```bash
> npm run build
> npm run service:restart
> ```

> [!TIP]
> Das Web-Dashboard läuft automatisch mit, da es im gleichen Prozess wie der Bot läuft. Es ist weiterhin unter `http://localhost:3000` erreichbar, auch wenn kein Terminal offen ist.

---

<h2 id="dashboard"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Web-Dashboard" alt="Typing SVG" /></h2>

Nach dem Login unter `http://localhost:3000` werden alle Server angezeigt, auf denen "Server verwalten"-Rechte bestehen und der Bot aktiv ist. Pro Server stehen folgende Tabs zur Verfügung:

| Tab | Funktion |
|---|---|
| Übersicht | Mitgliederzahl, Online-Anzahl, Bots, Kanäle, Ränge, Boost-Level |
| Mitglieder | Live-Liste mit Online-Status (online/idle/dnd/offline), Rollen direkt zuweisen oder entfernen, Kick/Ban/Mute/Unmute per Klick |
| Ränge | Ränge erstellen, Farbe und Name bearbeiten, löschen, Mitgliederzahl pro Rang einsehen |
| Willkommen und Abschied | Nachrichtentext mit Platzhaltern (`{user}`, `{username}`, `{server}`, `{memberCount}`), Kanal wählen, Embed an/aus, Live-Vorschau |
| Regeln | Regeltext und Kanal festlegen, als Embed im Kanal posten |
| Eigene Befehle | Wie bei BotGhost: Präfix festlegen (z.B. `!`), eigene Text-Befehle pro Server erstellen, aktivieren oder deaktivieren, Nutzungszähler |
| Logs | Alle Moderations- und Sicherheits-Ereignisse, filterbar nach Typ |
| Einstellungen | Anti-Raid/Anti-Spam an/aus, Schwellenwerte, Log-Kanal, Mod-Rolle, Ticket-Kategorie, Whitelist (nur für den Bot-Owner) |

> [!TIP]
> Alle Aktionen im Dashboard (Kick, Ban, Mute, Rollen zuweisen) laufen über dieselbe `ModerationService`-Logik wie die Slash-Commands und werden identisch geloggt.

### Eigene Befehle (Custom Commands)

Eigene Befehle werden pro Server im Dashboard-Tab "Eigene Befehle" angelegt und funktionieren als Text-Trigger im Chat, ohne dass ein Slash-Command-Redeploy nötig ist:

```
!regeln  →  "Lies dir bitte #regeln durch!"
```

> [!IMPORTANT]
> Reservierte Namen (z.B. `ban`, `kick`, `config`) können nicht überschrieben werden.

---

<h2 id="projektstruktur"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Projektstruktur" alt="Typing SVG" /></h2>

```
src/
  commands/
    admin/
      audit.ts        Audit-Log-Command
      config.ts       Server-Konfiguration einsehen/ändern
      guild.ts        Guild-Infos
      raid.ts         Anti-Raid-Einstellungen
      spam.ts         Anti-Spam-Einstellungen
      toggle.ts       Module an-/ausschalten
    moderation/
      ban.ts
      clear.ts
      kick.ts
      mute.ts
      say.ts
      unban.ts
      warn.ts
    tickets/
      ticket.ts       Ticket-System-Command
  events/             Discord-Event-Handler (guildCreate, messageCreate, ...)
  services/           Kernlogik (Guild, Moderation, Raid, Spam, Logging, Ticket,
                       Welcome, CustomCommand, Member, Role)
  database/           Mongoose-Modelle und Connection
  handlers/           Lädt Commands und Events automatisch
  middleware/         Berechtigungs- und Whitelist-Prüfungen
  utils/              Logger und Helferfunktionen
  client.ts           Singleton, macht den Bot-Client für das Webpanel zugänglich
  config.ts           Zentrale Konfiguration aus .env
  index.ts            Einstiegspunkt, startet Bot und Webpanel im selben Prozess
  deploy-commands.ts  Registriert Slash-Commands bei Discord

webpanel/
  middleware/
    authMiddleware.ts Session-Auth-Guard
  public/             Statisches Frontend (HTML/CSS/Vanilla-JS, kein Build-Schritt nötig)
    css/
      style.css
    js/
      common.js
      dashboard.js
      server.js
    dashboard.html    Server-Übersicht
    index.html        Login/Einstiegsseite
    server.html       Tabbed Admin-Panel (Mitglieder, Ränge, Logs, ...)
  routes/
    auth.ts           OAuth2-Login/Callback
    channels.ts       Kanal-Liste für Dropdowns
    config.ts         Einstellungen (Anti-Raid, Anti-Spam, Mod-Rolle, Whitelist, ...)
    customcommands.ts Eigene Server-Befehle
    guilds.ts         Server-Übersicht des eingeloggten Nutzers
    logs.ts           Moderations- und Sicherheits-Logs
    me.ts             Eingeloggter Nutzer
    members.ts        Live-Mitgliederliste + Aktionen (Kick/Ban/Mute/Rollen)
    roles.ts          Rollenverwaltung
    rules.ts          Regeltext + Kanal
    welcome.ts        Willkommens-/Abschiedsnachrichten
  utils/
    guildAccess.ts    Zugriffsprüfung (OAuth-Berechtigung und Bot-Live-Status)
  config.ts           Webpanel-Konfiguration
  server.ts           Express-Server (wird von src/index.ts gestartet)
  tsconfig.json
```

---

<h2 id="sicherheit"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Sicherheitsmechanismen" alt="Typing SVG" /></h2>

- **Whitelist-Enforcement:** Der Bot verlässt automatisch jeden Server, der nicht in `ALLOWED_GUILDS` steht.
- **Owner-Präsenzprüfung:** Verlässt den Server sofort, wenn die Owner-ID den Server verlässt, gekickt oder gebannt wird.
- **Anti-Raid:** Join-Schwellenwert mit Scoring, löst einen automatischen Lockdown mit Wiederherstellung nach Ablauf aus.
- **Anti-Spam:** Erkennt Nachrichtenrate, Wiederholungen, Mass-Mentions und Spam-Links, reagiert mit Auto-Mute und Löschung.
- **Rollen-Hierarchie-Check:** Moderatoren können, auch über das Dashboard, niemals höher- oder gleichrangige Mitglieder sanktionieren.
- **Dashboard-Zugriff:** Nur Discord-Nutzer mit "Server verwalten"-Berechtigung (per OAuth2 verifiziert) können einen Server sehen oder bearbeiten; die Whitelist selbst kann nur der Bot-Owner ändern.
- **Audit-Logging:** Jede Aktion, ob Slash-Command oder Dashboard, landet in MongoDB und optional in einem konfigurierbaren Log-Kanal.

---

<h2 id="pakete"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Pakete" alt="Typing SVG" /></h2>

| Runtime-Abhängigkeiten | Dev-Abhängigkeiten |
|---|---|
| [discord.js](https://discord.js.org/) | [typescript](https://www.typescriptlang.org/) |
| [@discordjs/rest](https://discord.js.org/) | [ts-node](https://typestrong.org/ts-node/) |
| [mongoose](https://mongoosejs.com/) | ts-node-dev |
| [express](https://expressjs.com/) | @types/node |
| express-session | @types/express |
| [axios](https://axios-http.com/) | @types/express-session |
| cors | @types/cors |
| dotenv | |

> [!TIP]
> Alle Pakete werden automatisch durch `npm install` installiert, eine manuelle Einzelinstallation ist nicht nötig.

---

<h2 id="troubleshooting"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Troubleshooting" alt="Typing SVG" /></h2>

**Allgemein:**

- Wenn ein Skript oder Befehl nicht funktioniert, das Terminal direkt beobachten, um die genaue Fehlermeldung zu sehen.
- Nach jeder Änderung an Slash-Commands muss `npm run deploy` erneut ausgeführt werden, sonst erscheinen die Änderungen nicht in Discord.

**Dashboard:**

- Falls der Login nicht funktioniert, zuerst die Redirect-URI im Discord Developer Portal mit der in `.env` gesetzten `OAUTH2_REDIRECT_URI` vergleichen, beide müssen exakt übereinstimmen.
- Falls Mitglieder- oder Online-Status-Daten im Dashboard fehlen, prüfen, ob die privilegierten Intents (Server Members, Presence, Message Content) im Developer Portal aktiviert sind.

**PM2 / Dauerbetrieb:**

- Wenn der Bot nach einer Code-Änderung nicht reagiert, wurde wahrscheinlich vergessen, `npm run build` und `npm run service:restart` erneut auszuführen.
- Mit `npm run service:logs` lassen sich Startfehler direkt einsehen, ohne den Bot zu stoppen.

> [!IMPORTANT]
> Der Bot-Owner sollte niemals aus der Whitelist oder von `ALLOWED_GUILDS` entfernt werden, ohne vorher eine Alternative einzutragen, da der Bot sonst automatisch den entsprechenden Server verlässt.

---

<h2 id="naechste-schritte"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Naechste+Schritte" alt="Typing SVG" /></h2>

- Bot-Berechtigungen beim Invite-Link mindestens: Ban Members, Kick Members, Moderate Members, Manage Channels, Manage Roles, Manage Messages, View Audit Log.
- Für den Produktionsbetrieb: Reverse-Proxy (z.B. [nginx](https://nginx.org/)) mit HTTPS vor das Dashboard schalten, `SESSION_SECRET` auf einen langen Zufallswert setzen, `NODE_ENV=production`, `OAUTH2_REDIRECT_URI` auf die echte Domain anpassen (und im Developer Portal nachtragen).
- MongoDB-Backups einplanen (`mongodump` per Cron oder über Managed-Service-Backups von [MongoDB Atlas](https://www.mongodb.com/atlas)).

---

<div align="center">

Bitte ließ erst die Lizenz, bevor du den Code benutzt.

</div>