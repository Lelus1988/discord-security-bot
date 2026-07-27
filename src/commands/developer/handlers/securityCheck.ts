import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ExtendedClient } from '../../../types';
import { createDevEmbed } from '../../../utils/devEmbed';
import { GuildModel } from '../../../database/models/Guild';
import { RaidService } from '../../../services/RaidService';

function statusLine(enabled: boolean | undefined | null): string {
  if (enabled === undefined || enabled === null) return '⚪ Nicht konfiguriert';
  return enabled ? '🟢 Aktiv' : '🔴 Deaktiviert';
}

const DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
];

export async function handleSecurityCheck(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient,
  guildId: string | null
): Promise<void> {
  const targetId = guildId ?? interaction.guildId;

  if (!targetId) {
    const embed = createDevEmbed(interaction, {
      title: '❌ Fehler',
      color: 0xed4245,
    }).setDescription('Keine Guild-ID angegeben und kein Server-Kontext vorhanden.');
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const guild = client.guilds.cache.get(targetId);
  if (!guild) {
    const embed = createDevEmbed(interaction, {
      title: '❌ Server nicht gefunden',
      color: 0xed4245,
    }).setDescription(`Der Bot ist auf keinem Server mit der ID \`${targetId}\`.`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const settings = await GuildModel.findOne({ guildId: targetId });

  // Anti-Raid: echter Live-Status aus dem RaidService (In-Memory-Lockdown-Tracker)
  const lockdownActive = RaidService.isLockdownActive(targetId);
  const antiRaidEnabled = settings?.antiRaidEnabled;

  // Anti-Spam / Anti-Nuke / Whitelist / Logging: Feldnamen nach demselben
  // Muster wie antiRaidEnabled erwartet. Falls euer GuildModel andere
  // Feldnamen nutzt, hier einfach anpassen.
  const antiSpamEnabled = (settings as unknown as { antiSpamEnabled?: boolean })?.antiSpamEnabled;
  const antiNukeEnabled = (settings as unknown as { antiNukeEnabled?: boolean })?.antiNukeEnabled;
  const whitelistEnabled = (settings as unknown as { whitelistEnabled?: boolean })?.whitelistEnabled;
  const loggingEnabled = (settings as unknown as { loggingEnabled?: boolean; logChannelId?: string })
    ?.loggingEnabled;
  const logChannelId = (settings as unknown as { logChannelId?: string })?.logChannelId;

  // Bot-Berechtigungen im Ziel-Server
  const me = guild.members.me;
  const botPermissions = me?.permissions ?? null;
  const botHasAdmin = botPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
  const botCanModerate = botPermissions?.has([
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ManageRoles,
  ]) ?? false;

  // Gefährliche Rollen: Rollen (außer der Bot-eigenen und @everyone), die
  // eine der DANGEROUS_PERMISSIONS besitzen und mehr als nur den Owner haben.
  const dangerousRoles = guild.roles.cache.filter(role => {
    if (role.id === guild.id) return false; // @everyone
    if (role.managed) return false; // von Integrationen verwaltete Rollen (Bots etc.)
    return DANGEROUS_PERMISSIONS.some(perm => role.permissions.has(perm));
  });

  const embed = createDevEmbed(interaction, { title: `🛡️ Security-Check: ${guild.name}` })
    .addFields(
      {
        name: 'Anti-Raid Status',
        value: `${statusLine(antiRaidEnabled)}${lockdownActive ? '\n🔒 **Lockdown gerade aktiv!**' : ''}`,
        inline: true,
      },
      { name: 'Anti-Spam Status', value: statusLine(antiSpamEnabled), inline: true },
      { name: 'Anti-Nuke Status', value: statusLine(antiNukeEnabled), inline: true },
      { name: 'Whitelist Status', value: statusLine(whitelistEnabled), inline: true },
      {
        name: 'Logging Status',
        value: loggingEnabled
          ? `🟢 Aktiv${logChannelId ? ` (<#${logChannelId}>)` : ''}`
          : statusLine(loggingEnabled),
        inline: true,
      },
      {
        name: 'Bot-Berechtigungen',
        value: botHasAdmin
          ? '🟢 Administrator'
          : botCanModerate
            ? '🟡 Moderations-Rechte vorhanden'
            : '🔴 Eingeschränkte Rechte',
        inline: true,
      },
      {
        name: `Gefährliche Rollen (${dangerousRoles.size})`,
        value: dangerousRoles.size
          ? dangerousRoles
              .map(r => `${r} (${r.members.size} Mitglieder)`)
              .slice(0, 10)
              .join('\n')
          : '✅ Keine kritischen Rollen gefunden',
        inline: false,
      },
      {
        name: 'Backup Status',
        value: '⚪ Kein automatisches Server-Backup-System hinterlegt — manuell via `/dev backup` (Datenbank)',
        inline: false,
      }
    );

  await interaction.editReply({ embeds: [embed] });
}
