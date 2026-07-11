// ── Setup ──────────────────────────────────────────────────────────────
const guildId = location.pathname.split('/server/')[1];
let cache = { channels: null, roles: null, members: null, isBotOwner: false };

// ── Tab switching ─────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tabEl => {
  tabEl.addEventListener('click', () => switchTab(tabEl.dataset.tab));
});

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
  loadTab(name);
}

const loadedTabs = new Set();
function loadTab(name, force = false) {
  if (loadedTabs.has(name) && !force) return;
  loadedTabs.add(name);
  switch (name) {
    case 'overview': loadOverview(); break;
    case 'members':  loadMembers(); break;
    case 'roles':    loadRoles(); break;
    case 'welcome':  loadWelcome(); break;
    case 'rules':    loadRules(); break;
    case 'commands': loadCommands(); break;
    case 'logs':     loadLogs(); break;
    case 'settings': loadSettings(); break;
  }
}

// ── Shared data loaders (cached) ─────────────────────────────────────
async function getChannels() {
  if (!cache.channels) cache.channels = await api('GET', `/api/channels/${guildId}`);
  return cache.channels;
}
async function getRoles(force = false) {
  if (!cache.roles || force) cache.roles = await api('GET', `/api/roles/${guildId}`);
  return cache.roles;
}

// ── Init: title + owner check ────────────────────────────────────────
(async function initPage() {
  try {
    const me = await api('GET', '/api/me');
    cache.isBotOwner = !!me.isBotOwner;
  } catch { /* ignore */ }

  loadTab('overview');
})();

// ════════════════════════════════════════════════════════════════════
// OVERVIEW
// ════════════════════════════════════════════════════════════════════
async function loadOverview() {
  const el = document.getElementById('overview-content');
  el.innerHTML = '<div class="loading">Lade Statistiken</div>';
  try {
    const s = await api('GET', `/api/guilds/${guildId}/stats`);
    document.getElementById('guild-title').textContent = `⚙️ ${s.name}`;
    el.innerHTML = `
      <div class="card">
        <div class="flex gap-8" style="margin-bottom:18px">
          ${s.iconUrl ? `<img src="${s.iconUrl}" style="width:56px;height:56px;border-radius:50%"/>` : ''}
          <div>
            <h3 class="mb-0" style="margin:0">${esc(s.name)}</h3>
            <span class="badge ${s.isWhitelisted ? 'green' : 'red'}">${s.isWhitelisted ? '✅ Autorisiert' : '❌ Nicht autorisiert'}</span>
          </div>
        </div>
        <div class="stat-grid">
          <div class="stat-box"><div class="value">${s.totalMembers}</div><div class="label">Mitglieder</div></div>
          <div class="stat-box"><div class="value">${s.onlineMembers}</div><div class="label">Online</div></div>
          <div class="stat-box"><div class="value">${s.humanCount}</div><div class="label">Menschen</div></div>
          <div class="stat-box"><div class="value">${s.botCount}</div><div class="label">Bots</div></div>
          <div class="stat-box"><div class="value">${s.channelCount}</div><div class="label">Kanäle</div></div>
          <div class="stat-box"><div class="value">${s.roleCount}</div><div class="label">Ränge</div></div>
          <div class="stat-box"><div class="value">${s.boostCount}</div><div class="label">Boosts (Lvl ${s.boostLevel})</div></div>
        </div>
        <p class="small text-dim mt-8">Server erstellt am ${fmtDate(s.createdAt)}</p>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">Fehler: ${esc(err.message)}</div>`;
  }
}

// ════════════════════════════════════════════════════════════════════
// MEMBERS
// ════════════════════════════════════════════════════════════════════
async function loadMembers(force = false) {
  const el = document.getElementById('members-content');
  el.innerHTML = '<div class="loading">Lade Mitglieder</div>';
  try {
    const url = force ? `/api/members/${guildId}?fresh=true` : `/api/members/${guildId}`;
    const [members, roles] = await Promise.all([api('GET', url), getRoles()]);
    cache.members = members;
    renderMembers(members, roles);
    document.getElementById('member-search').oninput = (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = members.filter(m => m.username.toLowerCase().includes(q) || m.displayName.toLowerCase().includes(q));
      renderMembers(filtered, roles);
    };
  } catch (err) {
    el.innerHTML = `<div class="empty-state">Fehler: ${esc(err.message)}</div>`;
  }
}

function renderMembers(members, roles) {
  const el = document.getElementById('members-content');
  if (members.length === 0) {
    el.innerHTML = '<div class="empty-state">Keine Mitglieder gefunden.</div>';
    return;
  }

  const roleOptions = roles.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');

  el.innerHTML = members.map(m => `
    <div class="list-row" style="align-items:flex-start">
      <img class="avatar" src="${m.avatarUrl}" alt=""/>
      <div class="main">
        <div class="title">
          <span class="status-dot ${m.status}"></span>
          ${esc(m.displayName)}
          ${m.isOwner ? '<span class="badge yellow">Owner</span>' : ''}
          ${m.isBot ? '<span class="badge gray">Bot</span>' : ''}
          ${m.isMuted ? '<span class="badge red">Gemutet</span>' : ''}
        </div>
        <div class="subtitle">@${esc(m.username)} · beigetreten ${fmtDate(m.joinedAt)}</div>
        <div>
          ${m.roles.map(r => `<span class="role-chip" style="color:${r.color === '#000000' ? '#9aa3c0' : r.color}" onclick="removeRole('${m.id}','${r.id}','${esc(r.name)}')" title="Klicken zum Entfernen">${esc(r.name)} ✕</span>`).join('')}
        </div>
        <select onchange="addRole('${m.id}', this.value); this.value=''" style="margin:8px 0 0;max-width:200px;font-size:0.78rem;padding:6px 10px">
          <option value="">+ Rolle hinzufügen…</option>
          ${roleOptions}
        </select>
      </div>
      <div class="actions">
        ${!m.isBot && !m.isOwner ? `
          ${m.isMuted
            ? `<button class="sm secondary" onclick="memberUnmute('${m.id}')">🔊 Entmuten</button>`
            : `<button class="sm secondary" onclick="memberMute('${m.id}')">🔇 Mute</button>`
          }
          <button class="sm secondary" onclick="memberKick('${m.id}')">👢 Kick</button>
          <button class="sm danger" onclick="memberBan('${m.id}')">🔨 Ban</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

async function addRole(userId, roleId) {
  if (!roleId) return;
  try {
    await api('POST', `/api/members/${guildId}/${userId}/roles`, { roleId, action: 'add' });
    toast('Rolle hinzugefügt.');
    loadMembers(true);
  } catch (err) { toast(err.message, true); }
}
async function removeRole(userId, roleId, roleName) {
  if (!confirm(`Rolle "${roleName}" entfernen?`)) return;
  try {
    await api('POST', `/api/members/${guildId}/${userId}/roles`, { roleId, action: 'remove' });
    toast('Rolle entfernt.');
    loadMembers(true);
  } catch (err) { toast(err.message, true); }
}
async function memberKick(userId) {
  const reason = prompt('Grund für den Kick:', 'Regelverstoß');
  if (reason === null) return;
  try {
    await api('POST', `/api/members/${guildId}/${userId}/kick`, { reason });
    toast('Mitglied gekickt.');
    loadMembers(true);
  } catch (err) { toast(err.message, true); }
}
async function memberBan(userId) {
  const reason = prompt('Grund für den Bann:', 'Regelverstoß');
  if (reason === null) return;
  if (!confirm('Bist du sicher, dass du dieses Mitglied bannen willst?')) return;
  try {
    await api('POST', `/api/members/${guildId}/${userId}/ban`, { reason });
    toast('Mitglied gebannt.');
    loadMembers(true);
  } catch (err) { toast(err.message, true); }
}
async function memberMute(userId) {
  const duration = prompt('Dauer (z.B. 10m, 1h, 1d):', '10m');
  if (duration === null) return;
  const reason = prompt('Grund:', 'Regelverstoß') || 'Kein Grund angegeben';
  try {
    await api('POST', `/api/members/${guildId}/${userId}/mute`, { duration, reason });
    toast('Mitglied gemutet.');
    loadMembers(true);
  } catch (err) { toast(err.message, true); }
}
async function memberUnmute(userId) {
  try {
    await api('POST', `/api/members/${guildId}/${userId}/unmute`);
    toast('Mitglied entmutet.');
    loadMembers(true);
  } catch (err) { toast(err.message, true); }
}

// ════════════════════════════════════════════════════════════════════
// ROLES
// ════════════════════════════════════════════════════════════════════
async function loadRoles() {
  const el = document.getElementById('roles-content');
  el.innerHTML = '<div class="loading">Lade Ränge</div>';
  try {
    const roles = await getRoles(true);
    if (roles.length === 0) {
      el.innerHTML = '<div class="empty-state">Keine Ränge vorhanden.</div>';
      return;
    }
    el.innerHTML = roles.map(r => `
      <div class="list-row">
        <span class="status-dot" style="background:${r.color === '#000000' ? '#5a5a6a' : r.color}"></span>
        <div class="main">
          <div class="title">${esc(r.name)} ${r.managed ? '<span class="badge gray">verwaltet</span>' : ''}</div>
          <div class="subtitle">${r.memberCount} Mitglieder · Position ${r.position}</div>
        </div>
        ${!r.managed ? `
          <div class="actions">
            <button class="sm secondary" onclick="editRole('${r.id}','${esc(r.name)}','${r.color}',${r.hoist},${r.mentionable})">✏️ Bearbeiten</button>
            <button class="sm danger" onclick="deleteRole('${r.id}','${esc(r.name)}')">🗑️ Löschen</button>
          </div>
        ` : ''}
      </div>
    `).join('');
  } catch (err) {
    el.innerHTML = `<div class="empty-state">Fehler: ${esc(err.message)}</div>`;
  }
}

async function createRole() {
  const name = document.getElementById('new-role-name').value.trim();
  if (!name) return toast('Bitte einen Namen eingeben.', true);
  const color = document.getElementById('new-role-color').value;
  const hoist = document.getElementById('new-role-hoist').checked;
  const mentionable = document.getElementById('new-role-mentionable').checked;
  try {
    await api('POST', `/api/roles/${guildId}`, { name, color, hoist, mentionable });
    toast(`Rang "${name}" erstellt.`);
    document.getElementById('new-role-name').value = '';
    loadRoles();
  } catch (err) { toast(err.message, true); }
}

async function editRole(id, currentName, currentColor, hoist, mentionable) {
  const name = prompt('Neuer Name:', currentName);
  if (name === null) return;
  const color = prompt('Neue Farbe (Hex, z.B. #5865f2):', currentColor) || currentColor;
  try {
    await api('PATCH', `/api/roles/${guildId}/${id}`, { name, color, hoist, mentionable });
    toast('Rang aktualisiert.');
    loadRoles();
  } catch (err) { toast(err.message, true); }
}

async function deleteRole(id, name) {
  if (!confirm(`Rang "${name}" wirklich löschen? Dies kann nicht rückgängig gemacht werden.`)) return;
  try {
    await api('DELETE', `/api/roles/${guildId}/${id}`);
    toast('Rang gelöscht.');
    loadRoles();
  } catch (err) { toast(err.message, true); }
}

// ════════════════════════════════════════════════════════════════════
// WELCOME & LEAVE
// ════════════════════════════════════════════════════════════════════
async function loadWelcome() {
  try {
    const [channels, settings] = await Promise.all([getChannels(), api('GET', `/api/welcome/${guildId}`)]);

    document.getElementById('welcome-enabled').checked = settings.welcomeEnabled;
    document.getElementById('welcome-channel').innerHTML = channelOptions(channels, ['text', 'announcement'], settings.welcomeChannelId);
    document.getElementById('welcome-message').value = settings.welcomeMessage || '';
    document.getElementById('welcome-embed').checked = settings.welcomeUseEmbed;

    document.getElementById('leave-enabled').checked = settings.leaveEnabled;
    document.getElementById('leave-channel').innerHTML = channelOptions(channels, ['text', 'announcement'], settings.leaveChannelId);
    document.getElementById('leave-message').value = settings.leaveMessage || '';
  } catch (err) {
    toast(err.message, true);
  }
}

async function saveWelcomeLeave() {
  const body = {
    welcomeEnabled:   document.getElementById('welcome-enabled').checked,
    welcomeChannelId: document.getElementById('welcome-channel').value || null,
    welcomeMessage:   document.getElementById('welcome-message').value,
    welcomeUseEmbed:  document.getElementById('welcome-embed').checked,
    leaveEnabled:     document.getElementById('leave-enabled').checked,
    leaveChannelId:   document.getElementById('leave-channel').value || null,
    leaveMessage:     document.getElementById('leave-message').value,
  };
  try {
    await api('PUT', `/api/welcome/${guildId}`, body);
    toast('Einstellungen gespeichert.');
  } catch (err) { toast(err.message, true); }
}

async function previewMessage(type) {
  const template = document.getElementById(`${type}-message`).value;
  try {
    const { rendered } = await api('POST', `/api/welcome/${guildId}/preview`, { template });
    document.getElementById(`${type}-preview`).textContent = `Vorschau: ${rendered}`;
  } catch (err) { toast(err.message, true); }
}

// ════════════════════════════════════════════════════════════════════
// RULES
// ════════════════════════════════════════════════════════════════════
async function loadRules() {
  try {
    const [channels, settings] = await Promise.all([getChannels(), api('GET', `/api/rules/${guildId}`)]);
    document.getElementById('rules-channel').innerHTML = channelOptions(channels, ['text', 'announcement'], settings.rulesChannelId);
    document.getElementById('rules-text').value = settings.rulesText || '';
  } catch (err) { toast(err.message, true); }
}

async function saveRules() {
  const body = {
    rulesChannelId: document.getElementById('rules-channel').value || null,
    rulesText: document.getElementById('rules-text').value,
  };
  try {
    await api('PUT', `/api/rules/${guildId}`, body);
    toast('Regeln gespeichert.');
  } catch (err) { toast(err.message, true); }
}

async function postRules() {
  if (!confirm('Regeln jetzt im konfigurierten Kanal posten?')) return;
  try {
    await api('POST', `/api/rules/${guildId}/post`);
    toast('Regeln gepostet.');
  } catch (err) { toast(err.message, true); }
}

// ════════════════════════════════════════════════════════════════════
// CUSTOM COMMANDS
// ════════════════════════════════════════════════════════════════════
async function loadCommands() {
  const el = document.getElementById('commands-content');
  el.innerHTML = '<div class="loading">Lade Befehle</div>';
  try {
    const data = await api('GET', `/api/commands/${guildId}`);
    document.getElementById('cmd-prefix').value = data.prefix;

    if (data.commands.length === 0) {
      el.innerHTML = '<div class="empty-state">Noch keine eigenen Befehle erstellt.</div>';
      return;
    }

    el.innerHTML = data.commands.map(c => `
      <div class="list-row">
        <div class="main">
          <div class="title"><code class="inline">${esc(data.prefix)}${esc(c.trigger)}</code> ${c.enabled ? '' : '<span class="badge gray">Deaktiviert</span>'}</div>
          <div class="subtitle">${esc(c.response.slice(0, 100))}${c.response.length > 100 ? '…' : ''}</div>
          <div class="small text-dim mt-8">${c.uses}× benutzt</div>
        </div>
        <div class="actions">
          <button class="sm secondary" onclick="toggleCommand('${c.id}', ${!c.enabled})">${c.enabled ? '⏸️ Deaktivieren' : '▶️ Aktivieren'}</button>
          <button class="sm secondary" onclick="editCommand('${c.id}','${esc(c.response).replaceAll("'", "\\'")}')">✏️ Bearbeiten</button>
          <button class="sm danger" onclick="deleteCommand('${c.id}','${esc(c.trigger)}')">🗑️ Löschen</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    el.innerHTML = `<div class="empty-state">Fehler: ${esc(err.message)}</div>`;
  }
}

async function savePrefix() {
  const prefix = document.getElementById('cmd-prefix').value.trim();
  try {
    await api('PUT', `/api/commands/${guildId}/prefix`, { prefix });
    toast('Präfix gespeichert.');
  } catch (err) { toast(err.message, true); }
}

async function createCommand() {
  const trigger = document.getElementById('new-cmd-trigger').value.trim();
  const response = document.getElementById('new-cmd-response').value.trim();
  const useEmbed = document.getElementById('new-cmd-embed').checked;
  const embedColor = document.getElementById('new-cmd-color').value;
  if (!trigger || !response) return toast('Trigger und Antwort sind erforderlich.', true);

  try {
    await api('POST', `/api/commands/${guildId}`, { trigger, response, useEmbed, embedColor });
    toast(`Befehl "${trigger}" erstellt.`);
    document.getElementById('new-cmd-trigger').value = '';
    document.getElementById('new-cmd-response').value = '';
    loadCommands();
  } catch (err) { toast(err.message, true); }
}

async function toggleCommand(id, enabled) {
  try {
    await api('PATCH', `/api/commands/${guildId}/${id}`, { enabled });
    loadCommands();
  } catch (err) { toast(err.message, true); }
}

async function editCommand(id, currentResponse) {
  const response = prompt('Neue Antwort:', currentResponse);
  if (response === null) return;
  try {
    await api('PATCH', `/api/commands/${guildId}/${id}`, { response });
    toast('Befehl aktualisiert.');
    loadCommands();
  } catch (err) { toast(err.message, true); }
}

async function deleteCommand(id, trigger) {
  if (!confirm(`Befehl "${trigger}" wirklich löschen?`)) return;
  try {
    await api('DELETE', `/api/commands/${guildId}/${id}`);
    toast('Befehl gelöscht.');
    loadCommands();
  } catch (err) { toast(err.message, true); }
}

// ════════════════════════════════════════════════════════════════════
// LOGS
// ════════════════════════════════════════════════════════════════════
async function loadLogs() {
  const el = document.getElementById('logs-content');
  el.innerHTML = '<div class="loading">Lade Logs</div>';
  const type = document.getElementById('log-filter').value;
  try {
    const logs = await api('GET', `/api/logs/${guildId}?type=${type}&limit=100`);
    if (logs.length === 0) {
      el.innerHTML = '<div class="empty-state">Keine Log-Einträge gefunden.</div>';
      return;
    }
    el.innerHTML = logs.map(l => `
      <div class="log-entry ${l.type}">
        <strong>[${l.type}]</strong> ${esc(l.message)}
        <div class="meta">${fmtDate(l.createdAt)}${l.authorId ? ` · von <@${l.authorId}>` : ''}</div>
      </div>
    `).join('');
  } catch (err) {
    el.innerHTML = `<div class="empty-state">Fehler: ${esc(err.message)}</div>`;
  }
}
document.getElementById('log-filter').addEventListener('change', loadLogs);

// ════════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════════
async function loadSettings() {
  try {
    const [channels, roles, settings] = await Promise.all([getChannels(), getRoles(), api('GET', `/api/guilds/${guildId}/settings`)]);

    document.getElementById('antiRaidEnabled').checked = settings.antiRaidEnabled;
    document.getElementById('antiSpamEnabled').checked = settings.antiSpamEnabled;
    document.getElementById('joinThreshold').value = settings.joinThreshold || '';
    document.getElementById('windowSec').value = settings.windowSec || '';

    document.getElementById('logChannelId').innerHTML = channelOptions(channels, ['text'], settings.logChannelId);
    document.getElementById('ticketCategoryId').innerHTML = channelOptions(channels, ['category'], settings.ticketCategoryId);

    let roleSelectHtml = '<option value="">— Nicht gesetzt —</option>';
    for (const r of roles) {
      roleSelectHtml += `<option value="${r.id}" ${r.id === settings.modRoleId ? 'selected' : ''}>${esc(r.name)}</option>`;
    }
    document.getElementById('modRoleId').innerHTML = roleSelectHtml;

    if (cache.isBotOwner) {
      document.getElementById('owner-card').style.display = 'block';
    }
  } catch (err) {
    toast(err.message, true);
  }
}

async function saveGeneralSettings() {
  const body = {
    antiRaidEnabled: document.getElementById('antiRaidEnabled').checked,
    antiSpamEnabled: document.getElementById('antiSpamEnabled').checked,
    joinThreshold: parseInt(document.getElementById('joinThreshold').value) || null,
    windowSec: parseInt(document.getElementById('windowSec').value) || null,
    logChannelId: document.getElementById('logChannelId').value || null,
    modRoleId: document.getElementById('modRoleId').value || null,
    ticketCategoryId: document.getElementById('ticketCategoryId').value || null,
  };
  try {
    await api('PUT', `/api/config/${guildId}`, body);
    toast('Einstellungen gespeichert.');
  } catch (err) { toast(err.message, true); }
}

async function toggleWhitelist(add) {
  if (!confirm(add ? 'Server zur Whitelist hinzufügen?' : 'Server von der Whitelist entfernen? Der Bot verlässt den Server sofort.')) return;
  try {
    await api('POST', `/api/config/${guildId}/whitelist`, { action: add ? 'add' : 'remove' });
    toast('Whitelist aktualisiert.');
    if (!add) setTimeout(() => location.href = '/dashboard', 1500);
  } catch (err) { toast(err.message, true); }
}
