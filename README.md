<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=28&pause=4000&color=68818F&center=true&vCenter=true&repeat=true&width=700&lines=Discord+Sicherheitsbot" alt="Typing SVG" />

</div>

<p align="center">
<a href="https://nodejs.org"><img alt="Node.js" src="https://img.shields.io/badge/Node.js-1f1f1f?style=for-the-badge&logo=nodedotjs&logoColor=1f1f1f&labelColor=68818f&color=1f1f1f"></a>&nbsp;
<a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-1f1f1f?style=for-the-badge&logo=typescript&logoColor=1f1f1f&labelColor=68818f&color=1f1f1f"></a>&nbsp;
<a href="https://discord.js.org/"><img alt="Discord.js" src="https://img.shields.io/badge/discord.js%20v14-1f1f1f?style=for-the-badge&logo=discord&logoColor=1f1f1f&labelColor=68818f&color=1f1f1f"></a>&nbsp;
<a href="https://www.mongodb.com/"><img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-1f1f1f?style=for-the-badge&logo=mongodb&logoColor=1f1f1f&labelColor=68818f&color=1f1f1f"></a>&nbsp;
<a href="https://expressjs.com/"><img alt="Express" src="https://img.shields.io/badge/Express-1f1f1f?style=for-the-badge&logo=express&logoColor=1f1f1f&labelColor=68818f&color=1f1f1f"></a>
</p>

## Was das hier ist

Ich habe diesen Bot gebaut, weil ich einen richtigen, sauberen Sicherheitsbot für Discord haben wollte, nicht irgendeinen Baukasten-Bot mit hundert Servern und generischen Funktionen. Läuft komplett in TypeScript mit discord.js v14, dazu ein eigenes Web-Dashboard, das im selben Prozess wie der Bot läuft, damit beide immer auf denselben Daten und derselben Logik arbeiten.

Der Bot kann Raids und Spam automatisch erkennen und eindämmen, übernimmt die komplette Moderation, hat ein Ticket-System und lässt sich über eigene Text-Befehle pro Server anpassen, ähnlich wie man das von BotGhost kennt.

---

<h2 id="features"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Kernfunktionen" alt="Typing SVG" /></h2>

**Anti-Raid** merkt, wenn plötzlich ungewöhnlich viele Leute in kurzer Zeit joinen, und geht dann automatisch in einen Lockdown, der sich nach Ablauf von selbst wieder aufhebt.

**Anti-Spam** achtet auf Nachrichtenrate, Wiederholungen, Mass-Mentions und Spam-Links und reagiert direkt mit Mute und Löschen der Nachrichten.

**Rollen-Hierarchie** wird konsequent durchgesetzt, auch über das Dashboard: Ein Moderator kann niemanden sanktionieren, der eine höhere oder gleichrangige Rolle hat.

**Das Web-Dashboard** zeigt Mitglieder live mit Online-Status, lässt Rollen direkt zuweisen oder entfernen, Kick/Ban/Mute per Klick ausführen, Willkommens- und Abschiedsnachrichten einstellen, Regeln posten und alle Logs durchsuchen, alles abgesichert über OAuth2.

**Eigene Server-Befehle** kann sich jeder Server selbst anlegen, ohne dass dafür ein Slash-Command-Redeploy nötig wäre.

**Ein Ticket-System** ist ebenfalls dabei, mit eigener Kategorie-Verwaltung.

Und jede einzelne Aktion, egal ob per Slash-Command oder über das Dashboard ausgelöst, wird identisch in MongoDB protokolliert und optional zusätzlich in einen Log-Kanal gepostet.

---

<h2 id="dashboard"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Web-Dashboard" alt="Typing SVG" /></h2>

Das Dashboard ist in Tabs aufgeteilt, jeder deckt einen Bereich ab:

| Tab | Was man dort macht |
|---|---|
| Übersicht | Mitgliederzahl, Online-Anzahl, Bots, Kanäle, Ränge, Boost-Level auf einen Blick |
| Mitglieder | Live-Liste mit Online-Status, Rollen direkt zuweisen oder entziehen, Kick/Ban/Mute/Unmute |
| Ränge | Ränge anlegen, Farbe und Name ändern, löschen |
| Willkommen und Abschied | Nachrichtentext mit Platzhaltern, Kanal wählen, Embed an/aus, Live-Vorschau |
| Regeln | Regeltext und Kanal festlegen, direkt als Embed posten |
| Eigene Befehle | Präfix festlegen, Befehle pro Server anlegen, aktivieren oder deaktivieren |
| Logs | Alle Moderations- und Sicherheits-Ereignisse, nach Typ filterbar |
| Einstellungen | Anti-Raid/Anti-Spam an- und ausschalten, Schwellenwerte, Log-Kanal, Mod-Rolle, Ticket-Kategorie |

Wichtig dabei: Egal ob man Kick, Ban, Mute oder eine Rollenzuweisung über das Dashboard oder per Command auslöst, im Hintergrund läuft immer dieselbe Moderations-Logik. Es gibt also keine zwei verschiedenen Wege, die sich unterschiedlich verhalten.

---

<h2 id="projektstruktur"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Projektstruktur" alt="Typing SVG" /></h2>

```
src/
  commands/
    admin/          Config, Guild-Infos, Anti-Raid/Anti-Spam-Einstellungen
    moderation/     Ban, Kick, Mute, Warn, Clear, Say
    tickets/        Ticket-System-Command
  events/           Discord-Event-Handler
  services/         Kernlogik (Guild, Moderation, Raid, Spam, Logging, Ticket, ...)
  database/         Mongoose-Modelle und Connection
  handlers/         Lädt Commands und Events automatisch
  middleware/       Berechtigungs- und Whitelist-Prüfungen
  utils/            Logger und Helferfunktionen
  client.ts         Singleton, macht den Bot-Client für das Webpanel zugänglich
  index.ts          Einstiegspunkt, startet Bot und Webpanel im selben Prozess

webpanel/
  middleware/       Session-Auth-Guard
  public/           Frontend (HTML/CSS/Vanilla-JS)
  routes/           Auth, Mitglieder, Rollen, Logs, Konfiguration, eigene Befehle
  utils/            Zugriffsprüfung (OAuth-Berechtigung, Bot-Live-Status)
  server.ts         Express-Server
```

---

<h2 id="sicherheit"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Sicherheitskonzept" alt="Typing SVG" /></h2>

Ein paar Dinge, auf die ich beim Bauen besonders geachtet habe:

Der Bot läuft ausschließlich auf Servern, die vorher fest eingetragen wurden, alles andere verlässt er von selbst. Bei Raids greift automatisch der Lockdown, bei Spam Mute und Löschung. Die Rollen-Hierarchie wird an jeder Stelle geprüft, auch im Dashboard, damit niemand über seine eigentliche Berechtigung hinaus handeln kann. Zugriff auf das Dashboard hat wirklich nur, wer auf dem jeweiligen Server auch "Server verwalten"-Rechte besitzt, geprüft über OAuth2. Und jede Aktion wird nachvollziehbar geloggt.

---

<h2 id="pakete"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=32&pause=4000&color=68818F&center=false&vCenter=false&repeat=true&width=900&lines=Tech-Stack" alt="Typing SVG" /></h2>

| Backend | Weitere |
|---|---|
| [discord.js](https://discord.js.org/) v14 | [TypeScript](https://www.typescriptlang.org/) |
| [@discordjs/rest](https://discord.js.org/) | [Express](https://expressjs.com/) |
| [Mongoose](https://mongoosejs.com/) / MongoDB | express-session, OAuth2 |
| [axios](https://axios-http.com/) | dotenv, cors |

---

<div align="center">

Bitte lies erst die [Lizenz](https://github.com/Lelus1988/discord-security-bot/blob/main/.LICENSE), bevor du den Code benutzt.

</div>
