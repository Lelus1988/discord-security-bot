import { ChatInputCommandInteraction } from 'discord.js';
import { ExtendedClient } from '../../../types';
import { createDevEmbed } from '../../../utils/devEmbed';
import { RaidService } from '../../../services/RaidService';
import { config } from '../../../config';

export type SimulationType = 'raid' | 'spam' | 'nuke' | 'join';


async function simulateRaid(guildId: string): Promise<string[]> {
  const lines: string[] = [];
  const enabled = await RaidService.isEnabled(guildId);
  lines.push(`Anti-Raid aktiv: ${enabled ? '✅ Ja' : '❌ Nein'}`);

  if (!enabled) {
    lines.push('⚠️ Simulation würde in der Praxis NICHT ausgelöst werden, da Anti-Raid deaktiviert ist.');
    return lines;
  }

  const simulatedJoins = config.antiRaid.joinThreshold + 2;
  lines.push(`Simulierte Joins im Zeitfenster: ${simulatedJoins}`);
  lines.push(`Konfigurierter Schwellenwert: ${config.antiRaid.joinThreshold}`);
  lines.push(
    simulatedJoins >= config.antiRaid.joinThreshold
      ? '🚨 Ergebnis: Lockdown WÜRDE ausgelöst werden.'
      : '✅ Ergebnis: Kein Lockdown notwendig.'
  );
  lines.push(`Lockdown-Dauer (falls ausgelöst): ${config.antiRaid.lockdownDurationSec / 60} Minuten`);
  return lines;
}

async function simulateSpam(): Promise<string[]> {
  const lines: string[] = [];
  const enabled = config.antiSpam.enabled;
  lines.push(`Anti-Spam aktiv: ${enabled ? '✅ Ja' : '❌ Nein'}`);

  if (!enabled) {
    lines.push('⚠️ Simulation würde in der Praxis NICHT ausgelöst werden, da Anti-Spam deaktiviert ist.');
    return lines;
  }

  const simulatedMessages = config.antiSpam.msgThreshold + 3;
  lines.push(`Simulierte Nachrichten im Zeitfenster: ${simulatedMessages}`);
  lines.push(`Konfigurierter Schwellenwert: ${config.antiSpam.msgThreshold} Nachrichten / ${config.antiSpam.windowSec}s`);
  lines.push(`Mention-Limit: ${config.antiSpam.mentionLimit}`);
  lines.push(
    simulatedMessages >= config.antiSpam.msgThreshold
      ? '🚨 Ergebnis: Anti-Spam WÜRDE ausgelöst werden.'
      : '✅ Ergebnis: Kein Eingreifen notwendig.'
  );
  lines.push(`Mute-Dauer (falls ausgelöst): ${Math.round(config.antiSpam.muteDurationMs / 60000)} Minuten`);
  lines.push('Hinweis: Es wurde keine echte Nachricht gesendet, gelöscht oder gemutet.');
  return lines;
}

async function simulateNuke(): Promise<string[]> {
  return [
    'Simuliertes Szenario: 5 Channel-Löschungen innerhalb von 10 Sekunden durch ein Mitglied',
    '🚨 Ergebnis: Anti-Nuke WÜRDE das auslösende Mitglied typischerweise entrechten/entfernen.',
    'Hinweis: Es wurde kein Channel gelöscht und keine Berechtigung geändert.',
  ];
}

async function simulateJoin(): Promise<string[]> {
  return [
    'Simuliertes Mitglied: Account-Alter 2 Tage, kein Avatar, kein Bot',
    'Berechneter Suspicion-Score (analog RaidService.calculateSuspicionScore): 6',
    '⚠️ Ergebnis: Mitglied würde als verdächtig eingestuft werden.',
    'Hinweis: Es wurde niemand gekickt oder gebannt.',
  ];
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
      lines = await simulateJoin();
      title = '🎭 Simulation: Verdächtiger Join';
      break;
  }

  const embed = createDevEmbed(interaction, { title, color: 0xeb459e })
    .setDescription(lines.join('\n'))
    .addFields({
      name: '⚠️ Wichtiger Hinweis',
      value:
        'Diese Simulation führt **keine echten Aktionen** aus. Es wurde niemand gekickt, ' +
        'gebannt, kein Channel gelöscht und keine Berechtigung geändert. ' +
        'Es wurde ausschließlich geprüft, wie das jeweilige Security-System reagieren würde.',
    });

  await interaction.editReply({ embeds: [embed] });
}
