import { Guild, GuildMember, PermissionsBitField, ColorResolvable } from 'discord.js';
import { RoleInfo } from '../types';

export class RoleService {

  /** List all roles in a guild (excluding @everyone), sorted by position. */
  static async listRoles(guild: Guild): Promise<RoleInfo[]> {
    await guild.roles.fetch();
    return [...guild.roles.cache.values()]
      .filter(r => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map((r): RoleInfo => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position,
        hoist: r.hoist,
        mentionable: r.mentionable,
        managed: r.managed,
        memberCount: r.members.size,
        permissions: r.permissions.bitfield.toString(),
      }));
  }

  /** Create a new role. */
  static async createRole(
    guild: Guild,
    data: { name: string; color?: string; hoist?: boolean; mentionable?: boolean }
  ) {
    return guild.roles.create({
      name: data.name,
      color: (data.color as ColorResolvable) ?? undefined,
      hoist: data.hoist ?? false,
      mentionable: data.mentionable ?? false,
      reason: 'Created via web dashboard',
    });
  }

  /** Update an existing role. Throws if the role is managed (bot/integration role) or bot lacks permission. */
  static async updateRole(
    guild: Guild,
    roleId: string,
    data: { name?: string; color?: string; hoist?: boolean; mentionable?: boolean }
  ) {
    const role = await guild.roles.fetch(roleId);
    if (!role) throw new Error('Role not found.');
    if (role.managed) throw new Error('This role is managed by an integration and cannot be edited.');

    const botMember = guild.members.me;
    if (botMember && role.position >= botMember.roles.highest.position) {
      throw new Error('The bot\'s role must be higher than this role to edit it.');
    }

    return role.edit({
      name: data.name ?? role.name,
      color: (data.color as ColorResolvable) ?? role.color,
      hoist: data.hoist ?? role.hoist,
      mentionable: data.mentionable ?? role.mentionable,
      reason: 'Edited via web dashboard',
    });
  }

  /** Delete a role. */
  static async deleteRole(guild: Guild, roleId: string): Promise<void> {
    const role = await guild.roles.fetch(roleId);
    if (!role) throw new Error('Role not found.');
    if (role.managed) throw new Error('This role is managed by an integration and cannot be deleted.');

    const botMember = guild.members.me;
    if (botMember && role.position >= botMember.roles.highest.position) {
      throw new Error('The bot\'s role must be higher than this role to delete it.');
    }

    await role.delete('Deleted via web dashboard');
  }

  /** Assign a role to a member. */
  static async assignRole(guild: Guild, userId: string, roleId: string): Promise<void> {
    const member = await guild.members.fetch(userId);
    await member.roles.add(roleId, 'Assigned via web dashboard');
  }

  /** Remove a role from a member. */
  static async removeRole(guild: Guild, userId: string, roleId: string): Promise<void> {
    const member = await guild.members.fetch(userId);
    await member.roles.remove(roleId, 'Removed via web dashboard');
  }
}
