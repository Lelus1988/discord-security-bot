import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { ExtendedClient } from '../../../types';
import { createDevEmbed } from '../../../utils/devEmbed';
import { RaidService } from '../../../services/RaidService';
import { config } from '../../../config';

export type SimulationType = 'raid' | 'spam' | 'nuke' | 'join';

const DISCORD_EPOCH = 1420070400000n; // 2015-01-01, Beginn der Discord-Snowflake-Zeitrechnung

function generateFakeSnowflakeForAge(ageDays: number): string {
  const createdAtMs = Date.now() - ageDays * 24 * 60 * 60 * 1000;
  const timestampBits = BigInt(createdAtMs) - DISCORD_EPOCH;
  const snowflake = timestampBits << 22n; // worker/process/increment bleiben 0
  return snowflake.toString();
}

interface SimulatedMemberInput {
  ageDays: number;
  hasAvatar: boolean;
  isBot: boolean;
}

function buildSimulatedMember(input: SimulatedMemberInput): GuildMember {
  const id = generateFakeSnowflakeForAge(input.ageDays);
  const createdAtMs = Date.now() - input.ageDays * 24 * 60 * 60 * 1000;

  return {
    id,
    user: {
      id,
      avatar: input.hasAvatar ? 'simulated_avatar_hash' : null,
      bot: input.isBot,
      createdAt: new Date(createdAtMs),
      createdTimestamp: createdAtMs,
    },
  } as unknown as GuildMember;
}


async function simulateRaid(guildId: string): Promise<string[]> {
  const lines: string[] = [];

  const enabled = await RaidService.isEnabled(guildId);
  lines.push(`Anti-Raid aktiv: ${enabled ? '✅ Ja' : '❌ Nein'}`);

  if (!enabled) {
    lines.push('⚠️ Simulation würde in der Praxis NICHT ausgelöst werden, da Anti-Raid deaktiviert ist.');
    return lines;
  }

  const { windowSec, joinThreshold, lockdownDurationSec } = config.antiRaid;

  const simulatedJoinCount = Math.floor(Math.random() * (joinThreshold + 4));

  const ageDays = Math.floor(Math.random() * 10);
  const hasAvatar = Math.random() > 0.7; // Raid-Konten haben seltener echte Avatare
  const simulatedMember = buildSimulatedMember({ ageDays, hasAvatar, isBot: false });
  const suspicionScore = RaidService.calculateSuspicionScore(simulatedMember);

  lines.push(`Simulierte Joins im Zeitfenster (${windowSec}s): ${simulatedJoinCount}`);
  lines.push(`Konfigurierter Join-Schwellenwert: ${joinThreshold}`);
  lines.push(`Verdächtigstes simuliertes Mitglied — Konto-Alter: ${ageDays}d, Avatar: ${hasAvatar ? 'Ja' : 'Nein'}`);
  lines.push(`Suspicion-Score dieses Mitglieds (RaidService.calculateSuspicionScore): ${suspicionScore}`);

  const wouldTrigger =
    simulatedJoinCount >= joinThreshold || (simulatedJoinCount >= 3 && suspicionScore >= 4);

  lines.push(
    wouldTrigger
      ? '🚨 Ergebnis: Lockdown WÜRDE ausgelöst werden.'
      : '✅ Ergebnis: Kein Lockdown notwendig.'
  );
  lines.push(`Lockdown-Dauer (falls ausgelöst): ${lockdownDurationSec / 60} Minuten`);
  lines.push('Hinweis: Es wurde kein echter Lockdown aktiviert, keine Berechtigung geändert und niemand gekickt.');

  return lines;
}

async function simulateJoin(guildId: string): Promise<string[]> {
  const lines: string[] = [];

  const ageDays = Math.floor(Math.random() * 60);
  const hasAvatar = Math.random() > 0.5;
  const isBot = Math.random() < 0.05;

  const simulatedMember = buildSimulatedMember({ ageDays, hasAvatar, isBot });

  const score = RaidService.calculateSuspicionScore(simulatedMember);
  const lockdownActive = RaidService.isLockdownActive(guildId);

  lines.push(`Simuliertes Konto-Alter: ${ageDays} Tage`);
  lines.push(`Avatar gesetzt: ${hasAvatar ? 'Ja' : 'Nein'}`);
  lines.push(`Bot-Konto: ${isBot ? 'Ja' : 'Nein'}`);
  lines.push(`Berechneter Suspicion-Score (RaidService.calculateSuspicionScore): ${score}`);
  lines.push(`Aktueller Lockdown-Status dieses Servers: ${lockdownActive ? '🔒 Aktiv' : '🔓 Inaktiv'}`);

  if (lockdownActive) {
    const wouldBeKicked = score >= 2;
    lines.push(
      wouldBeKicked
        ? '🚨 Ergebnis: Mitglied WÜRDE während des aktiven Lockdowns automatisch gekickt werden (Score ≥ 2).'
        : '✅ Ergebnis: Mitglied würde trotz Lockdown NICHT gekickt werden (Score < 2).'
    );
  } else {
    lines.push(
      score >= 4
        ? '⚠️ Ergebnis: Mitglied allein löst noch keinen Lockdown aus, würde aber bei einer gleichzeitigen Join-Welle (≥3 Joins) als Mitauslöser zählen (Score ≥ 4).'
        : '✅ Ergebnis: Mitglied würde nicht als auffällig genug eingestuft werden, um zu einem Lockdown beizutragen (Score < 4).'
    );
  }

  lines.push('Hinweis: Es wurde kein echtes Mitglied erstellt, gekickt oder gebannt - nur die reale Score-Berechnung ausgeführt.');
  return lines;
}

async function simulateSpam(): Promise<string[]> {
  const lines: string[] = [];
  const { enabled, msgThreshold, windowSec, mentionLimit, muteDurationMs } = config.antiSpam;

  lines.push(`Anti-Spam aktiv: ${enabled ? '✅ Ja' : '❌ Nein'}`);
  if (!enabled) {
    lines.push('⚠️ Simulation würde in der Praxis NICHT ausgelöst werden, da Anti-Spam deaktiviert ist.');
    return lines;
  }

  // Zufällige Nachrichtenwelle generieren (kein festes Ergebnis).
  const simulatedMessageCount = Math.floor(Math.random() * (msgThreshold + 5));
  const simulatedMentionCount = Math.floor(Math.random() * (mentionLimit + 4));

  lines.push(`Simulierte Nachrichten im Zeitfenster (${windowSec}s): ${simulatedMessageCount}`);
  lines.push(`Konfigurierter Nachrichten-Schwellenwert: ${msgThreshold}`);
  lines.push(`Simulierte Mentions in einer Nachricht: ${simulatedMentionCount}`);
  lines.push(`Konfiguriertes Mention-Limit: ${mentionLimit}`);

  const triggeredByRate = simulatedMessageCount >= msgThreshold;
  const triggeredByMentions = simulatedMentionCount >= mentionLimit;
  const wouldTrigger = triggeredByRate || triggeredByMentions;

  const reasons = [
    triggeredByRate ? 'Nachrichtenrate' : null,
    triggeredByMentions ? 'Mention-Limit' : null,
  ].filter(Boolean);

  lines.push(
    wouldTrigger
      ? `🚨 Ergebnis: Anti-Spam WÜRDE ausgelöst werden (${reasons.join(' + ')} überschritten).`
      : '✅ Ergebnis: Kein Eingreifen notwendig.'
  );
  if (wouldTrigger) {
    lines.push(`Mute-Dauer (falls ausgelöst): ${Math.round(muteDurationMs / 60000)} Minuten`);
  }

  lines.push(
    'Hinweis: Es gibt in eurem Projekt aktuell keinen dedizierten SpamService (anders als RaidService). ' +
      'Diese Simulation vergleicht daher direkt gegen eure echten config.antiSpam-Schwellenwerte, ruft aber ' +
      'nicht euren tatsächlichen Message-Handler auf. Teilt eure echte Spam-Erkennungslogik ' +
      '(z.B. aus messageCreate.ts), dann wird diese Simulation darauf umgestellt.'
  );

  return lines;
}

async function simulateNuke(): Promise<string[]> {
  const lines: string[] = [];

  const REFERENCE_WINDOW_SEC = 10;
  const REFERENCE_ACTION_THRESHOLD = 3;

  const simulatedActionCount = Math.floor(Math.random() * 6); // 0-5 simulierte Aktionen
  const actionTypes = ['Channel gelöscht', 'Rolle gelöscht', 'Webhook erstellt', 'Mitglied gebannt'];
  const simulatedSequence = Array.from(
    { length: simulatedActionCount },
    () => actionTypes[Math.floor(Math.random() * actionTypes.length)]
  );

  lines.push(`Referenz-Zeitfenster: ${REFERENCE_WINDOW_SEC}s`);
  lines.push(`Referenz-Schwellenwert: ${REFERENCE_ACTION_THRESHOLD} destruktive Aktionen`);
  lines.push(`Simulierte Aktionen im Zeitfenster: ${simulatedActionCount}`);
  lines.push(
    simulatedSequence.length ? `Simulierte Aktionsfolge: ${simulatedSequence.join(' → ')}` : 'Keine Aktionen simuliert'
  );

  const wouldTrigger = simulatedActionCount >= REFERENCE_ACTION_THRESHOLD;
  lines.push(
    wouldTrigger
      ? '🚨 Ergebnis (Referenzmodell): Bei dieser Aktionsfolge WÜRDE ein Anti-Nuke-System mit vergleichbarem Schwellenwert auslösen.'
      : '✅ Ergebnis (Referenzmodell): Schwellenwert nicht erreicht.'
  );
  lines.push(
    '⚠️ Wichtig: Es gibt aktuell keinen echten NukeService in eurem Projekt - dies ist ein Referenzmodell, ' +
      'keine echte Erkennung. Es wurde kein Channel gelöscht, keine Rolle entfernt und niemand gebannt.'
  );

  return lines;
}

export async function handleSimulate(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient,
  type: SimulationType
): Promise<void> {
  const guildId = interaction.guildId;

  if (!guildId) {
    const embed = createDevEmbed(interaction, {
      title: '❌ Fehler',
      color: 0xed4245,
    }).setDescription('Simulationen benötigen einen Server-Kontext (nicht in DMs verfügbar).');
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  let lines: string[];
  let title: string;

  switch (type) {
    case 'raid':
      lines = await simulateRaid(guildId);
      title = '🎭 Simulation: Raid';
      break;
    case 'spam':
      lines = await simulateSpam();
      title = '🎭 Simulation: Spam';
      break;
    case 'nuke':
      lines = await simulateNuke();
      title = '🎭 Simulation: Nuke';
      break;
    case 'join':
      lines = await simulateJoin(guildId);
      title = '🎭 Simulation: Verdächtiger Join';
      break;
  }

  const embed = createDevEmbed(interaction, { title, color: 0xeb459e })
    .setDescription(lines.join('\n'))
    .addFields({
      name: '⚠️ Wichtiger Hinweis',
      value:
        'Diese Simulation führt **keine echten Aktionen** aus. Es wurde niemand gekickt, ' +
        'gebannt, kein Channel gelöscht und keine Berechtigung geändert. Ergebnisse werden ' +
        'aus zufällig generierten Szenarien live berechnet, nicht vorgegeben.',
    });

  await interaction.editReply({ embeds: [embed] });
}