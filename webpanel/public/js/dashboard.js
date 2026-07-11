(async function init() {
  // Load user info
  try {
    const me = await api('GET', '/api/me');
    document.getElementById('username').textContent = `Eingeloggt als ${me.username}`;
  } catch { /* ignore */ }

  // Load guilds
  try {
    const guilds = await api('GET', '/api/guilds');
    document.getElementById('loading').style.display = 'none';

    if (guilds.length === 0) {
      document.getElementById('empty').style.display = 'block';
      return;
    }

    const grid = document.getElementById('grid');
    grid.innerHTML = guilds.map(g => {
      const icon = g.icon || 'https://cdn.discordapp.com/embed/avatars/0.png';
      let statusBadge;
      if (!g.botActive) {
        statusBadge = '<span class="badge gray">Bot nicht aktiv</span>';
      } else if (g.isWhitelisted) {
        statusBadge = '<span class="badge green">✅ Autorisiert</span>';
      } else {
        statusBadge = '<span class="badge red">❌ Nicht autorisiert</span>';
      }

      return `
        <div class="guild-card">
          <img src="${icon}" alt="${esc(g.name)}"/>
          <h3>${esc(g.name)}</h3>
          <div>${statusBadge}</div>
          ${g.memberCount !== null ? `<span class="small text-dim">${g.memberCount} Mitglieder</span>` : ''}
          ${g.botActive
            ? `<a href="/server/${g.id}" class="btn btn-sm">Verwalten →</a>`
            : `<button class="btn-sm secondary" disabled>Bot nicht im Server</button>`
          }
        </div>`;
    }).join('');
  } catch (err) {
    document.getElementById('loading').textContent = 'Fehler beim Laden: ' + err.message;
  }
})();
