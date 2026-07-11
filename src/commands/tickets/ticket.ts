import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  AttachmentBuilder,
  ContainerBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  GuildMember,
  TextChannel,
  CategoryChannel,
  OverwriteResolvable,
  ButtonInteraction,
  UserSelectMenuInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  Interaction,
  Message,
  Collection,
  Guild,
} from 'discord.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { BotCommand, ExtendedClient } from '../../types';
import { guardCommand, replyError } from '../../middleware/permissions';
export { initTicketSystem };

/* ============================================================================================
 *  TICKET SYSTEM – vollständige Neuentwicklung, eine einzige Datei (ticketpanel.ts)
 * ============================================================================================
 *  Inhalt (per Inhaltsverzeichnis unten, per Suche/Faltung leicht navigierbar):
 *   1. Konfiguration          – die einzige Stelle, die zur Anpassung bearbeitet werden muss
 *   2. Typen & Enums
 *   3. Persistenz             – JSON-Datei statt fragilem Channel-Topic-Parsing
 *   4. Hilfsfunktionen        – Berechtigungen, Cooldowns/Limits, Sanitizing
 *   5. UI-Bausteine           – Panel & Ticket-Steuerung (Components V2: mehrere einzelne
 *                               "Boxen" (Container) direkt untereinander, so wie im
 *                               Referenz-Screenshot: Kopf-Box -> Buttons-Box -> Bild/GIF-Box)
 *   6. Transcript & Logging
 *   7. Ticket-Lifecycle       – erstellen, claimen, hinzufügen/entfernen, Priorität, schließen,
 *                               wieder öffnen, archivieren, löschen, exportieren
 *   8. Interaktions-Handler   – Buttons, Select-Menus, Modals
 *   9. Auto-Delete-Sweep      – überlebt Bot-Neustarts, da Zeitpunkt persistiert wird
 *  10. Slash-Command          – /ticketpanel send | stats  (einziger Command, nur für Admins)
 *
 *  WICHTIG – Einmalige Einrichtung:
 *   Beim ersten Ausführen von /ticketpanel registriert sich das System selbstständig am
 *   Client (initTicketSystem). Nutzer benötigen danach KEINE Commands mehr – das gesamte
 *   System ist ab hier vollständig buttonbasiert.
 *
 *  HINWEIS zu Components V2 (SectionBuilder / ThumbnailBuilder / MediaGalleryBuilder):
 *   Diese Builder wurden erst mit den neueren discord.js-Versionen eingeführt. Da diese
 *   Datei ContainerBuilder/TextDisplayBuilder bereits nutzt, sollte deine discord.js-Version
 *   passen – falls beim Build Fehler zu genau diesen Klassen auftreten, bitte kurz
 *   `npm ls discord.js` prüfen und ggf. aktualisieren.
 * ==========================================================================================*/

// ================================================================================================
// 1. KONFIGURATION
// ================================================================================================

enum TicketStatus {
  Open = 'open',
  Closed = 'closed',
}

enum TicketPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

const PRIORITY_META: Record<TicketPriority, { label: string; emoji: string }> = {
  [TicketPriority.Low]: { label: 'Niedrig', emoji: '🟢' },
  [TicketPriority.Medium]: { label: 'Normal', emoji: '🟡' },
  [TicketPriority.High]: { label: 'Hoch', emoji: '🟠' },
  [TicketPriority.Urgent]: { label: 'Dringend', emoji: '🔴' },
};

interface TicketIntakeQuestion {
  id: string;
  label: string;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  paragraph?: boolean;
  required?: boolean;
}

interface TicketCategoryConfig {
  /** Eindeutige, stabile ID. Wird in Button-CustomIds & im Speicher verwendet – niemals ändern, nur ergänzen. */
  id: string;
  label: string;
  /** Leer lassen ('') für kein Emoji auf dem Button. Es funktionieren sowohl normale Unicode-Emojis
   *  ('🎫') als auch eigene Server-Emojis im Format '<:name:id>' bzw. '<a:name:id>' für animierte.
   *  So bekommst du das Format: in einem beliebigen Discord-Textfeld "\:emojiname:" tippen und
   *  senden (Backslash davor!) – Discord zeigt dir dann den Rohcode, den du hier einfügen kannst. */
  emoji: string;
  buttonStyle: ButtonStyle;
  channelPrefix: string;
  /** Zusätzliche Rollen-IDs mit Zugriff (zusätzlich zu GLOBAL_STAFF_ROLE_IDS). */
  staffRoleIds: string[];
  welcomeTitle: string;
  welcomeIntro: string;
  color: number;
  /** Optionales Abfrage-Formular vor Ticket-Erstellung. Leer/undefined = Ticket wird sofort erstellt. */
  intakeQuestions?: TicketIntakeQuestion[];
}

interface TicketGroupConfig {
  id: string;
  title: string;
  /** Leer lassen ('') für kein Emoji in der Überschrift. */
  emoji: string;
  description: string;
  categories: TicketCategoryConfig[];
}

/**
 * Zentrale Konfiguration. Neue Kategorien werden einfach als weiteres Objekt in der
 * passenden Gruppe ergänzt – Buttons, Berechtigungen, Modal, Begrüßung und Statistik
 * funktionieren danach automatisch, ohne dass an anderer Stelle Code angepasst werden muss.
 *
 * Aktuell bewusst schlank gehalten (4 Buttons in 2 Gruppen), passend zu einem normalen
 * Community-Server – genau wie im Referenz-Screenshot gewünscht.
 */
const TICKET_CONFIG = {
  logChannelId: '1521940477065171044',
  openTicketsCategoryId: '',
  archivedTicketsCategoryId: '',
  globalStaffRoleIds: ['1511042265055760516'] as string[],
  maxOpenTicketsPerUser: 3,
  creationCooldownSeconds: 60,
  /** 0 = kein automatisches Löschen. Ein geschlossenes Ticket bleibt dann so lange bestehen,
   *  bis ein Mod es aktiv über den "Endgültig löschen"-Button entfernt. Wenn du doch eine
   *  automatische Löschung nach X Stunden willst, hier einfach eine Zahl > 0 eintragen. */
  autoDeleteAfterHours: 0,
  manualDeleteDelaySeconds: 5,

  panel: {
    heading: 'Wie können wir dir helfen?',
    intro:
      'Willkommen in unserem Support! Wenn du Fragen oder Anliegen hast, kannst du unten ganz einfach ein Ticket eröffnen, um unser Team zu kontaktieren.',
    /** Kurze Stichpunkte unter dem Intro-Text (wie im Referenzbild). Leeres Array = keine Stichpunkte anzeigen. */
    infoPoints: [
      'Unser Team antwortet in der Regel innerhalb von 24 Stunden',
      'Tickets ohne Inhalt werden nach 24 Stunden automatisch gelöscht ❗',
    ],
    /** Farbige Randleiste am linken Rand der Boxen (blurple wie im Bild). 0 = keine Randleiste. */
    accentColor: 0x5865f2,
    footer: 'Bitte erstelle nur ein Ticket pro Anliegen · Missbrauch führt zum Ausschluss',
    /** Optionales kleines Bild rechts neben der Überschrift (z. B. Server-Icon). Leer lassen für keins. */
    thumbnailUrl: '',
    /** Bild- oder GIF-Link für die eigene Box ganz unten im Panel. Einfach die URL eintragen,
     *  z. B. 'https://i.imgur.com/beispiel.gif'. Leer lassen ('') um den Bereich auszublenden. */
    bottomMediaUrl: '',
  },

  groups: [
    {
      id: 'support',
      title: 'Support',
      emoji: '',
      description: 'Bei Fragen, Problemen oder wenn dir etwas nicht funktioniert, kannst du hier ein Ticket erstellen.',
      categories: [
        {
          id: 'support-general',
          label: 'Support',
          // Server-Emoji eintragen möglich, z. B. '<:ticket:1234567890123456789>' (siehe Hinweis unten).
          emoji: '',
          buttonStyle: ButtonStyle.Primary,
          channelPrefix: 'support',
          staffRoleIds: ['1511042265055760516', '1511788872244133928'],
          welcomeTitle: 'Support-Ticket',
          welcomeIntro: 'Willkommen! Bitte beschreibe dein Anliegen so genau wie möglich – unser Team meldet sich in Kürze.',
          color: 0x5865f2,
          intakeQuestions: [
            { id: 'subject', label: 'Kurzer Betreff', placeholder: 'z. B. Problem beim Login', maxLength: 75, required: true },
            { id: 'description', label: 'Beschreibe dein Anliegen', paragraph: true, maxLength: 1024, required: true },
          ],
        },
        {
          id: 'support-bug',
          label: 'Bug melden',
          emoji: '',
          buttonStyle: ButtonStyle.Primary,
          channelPrefix: 'bug',
          staffRoleIds: ['1511042265055760516', '1511788872244133928'],
          welcomeTitle: 'Bug-Meldung',
          welcomeIntro: 'Willkommen! Bitte beschreibe den Fehler sowie die Schritte, um ihn zu reproduzieren.',
          color: 0x5865f2,
          intakeQuestions: [
            { id: 'subject', label: 'Kurzbeschreibung des Bugs', maxLength: 75, required: true },
            { id: 'description', label: 'Wie kann der Bug reproduziert werden?', paragraph: true, maxLength: 1024, required: true },
          ],
        },
      ],
    },
    {
      id: 'apply',
      title: 'Bewerbungen & Partner',
      emoji: '',
      description: 'Bewirb dich für unser Team oder stelle eine Partnerschaftsanfrage.',
      categories: [
        {
          id: 'application-team',
          label: 'Team-Bewerbung',
          emoji: '',
          buttonStyle: ButtonStyle.Primary,
          channelPrefix: 'bewerbung',
          staffRoleIds: ['1511736871036915873'],
          welcomeTitle: 'Team-Bewerbung',
          welcomeIntro: 'Willkommen zu deiner Bewerbung! Bitte teile uns Alter, Zeitzone und Erfahrung mit.',
          color: 0x2ecc71,
        },
        {
          id: 'partnership-general',
          label: 'Partner',
          emoji: '',
          buttonStyle: ButtonStyle.Primary,
          channelPrefix: 'partner',
          staffRoleIds: ['1519758551222980789'],
          welcomeTitle: 'Partnerschaftsanfrage',
          welcomeIntro: 'Willkommen! Bitte nenne uns Projekt/Server, Mitgliederzahl sowie euren Vorschlag.',
          color: 0x1abc9c,
        },
      ],
    },
  ] as TicketGroupConfig[],
};

function getAllCategories(): { group: TicketGroupConfig; category: TicketCategoryConfig }[] {
  return TICKET_CONFIG.groups.flatMap(group => group.categories.map(category => ({ group, category })));
}

function findCategory(categoryId: string): { group: TicketGroupConfig; category: TicketCategoryConfig } | null {
  return getAllCategories().find(entry => entry.category.id === categoryId) ?? null;
}

// ================================================================================================
// 2. TYPEN
// ================================================================================================

interface TicketRecord {
  channelId: string;
  number: number;
  guildId: string;
  ownerId: string;
  groupId: string;
  categoryId: string;
  status: TicketStatus;
  priority: TicketPriority;
  handlerId: string | null;
  additionalUserIds: string[];
  subject: string | null;
  controlMessageId: string | null;
  createdAt: number;
  claimedAt: number | null;
  closedAt: number | null;
  closedBy: string | null;
  archivedAt: number | null;
  /** Unix-Timestamp (ms), ab dem der Channel automatisch gelöscht werden darf. null = kein Auto-Delete. */
  deleteAt: number | null;
}

interface GuardResult {
  allowed: boolean;
  reason?: string;
}

interface PersistedData {
  tickets: Record<string, TicketRecord>;
  nextTicketNumber: number;
  /** userId -> Unix-Timestamp (ms) der letzten Ticket-Erstellung, für den Cooldown. */
  lastCreationByUser: Record<string, number>;
  /** Ziel-Channel-ID -> Message-ID des aktuell aktiven Panels, um es zu aktualisieren statt zu duplizieren. */
  panelMessages: Record<string, string>;
}

// ================================================================================================
// 3. PERSISTENZ
// ================================================================================================
//  Ersetzt das ursprüngliche "Daten im Channel-Topic verstecken"-Muster durch eine echte,
//  neustart-feste JSON-Datei. Schreibzugriffe laufen über eine einfache Warteschlange
//  (Mutex), damit parallele Interaktionen sich nicht gegenseitig überschreiben.
// ================================================================================================

const DATA_FILE = path.join(process.cwd(), 'data', 'tickets.json');

class TicketStore {
  private data: PersistedData = {
    tickets: {},
    nextTicketNumber: 1,
    lastCreationByUser: {},
    panelMessages: {},
  };
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf-8');
      this.data = { ...this.data, ...JSON.parse(raw) };
    } catch {
      // Datei existiert noch nicht -> mit Standardwerten starten.
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      await fs.writeFile(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    });
    await this.writeQueue;
  }

  getTicket(channelId: string): TicketRecord | null {
    return this.data.tickets[channelId] ?? null;
  }

  getOpenTicketsByOwner(ownerId: string): TicketRecord[] {
    return Object.values(this.data.tickets).filter(t => t.ownerId === ownerId && t.status === TicketStatus.Open);
  }

  getOpenTicketByOwnerAndCategory(ownerId: string, categoryId: string): TicketRecord | null {
    return (
      Object.values(this.data.tickets).find(
        t => t.ownerId === ownerId && t.categoryId === categoryId && t.status === TicketStatus.Open
      ) ?? null
    );
  }

  async createTicket(base: Omit<TicketRecord, 'number'>): Promise<TicketRecord> {
    const record: TicketRecord = { ...base, number: this.data.nextTicketNumber };
    this.data.nextTicketNumber += 1;
    this.data.tickets[record.channelId] = record;
    this.data.lastCreationByUser[record.ownerId] = record.createdAt;
    await this.persist();
    return record;
  }

  async updateTicket(channelId: string, patch: Partial<TicketRecord>): Promise<TicketRecord | null> {
    const existing = this.data.tickets[channelId];
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.data.tickets[channelId] = updated;
    await this.persist();
    return updated;
  }

  async deleteTicket(channelId: string): Promise<void> {
    delete this.data.tickets[channelId];
    await this.persist();
  }

  getLastCreationTimestamp(userId: string): number | null {
    return this.data.lastCreationByUser[userId] ?? null;
  }

  getPanelMessageId(targetChannelId: string): string | null {
    return this.data.panelMessages[targetChannelId] ?? null;
  }

  async setPanelMessageId(targetChannelId: string, messageId: string): Promise<void> {
    this.data.panelMessages[targetChannelId] = messageId;
    await this.persist();
  }

  getTicketsDueForDeletion(now: number): TicketRecord[] {
    return Object.values(this.data.tickets).filter(t => t.deleteAt !== null && t.deleteAt <= now);
  }

  getAllTickets(): TicketRecord[] {
    return Object.values(this.data.tickets);
  }

  /** Nächste Ticket-Nummer, ohne sie zu vergeben – nur zur Anzeige (z. B. im Channel-Namen). */
  peekNextNumber(): number {
    return this.data.nextTicketNumber;
  }
}

const store = new TicketStore();

// ------------------------------------------------------------------------------------------------
//  Archiv-Datenbank für endgültig gelöschte Tickets. Läuft komplett unabhängig von tickets.json:
//  Sobald ein Mod ein Ticket "endgültig löscht" (oder das Auto-Delete-Sweep zuschlägt, falls
//  aktiviert), wird hier der komplette Nachrichtenverlauf + alle Ticket-Infos dauerhaft als
//  eigener Eintrag gespeichert – auch wenn der Discord-Channel danach weg ist.
// ------------------------------------------------------------------------------------------------

const ARCHIVE_FILE = path.join(process.cwd(), 'data', 'tickets-archive.json');

interface ArchivedMessage {
  author: string;
  authorId: string;
  timestamp: string;
  content: string;
  attachments: { name: string | null; url: string }[];
}

interface ArchivedTicketRecord {
  ticket: TicketRecord;
  channelName: string;
  archivedAt: number;
  /** User-ID des Mods, der endgültig gelöscht hat, oder 'system' bei automatischer Löschung. */
  deletedBy: string;
  messages: ArchivedMessage[];
}

let archiveWriteQueue: Promise<void> = Promise.resolve();

async function appendToArchive(entry: ArchivedTicketRecord): Promise<void> {
  archiveWriteQueue = archiveWriteQueue.then(async () => {
    let existing: ArchivedTicketRecord[] = [];
    try {
      const raw = await fs.readFile(ARCHIVE_FILE, 'utf-8');
      existing = JSON.parse(raw);
    } catch {
      // Datei existiert noch nicht -> mit leerem Archiv starten.
    }
    existing.push(entry);
    await fs.mkdir(path.dirname(ARCHIVE_FILE), { recursive: true });
    await fs.writeFile(ARCHIVE_FILE, JSON.stringify(existing, null, 2), 'utf-8');
  });
  await archiveWriteQueue;
}

// ================================================================================================
// 4. HILFSFUNKTIONEN – Berechtigungen, Cooldowns/Limits, Sanitizing
// ================================================================================================

function sanitizeName(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20) || 'user'
  );
}

function formatChannelName(category: TicketCategoryConfig, ticketNumber: number): string {
  return `${category.channelPrefix}-${String(ticketNumber).padStart(4, '0')}`;
}

/** Hängt ein Emoji nur an, wenn eines gesetzt ist – so bleiben Texte ohne Emoji sauber ohne doppelte Leerzeichen. */
function formatLabel(emoji: string, text: string): string {
  return emoji ? `${emoji} ${text}` : text;
}

function buildPermissionOverwrites(guild: Guild, member: GuildMember, category: TicketCategoryConfig): OverwriteResolvable[] {
  const overwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  const staffRoleIds = [...TICKET_CONFIG.globalStaffRoleIds, ...category.staffRoleIds].filter(Boolean);
  for (const roleId of staffRoleIds) {
    overwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
      ],
    });
  }

  return overwrites;
}

/** Prüft, ob der Channel eines gespeicherten Tickets noch wirklich existiert. Falls nicht (z. B. weil
 *  jemand den Channel manuell in Discord gelöscht hat, statt den Löschen-Button zu benutzen), wird der
 *  verwaiste Eintrag automatisch aus dem Speicher entfernt. Das behebt das "#unbekannt"-Problem, bei
 *  dem der Bot ein längst nicht mehr existierendes Ticket noch als offen führt. */
async function reconcileTicket(guild: Guild, ticket: TicketRecord): Promise<boolean> {
  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  if (!channel) {
    await store.deleteTicket(ticket.channelId);
    return false;
  }
  return true;
}

/** Prüft Cooldown, Ticket-Limit und Duplikat-Schutz, bevor ein neues Ticket erstellt werden darf. */
async function guardTicketCreation(guild: Guild, ownerId: string, categoryId: string): Promise<GuardResult> {
  const duplicate = store.getOpenTicketByOwnerAndCategory(ownerId, categoryId);
  if (duplicate) {
    const stillExists = await reconcileTicket(guild, duplicate);
    if (stillExists) {
      return { allowed: false, reason: `⚠️ Du hast bereits ein offenes Ticket dieser Art: <#${duplicate.channelId}>` };
    }
  }

  const openTickets = store.getOpenTicketsByOwner(ownerId);
  let openCount = 0;
  for (const ticket of openTickets) {
    if (ticket.channelId === duplicate?.channelId) continue; // wurde oben bereits geprüft und als verwaist entfernt
    if (await reconcileTicket(guild, ticket)) openCount += 1;
  }
  if (openCount >= TICKET_CONFIG.maxOpenTicketsPerUser) {
    return {
      allowed: false,
      reason: `⚠️ Du hast bereits die maximale Anzahl offener Tickets erreicht (${TICKET_CONFIG.maxOpenTicketsPerUser}).`,
    };
  }

  const lastCreation = store.getLastCreationTimestamp(ownerId);
  if (lastCreation !== null) {
    const secondsSince = (Date.now() - lastCreation) / 1000;
    if (secondsSince < TICKET_CONFIG.creationCooldownSeconds) {
      const remaining = Math.ceil(TICKET_CONFIG.creationCooldownSeconds - secondsSince);
      return { allowed: false, reason: `⏳ Bitte warte noch ${remaining} Sekunde(n), bevor du ein neues Ticket erstellst.` };
    }
  }

  return { allowed: true };
}

function isStaffMember(member: GuildMember, category?: TicketCategoryConfig): boolean {
  const relevantRoleIds = [...TICKET_CONFIG.globalStaffRoleIds, ...(category?.staffRoleIds ?? [])];
  return member.permissions.has(PermissionFlagsBits.Administrator) || relevantRoleIds.some(id => member.roles.cache.has(id));
}

// ================================================================================================
// 5. UI-BAUSTEINE (Discord Components V2)
// ================================================================================================
//  Das Panel besteht jetzt bewusst aus MEHREREN einzelnen Containern (statt einem großen),
//  damit optisch wirklich getrennte "Boxen" entstehen – exakt wie im Referenz-Screenshot:
//   1. Kopf-Box    – Überschrift + Intro (+ optionales Thumbnail rechts)
//   2. Buttons-Box – alle Gruppen mit ihren Buttons, innerhalb dieser einen Box nur
//                    durch Abstand getrennt (keine Linie), so wie im Bild
//   3. Bild/GIF-Box – nur vorhanden, wenn eine bottomMediaUrl gesetzt ist
//  Alle drei werden zusammen in EINER Nachricht gesendet.
// ================================================================================================

function buildCategoryButton(category: TicketCategoryConfig): ButtonBuilder {
  const button = new ButtonBuilder()
    .setCustomId(`ticket_open_${category.id}`)
    .setLabel(category.label)
    .setStyle(category.buttonStyle);
  if (category.emoji) button.setEmoji(category.emoji);
  return button;
}

/** Teilt eine Liste von Buttons in Reihen mit maximal 2 Buttons auf (gewünschtes Panel-Layout). */
function chunkButtonsIntoRows(buttons: ButtonBuilder[], perRow = 2): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += perRow) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + perRow)));
  }
  return rows;
}

/** Box 1: Überschrift + Intro, optional mit kleinem Thumbnail rechts (z. B. Server-Icon). */
function buildHeaderContainer(): ContainerBuilder {
  const container = new ContainerBuilder();
  if (TICKET_CONFIG.panel.accentColor) container.setAccentColor(TICKET_CONFIG.panel.accentColor);

  const infoLines =
    TICKET_CONFIG.panel.infoPoints.length > 0
      ? '\n\n' + TICKET_CONFIG.panel.infoPoints.map(point => `- ${point}`).join('\n')
      : '';
  const headingText = new TextDisplayBuilder().setContent(
    `# ${TICKET_CONFIG.panel.heading}\n${TICKET_CONFIG.panel.intro}${infoLines}`
  );

  if (TICKET_CONFIG.panel.thumbnailUrl) {
    const section = new SectionBuilder()
      .addTextDisplayComponents(headingText)
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(TICKET_CONFIG.panel.thumbnailUrl));
    container.addSectionComponents(section);
  } else {
    container.addTextDisplayComponents(headingText);
  }

  return container;
}

/** Box 2: alle Gruppen mit ihren Buttons, innerhalb der Box nur durch Abstand getrennt. */
function buildButtonsContainer(): ContainerBuilder {
  const container = new ContainerBuilder();
  if (TICKET_CONFIG.panel.accentColor) container.setAccentColor(TICKET_CONFIG.panel.accentColor);

  TICKET_CONFIG.groups.forEach((group, index) => {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ${formatLabel(group.emoji, group.title)}\n> ${group.description}`)
    );

    const rows = chunkButtonsIntoRows(group.categories.map(buildCategoryButton));
    for (const row of rows) {
      container.addActionRowComponents(row);
    }

    const isLast = index === TICKET_CONFIG.groups.length - 1;
    if (!isLast) {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Large));
    }
  });

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${TICKET_CONFIG.panel.footer} · Stand: <t:${Math.floor(Date.now() / 1000)}:R>`)
  );

  return container;
}

/** Box 3: Bild/GIF ganz unten – nur wenn panel.bottomMediaUrl gesetzt ist. */
function buildMediaContainer(): ContainerBuilder | null {
  if (!TICKET_CONFIG.panel.bottomMediaUrl) return null;
  const container = new ContainerBuilder();
  const gallery = new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL(TICKET_CONFIG.panel.bottomMediaUrl)
  );
  container.addMediaGalleryComponents(gallery);
  return container;
}

function buildPanelComponents(): { components: ContainerBuilder[]; flags: number } {
  const components: ContainerBuilder[] = [buildHeaderContainer(), buildButtonsContainer()];
  const mediaContainer = buildMediaContainer();
  if (mediaContainer) components.push(mediaContainer);
  return { components, flags: MessageFlags.IsComponentsV2 };
}

function buildTicketInfoText(ticket: TicketRecord, category: TicketCategoryConfig, group: TicketGroupConfig): string {
  const priority = PRIORITY_META[ticket.priority];
  const lines = [
    `${category.welcomeTitle}`,
    '',
    category.welcomeIntro,
    '',
    `> **Kategorie:** ${formatLabel(group.emoji, group.title)} — ${formatLabel(category.emoji, category.label)}`,
    `> **Ersteller:** <@${ticket.ownerId}>`,
    `> **Erstellt:** <t:${Math.floor(ticket.createdAt / 1000)}:F>`,
    `> **Status:** ${ticket.status === TicketStatus.Open ? '🟢 Offen' : '🔒 Geschlossen'}`,
    `> **Priorität:** ${priority.emoji} ${priority.label}`,
    `> **Bearbeiter:** ${ticket.handlerId ? `<@${ticket.handlerId}>` : 'Noch niemand'}`,
    `> **Ticket-Nummer:** #${String(ticket.number).padStart(4, '0')}`,
  ];
  if (ticket.subject) lines.splice(3, 0, `> **Betreff:** ${ticket.subject}`);
  return lines.join('\n');
}

function buildTicketControlComponents(ticket: TicketRecord): ActionRowBuilder<ButtonBuilder>[] {
  if (ticket.status === TicketStatus.Open) {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel(ticket.handlerId ? 'Beansprucht' : 'Beanspruchen')
        .setEmoji('🙋')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(Boolean(ticket.handlerId)),
      new ButtonBuilder().setCustomId('ticket_priority').setLabel('Priorität').setEmoji('🚦').setStyle(ButtonStyle.Secondary)
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket_add_user').setLabel('Nutzer hinzufügen').setEmoji('➕').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_remove_user').setLabel('Nutzer entfernen').setEmoji('➖').setStyle(ButtonStyle.Secondary)
    );
    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket_transcript').setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_close').setLabel('Schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger)
    );
    return [row1, row2, row3];
  }

  const closedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket_reopen').setLabel('Wieder öffnen').setEmoji('🔓').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_transcript').setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_delete').setLabel('Endgültig löschen').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
  return [closedRow];
}

function buildTicketControlContent(ticket: TicketRecord): { components: ContainerBuilder[]; flags: number } {
  const { category, group } = findCategory(ticket.categoryId)!;
  const container = new ContainerBuilder().setAccentColor(category.color);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(buildTicketInfoText(ticket, category, group)));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  for (const row of buildTicketControlComponents(ticket)) {
    container.addActionRowComponents(row);
  }
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildCloseConfirmRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Ja, schließen').setEmoji('✅').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Abbrechen').setEmoji('✖️').setStyle(ButtonStyle.Secondary)
  );
}

function buildDeleteConfirmRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket_delete_confirm').setLabel('Ja, endgültig löschen').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_delete_cancel').setLabel('Abbrechen').setEmoji('✖️').setStyle(ButtonStyle.Secondary)
  );
}

function buildPriorityMenuRow(): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_priority_select')
    .setPlaceholder('Neue Priorität wählen')
    .addOptions(
      Object.entries(PRIORITY_META).map(([value, meta]) =>
        new StringSelectMenuOptionBuilder().setLabel(meta.label).setEmoji(meta.emoji).setValue(value)
      )
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

// ================================================================================================
// 6. TRANSCRIPT & LOGGING
// ================================================================================================

async function fetchAllMessages(channel: TextChannel): Promise<Message[]> {
  const all: Message[] = [];
  let lastId: string | undefined;
  while (true) {
    const batch: Collection<string, Message> = await channel.messages.fetch({ limit: 100, before: lastId });
    if (batch.size === 0) break;
    all.push(...batch.values());
    lastId = batch.last()?.id;
    if (batch.size < 100) break;
  }
  return all.reverse();
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function generateHtmlTranscript(channel: TextChannel): Promise<Buffer> {
  const messages = await fetchAllMessages(channel);
  const rows = messages
    .map(msg => {
      const time = new Date(msg.createdTimestamp).toLocaleString('de-DE');
      const attachments = msg.attachments
        .map(a => `<div class="attachment"><a href="${a.url}" target="_blank">${escapeHtml(a.name ?? 'Anhang')}</a></div>`)
        .join('');
      return `<div class="message">
        <div class="meta"><span class="author">${escapeHtml(msg.author.tag)}</span> <span class="time">${time}</span></div>
        <div class="content">${escapeHtml(msg.content || '')}</div>
        ${attachments}
      </div>`;
    })
    .join('\n');

  return Buffer.from(
    `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8" /><title>Transcript – ${escapeHtml(channel.name)}</title>
    <style>
      body{background:#313338;color:#dbdee1;font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:24px;}
      h1{color:#fff;} .message{border-bottom:1px solid #3f4147;padding:10px 0;}
      .meta{font-size:12px;color:#949ba4;margin-bottom:4px;} .author{font-weight:600;color:#fff;margin-right:8px;}
      .content{white-space:pre-wrap;word-break:break-word;} .attachment a{color:#00a8fc;}
    </style></head><body>
      <h1>Transcript: #${escapeHtml(channel.name)}</h1>
      <p>Erstellt am ${new Date().toLocaleString('de-DE')}</p>
      ${rows}
    </body></html>`,
    'utf-8'
  );
}

async function generateJsonExport(ticket: TicketRecord, channel: TextChannel): Promise<Buffer> {
  const messages = await fetchAllMessages(channel);
  const payload = {
    ticket,
    channelName: channel.name,
    exportedAt: new Date().toISOString(),
    messages: messages.map(m => ({
      author: m.author.tag,
      authorId: m.author.id,
      timestamp: new Date(m.createdTimestamp).toISOString(),
      content: m.content,
      attachments: m.attachments.map(a => ({ name: a.name, url: a.url })),
    })),
  };
  return Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
}

async function logToChannel(
  guild: Guild,
  options: { title: string; color: number; description?: string; fields: { name: string; value: string; inline?: boolean }[]; files?: AttachmentBuilder[] }
): Promise<void> {
  if (!TICKET_CONFIG.logChannelId) return;
  const logChannel = await guild.channels.fetch(TICKET_CONFIG.logChannelId).catch(() => null);
  if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

  const container = new ContainerBuilder().setAccentColor(options.color);
  const fieldText = options.fields.map(f => `**${f.name}:** ${f.value}`).join('\n');
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${options.title}\n${options.description ?? ''}\n${fieldText}\n-# <t:${Math.floor(Date.now() / 1000)}:F>`
    )
  );

  await (logChannel as TextChannel).send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    files: options.files ?? [],
  });
}

// ================================================================================================
// 7. TICKET-LIFECYCLE
// ================================================================================================

async function createTicketChannel(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  category: TicketCategoryConfig,
  group: TicketGroupConfig,
  intakeAnswers: Record<string, string> | null
): Promise<void> {
  const subject = intakeAnswers?.subject ?? null;
  const guild = interaction.guild;
  const member = interaction.member as GuildMember;
  if (!guild || !member) return;

  await interaction.deferReply({ ephemeral: true });

  const guardResult = await guardTicketCreation(guild, member.id, category.id);
  if (!guardResult.allowed) {
    await interaction.editReply({ content: guardResult.reason });
    return;
  }

  const parent = TICKET_CONFIG.openTicketsCategoryId
    ? ((await guild.channels.fetch(TICKET_CONFIG.openTicketsCategoryId).catch(() => null)) as CategoryChannel | null)
    : null;

  const channelName = `${formatChannelName(category, store.peekNextNumber())}-${sanitizeName(member.user.username)}`;

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parent ?? undefined,
    permissionOverwrites: buildPermissionOverwrites(guild, member, category),
  });

  const now = Date.now();
  const record = await store.createTicket({
    channelId: ticketChannel.id,
    guildId: guild.id,
    ownerId: member.id,
    groupId: group.id,
    categoryId: category.id,
    status: TicketStatus.Open,
    priority: TicketPriority.Medium,
    handlerId: null,
    additionalUserIds: [],
    subject,
    controlMessageId: null,
    createdAt: now,
    claimedAt: null,
    closedAt: null,
    closedBy: null,
    archivedAt: null,
    deleteAt: null,
  });

  const staffMentions = [...TICKET_CONFIG.globalStaffRoleIds, ...category.staffRoleIds].map(id => `<@&${id}>`).join(' ');
  const { components, flags } = buildTicketControlContent(record);
  const controlMessage = await ticketChannel.send({
    content: `${staffMentions ? staffMentions + ' | ' : ''}<@${member.id}>`,
    components,
    flags,
  });
  await store.updateTicket(record.channelId, { controlMessageId: controlMessage.id });

  const extraAnswers = Object.entries(intakeAnswers ?? {}).filter(([key]) => key !== 'subject');
  if (extraAnswers.length > 0) {
    const questionLabels = new Map((category.intakeQuestions ?? []).map(q => [q.id, q.label]));
    const answerText = extraAnswers.map(([key, value]) => `**${questionLabels.get(key) ?? key}:**\n${value}`).join('\n\n');
    const answerContainer = new ContainerBuilder()
      .setAccentColor(category.color)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 📋 Angaben aus dem Formular\n${answerText}`));
    await ticketChannel.send({ components: [answerContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
  }

  await interaction.editReply({ content: `✅ Dein Ticket wurde erstellt: <#${ticketChannel.id}>` });

  await logToChannel(guild, {
    title: '🎫 Ticket erstellt',
    color: category.color,
    fields: [
      { name: 'Kategorie', value: formatLabel(category.emoji, category.label), inline: true },
      { name: 'Ersteller', value: `<@${member.id}>`, inline: true },
      { name: 'Channel', value: `<#${ticketChannel.id}>`, inline: true },
    ],
  });
}

async function refreshControlMessage(channel: TextChannel, ticket: TicketRecord): Promise<void> {
  if (!ticket.controlMessageId) return;
  const message = await channel.messages.fetch(ticket.controlMessageId).catch(() => null);
  if (!message) return;
  const { components, flags } = buildTicketControlContent(ticket);
  await message.edit({ components, flags }).catch(() => null);
}

async function claimTicket(interaction: ButtonInteraction, ticket: TicketRecord): Promise<void> {
  if (ticket.handlerId) {
    await interaction.reply({ content: `ℹ️ Dieses Ticket wird bereits von <@${ticket.handlerId}> bearbeitet.`, ephemeral: true });
    return;
  }
  const updated = await store.updateTicket(ticket.channelId, { handlerId: interaction.user.id, claimedAt: Date.now() });
  if (!updated) return;
  await interaction.reply({ content: `🙋 <@${interaction.user.id}> hat dieses Ticket beansprucht.` });
  await refreshControlMessage(interaction.channel as TextChannel, updated);
}

async function setPriority(interaction: StringSelectMenuInteraction, ticket: TicketRecord, priority: TicketPriority): Promise<void> {
  const updated = await store.updateTicket(ticket.channelId, { priority });
  if (!updated) return;
  const meta = PRIORITY_META[priority];
  await interaction.update({ content: `${meta.emoji} Priorität wurde auf **${meta.label}** gesetzt.`, components: [] });
  await refreshControlMessage(interaction.channel as TextChannel, updated);
}

async function addUserToTicket(interaction: UserSelectMenuInteraction): Promise<void> {
  const channel = interaction.channel as TextChannel;
  const target = interaction.users.first();
  const ticket = store.getTicket(channel.id);
  if (!target || !ticket) return;

  await channel.permissionOverwrites.edit(target.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
  });
  const updated = await store.updateTicket(channel.id, { additionalUserIds: [...ticket.additionalUserIds, target.id] });
  await interaction.update({ content: `✅ <@${target.id}> wurde zum Ticket hinzugefügt.`, components: [] });
  await channel.send({ content: `➕ <@${target.id}> wurde von <@${interaction.user.id}> hinzugefügt.` });
  if (updated) await refreshControlMessage(channel, updated);
}

async function removeUserFromTicket(interaction: UserSelectMenuInteraction): Promise<void> {
  const channel = interaction.channel as TextChannel;
  const target = interaction.users.first();
  const ticket = store.getTicket(channel.id);
  if (!target || !ticket) return;

  if (target.id === ticket.ownerId) {
    await interaction.update({ content: '⚠️ Der Ticket-Ersteller kann nicht entfernt werden.', components: [] });
    return;
  }

  await channel.permissionOverwrites.delete(target.id).catch(() => null);
  const updated = await store.updateTicket(channel.id, {
    additionalUserIds: ticket.additionalUserIds.filter(id => id !== target.id),
  });
  await interaction.update({ content: `✅ <@${target.id}> wurde vom Ticket entfernt.`, components: [] });
  await channel.send({ content: `➖ <@${target.id}> wurde von <@${interaction.user.id}> entfernt.` });
  if (updated) await refreshControlMessage(channel, updated);
}

async function closeTicket(channel: TextChannel, closedBy: GuildMember, ticket: TicketRecord): Promise<void> {
  const { category } = findCategory(ticket.categoryId)!;
  const transcript = await generateHtmlTranscript(channel);
  const attachment = new AttachmentBuilder(transcript, { name: `transcript-${channel.name}.html` });

  await channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: false }).catch(() => null);
  for (const userId of ticket.additionalUserIds) {
    await channel.permissionOverwrites.edit(userId, { SendMessages: false }).catch(() => null);
  }

  const deleteAt =
    TICKET_CONFIG.autoDeleteAfterHours > 0 ? Date.now() + TICKET_CONFIG.autoDeleteAfterHours * 60 * 60 * 1000 : null;

  const updated = await store.updateTicket(channel.id, {
    status: TicketStatus.Closed,
    closedAt: Date.now(),
    closedBy: closedBy.id,
    deleteAt,
  });
  if (!updated) return;

  if (updated.controlMessageId) {
    await refreshControlMessage(channel, updated);
  }

  const closedNotice = deleteAt
    ? `🔒 Ticket geschlossen von <@${closedBy.id}>. Automatische Löschung in ca. ${TICKET_CONFIG.autoDeleteAfterHours}h, sofern es nicht vorher wieder geöffnet wird.`
    : `🔒 Ticket geschlossen von <@${closedBy.id}>.`;
  await channel.send({ content: closedNotice }).catch(() => null);

  await logToChannel(channel.guild, {
    title: '🔒 Ticket geschlossen',
    color: 0xe74c3c,
    fields: [
      { name: 'Kategorie', value: formatLabel(category.emoji, category.label), inline: true },
      { name: 'Ersteller', value: `<@${ticket.ownerId}>`, inline: true },
      { name: 'Geschlossen von', value: `<@${closedBy.id}>`, inline: true },
      { name: 'Bearbeiter', value: ticket.handlerId ? `<@${ticket.handlerId}>` : 'Niemand', inline: true },
      { name: 'Channel', value: `#${channel.name}`, inline: true },
    ],
    files: [attachment],
  });
}

async function reopenTicket(channel: TextChannel, reopenedBy: GuildMember, ticket: TicketRecord): Promise<void> {
  await channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: true }).catch(() => null);
  for (const userId of ticket.additionalUserIds) {
    await channel.permissionOverwrites.edit(userId, { SendMessages: true }).catch(() => null);
  }

  const updated = await store.updateTicket(channel.id, {
    status: TicketStatus.Open,
    closedAt: null,
    closedBy: null,
    archivedAt: null,
    deleteAt: null,
  });
  if (!updated) return;

  await channel.send({ content: `🔓 Ticket wurde von <@${reopenedBy.id}> wieder geöffnet.` });
  if (updated.controlMessageId) await refreshControlMessage(channel, updated);

  await logToChannel(channel.guild, {
    title: '🔓 Ticket wieder geöffnet',
    color: 0x2ecc71,
    fields: [
      { name: 'Channel', value: `#${channel.name}`, inline: true },
      { name: 'Wieder geöffnet von', value: `<@${reopenedBy.id}>`, inline: true },
    ],
  });
}

async function deleteTicketNow(channel: TextChannel, deletedBy: GuildMember, ticket: TicketRecord): Promise<void> {
  await logToChannel(channel.guild, {
    title: '🗑️ Ticket gelöscht',
    color: 0x992d22,
    fields: [
      { name: 'Channel', value: `#${channel.name}`, inline: true },
      { name: 'Gelöscht von', value: `<@${deletedBy.id}>`, inline: true },
      { name: 'Ersteller', value: `<@${ticket.ownerId}>`, inline: true },
    ],
  });
  await store.deleteTicket(channel.id);
  setTimeout(() => channel.delete().catch(() => null), TICKET_CONFIG.manualDeleteDelaySeconds * 1000);
}

// ================================================================================================
// 8. INTERAKTIONS-HANDLER
// ================================================================================================

function buildIntakeModal(category: TicketCategoryConfig): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(`ticket_modal_${category.id}`).setTitle(`Ticket: ${category.label}`.slice(0, 45));
  for (const question of category.intakeQuestions ?? []) {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(question.id)
          .setLabel(question.label.slice(0, 45))
          .setStyle(question.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setPlaceholder(question.placeholder ?? '')
          .setRequired(question.required ?? true)
          .setMinLength(question.minLength ?? 1)
          .setMaxLength(question.maxLength ?? (question.paragraph ? 1024 : 100))
      )
    );
  }
  return modal;
}

async function handleOpenCategoryButton(interaction: ButtonInteraction): Promise<void> {
  const categoryId = interaction.customId.replace('ticket_open_', '');
  const found = findCategory(categoryId);
  if (!found) {
    await interaction.reply({ content: '❌ Unbekannte Ticket-Kategorie.', ephemeral: true });
    return;
  }
  const { category, group } = found;

  if (!category.intakeQuestions || category.intakeQuestions.length === 0) {
    await createTicketChannel(interaction, category, group, null);
    return;
  }

  await interaction.showModal(buildIntakeModal(category));
}

async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const categoryId = interaction.customId.replace('ticket_modal_', '');
  const found = findCategory(categoryId);
  if (!found) {
    await interaction.reply({ content: '❌ Unbekannte Ticket-Kategorie.', ephemeral: true });
    return;
  }
  const { category, group } = found;

  const answers: Record<string, string> = {};
  for (const question of category.intakeQuestions ?? []) {
    answers[question.id] = interaction.fields.getTextInputValue(question.id);
  }

  await createTicketChannel(interaction, category, group, answers);
}

async function requireTicket(interaction: ButtonInteraction | UserSelectMenuInteraction | StringSelectMenuInteraction): Promise<TicketRecord | null> {
  const channel = interaction.channel as TextChannel;
  const ticket = store.getTicket(channel.id);
  if (!ticket) {
    await interaction.reply({ content: '❌ Dies ist kein gültiger Ticket-Channel.', ephemeral: true });
    return null;
  }
  return ticket;
}

async function routeTicketInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isButton()) {
      const { customId } = interaction;
      const member = interaction.member as GuildMember;

      if (customId.startsWith('ticket_open_')) return void (await handleOpenCategoryButton(interaction));

      if (customId === 'ticket_claim') {
        const ticket = await requireTicket(interaction);
        if (ticket) await claimTicket(interaction, ticket);
        return;
      }
      if (customId === 'ticket_priority') {
        await interaction.reply({ content: 'Neue Priorität auswählen:', components: [buildPriorityMenuRow()], ephemeral: true });
        return;
      }
      if (customId === 'ticket_add_user') {
        const select = new UserSelectMenuBuilder().setCustomId('ticket_add_user_select').setPlaceholder('Nutzer auswählen').setMinValues(1).setMaxValues(1);
        await interaction.reply({ content: 'Wen möchtest du hinzufügen?', components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(select)], ephemeral: true });
        return;
      }
      if (customId === 'ticket_remove_user') {
        const select = new UserSelectMenuBuilder().setCustomId('ticket_remove_user_select').setPlaceholder('Nutzer auswählen').setMinValues(1).setMaxValues(1);
        await interaction.reply({ content: 'Wen möchtest du entfernen?', components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(select)], ephemeral: true });
        return;
      }
      if (customId === 'ticket_transcript') {
        const ticket = await requireTicket(interaction);
        if (!ticket) return;
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.channel as TextChannel;
        const [html, json] = await Promise.all([generateHtmlTranscript(channel), generateJsonExport(ticket, channel)]);
        await interaction.editReply({
          content: '📄 Hier ist dein Transcript:',
          files: [
            new AttachmentBuilder(html, { name: `transcript-${channel.name}.html` }),
            new AttachmentBuilder(json, { name: `export-${channel.name}.json` }),
          ],
        });
        return;
      }
      if (customId === 'ticket_close') {
        await interaction.reply({
          content: '🔒 Ticket wirklich schließen? Ein Transcript wird automatisch erstellt.',
          components: [buildCloseConfirmRow()],
          ephemeral: true,
        });
        return;
      }
      if (customId === 'ticket_close_confirm') {
        const ticket = await requireTicket(interaction);
        if (!ticket) return;
        await interaction.update({ content: '🔒 Ticket wird geschlossen…', components: [] });
        await closeTicket(interaction.channel as TextChannel, member, ticket);
        return;
      }
      if (customId === 'ticket_close_cancel') {
        await interaction.update({ content: '✖️ Schließen abgebrochen.', components: [] });
        return;
      }
      if (customId === 'ticket_reopen') {
        const ticket = await requireTicket(interaction);
        if (!ticket) return;
        if (!isStaffMember(member)) {
          await interaction.reply({ content: '❌ Nur das Team kann Tickets wieder öffnen.', ephemeral: true });
          return;
        }
        await interaction.deferUpdate();
        await reopenTicket(interaction.channel as TextChannel, member, ticket);
        return;
      }
      if (customId === 'ticket_delete') {
        if (!isStaffMember(member)) {
          await interaction.reply({ content: '❌ Nur das Team kann Tickets endgültig löschen.', ephemeral: true });
          return;
        }
        await interaction.reply({
          content: '🗑️ Dieses Ticket wirklich **endgültig** löschen? Dies kann nicht rückgängig gemacht werden.',
          components: [buildDeleteConfirmRow()],
          ephemeral: true,
        });
        return;
      }
      if (customId === 'ticket_delete_confirm') {
        const ticket = await requireTicket(interaction);
        if (!ticket) return;
        await interaction.update({ content: '🗑️ Ticket wird gelöscht…', components: [] });
        await deleteTicketNow(interaction.channel as TextChannel, member, ticket);
        return;
      }
      if (customId === 'ticket_delete_cancel') {
        await interaction.update({ content: '✖️ Löschen abgebrochen.', components: [] });
        return;
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('ticket_modal_')) return void (await handleModalSubmit(interaction));
    } else if (interaction.isUserSelectMenu()) {
      if (interaction.customId === 'ticket_add_user_select') return void (await addUserToTicket(interaction));
      if (interaction.customId === 'ticket_remove_user_select') return void (await removeUserFromTicket(interaction));
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'ticket_priority_select') {
        const ticket = await requireTicket(interaction);
        if (!ticket) return;
        await setPriority(interaction, ticket, interaction.values[0] as TicketPriority);
        return;
      }
    }
  } catch (err) {
    console.error('[TicketSystem] Fehler bei der Interaktionsverarbeitung:', err);
    if (
      (interaction.isButton() || interaction.isUserSelectMenu() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) &&
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply({ content: `❌ Es ist ein Fehler aufgetreten: ${err}`, ephemeral: true }).catch(() => null);
    }
  }
}

// ================================================================================================
// 9. AUTO-DELETE-SWEEP
// ================================================================================================
//  Der Löschzeitpunkt wird persistiert statt nur per setTimeout im Speicher gehalten – ein
//  Neustart des Bots führt daher NICHT mehr dazu, dass geplante Löschungen verloren gehen.
// ================================================================================================

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

async function runAutoDeleteSweep(client: ExtendedClient): Promise<void> {
  const due = store.getTicketsDueForDeletion(Date.now());
  for (const ticket of due) {
    try {
      const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
      if (!guild) {
        await store.deleteTicket(ticket.channelId);
        continue;
      }
      const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
      await store.deleteTicket(ticket.channelId);
      if (channel) await (channel as TextChannel).delete().catch(() => null);
    } catch (err) {
      console.error('[TicketSystem] Auto-Delete-Sweep fehlgeschlagen für', ticket.channelId, err);
    }
  }
}

// ================================================================================================
// 10. INITIALISIERUNG & SLASH-COMMAND
// ================================================================================================

function initTicketSystem(client: ExtendedClient): void {
  const flaggedClient = client as ExtendedClient & { _ticketSystemInitialized?: boolean };
  if (flaggedClient._ticketSystemInitialized) return;
  flaggedClient._ticketSystemInitialized = true;

  void store.load();
  client.on('interactionCreate', routeTicketInteraction);
  setInterval(() => void runAutoDeleteSweep(client), SWEEP_INTERVAL_MS);
}

function buildStatsReport(): string {
  const all = store.getAllTickets();
  const open = all.filter(t => t.status === TicketStatus.Open).length;
  const closed = all.filter(t => t.status === TicketStatus.Closed).length;

  const perCategory = getAllCategories()
    .map(({ category }) => {
      const count = all.filter(t => t.categoryId === category.id).length;
      return `**${category.label}:** ${count}`;
    })
    .join('\n');

  const closedWithDuration = all.filter(t => t.status === TicketStatus.Closed && t.closedAt);
  const avgResolutionMs =
    closedWithDuration.length > 0
      ? closedWithDuration.reduce((sum, t) => sum + (t.closedAt! - t.createdAt), 0) / closedWithDuration.length
      : null;
  const avgResolutionText =
    avgResolutionMs !== null ? `${Math.round(avgResolutionMs / (60 * 1000))} Minuten` : 'Keine Daten';

  return [
    `**Gesamt:** ${all.length}  ·  **Offen:** ${open}  ·  **Geschlossen:** ${closed}`,
    `**Ø Bearbeitungszeit:** ${avgResolutionText}`,
    '',
    '**Nach Kategorie:**',
    perCategory,
  ].join('\n');
}

async function findExistingPanelMessage(channel: TextChannel): Promise<Message | null> {
  const storedId = store.getPanelMessageId(channel.id);
  if (storedId) {
    const message = await channel.messages.fetch(storedId).catch(() => null);
    if (message) return message;
  }
  return null;
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Verwaltung des Ticket-Systems')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('send')
        .setDescription('Sendet oder aktualisiert das Ticket-Panel in einem Channel')
        .addChannelOption(o =>
          o.setName('channel').setDescription('Ziel-Channel für das Panel').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand(sub => sub.setName('stats').setDescription('Zeigt Statistiken zum Ticket-System an')),

  async execute(interaction, client: ExtendedClient): Promise<void> {
    await guardCommand(interaction);
    await interaction.deferReply({ ephemeral: true });

    initTicketSystem(client);
    await store.load();

    const sub = interaction.options.getSubcommand();

    if (sub === 'send') {
      const targetChannel = interaction.options.getChannel('channel', true) as TextChannel;
      try {
        const { components, flags } = buildPanelComponents();
        const existing = await findExistingPanelMessage(targetChannel);
        if (existing) {
          await existing.edit({ components, flags });
          await interaction.editReply(`✅ Ticket-Panel in <#${targetChannel.id}> aktualisiert.`);
        } else {
          const sent = await targetChannel.send({ components, flags });
          await store.setPanelMessageId(targetChannel.id, sent.id);
          await interaction.editReply(`✅ Ticket-Panel wurde in <#${targetChannel.id}> gesendet.`);
        }
      } catch (err) {
        await replyError(interaction, `${err}`);
      }
      return;
    }

    if (sub === 'stats') {
      await interaction.editReply(buildStatsReport());
    }
  },
};

export default command;