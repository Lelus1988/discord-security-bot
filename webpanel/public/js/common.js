// ── Shared helpers used across all dashboard pages ───────────────────────

/** Wrapper around fetch() that handles JSON + error responses uniformly. */
async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

/** Show a toast notification (green = success, red = error). */
function toast(message, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.className = isError ? 'error' : '';
  el.style.display = 'block';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

/** Escape HTML special characters to prevent injection when inserting user content. */
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Format an ISO date string as a short local date/time. */
function fmtDate(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** Build a <select> options list from channels, optionally filtered by type. */
function channelOptions(channels, types, selectedId, includeEmpty = true) {
  const filtered = channels.filter(c => types.includes(c.type));
  let html = includeEmpty ? '<option value="">— Nicht gesetzt —</option>' : '';
  for (const c of filtered) {
    const prefix = c.type === 'category' ? '📁 ' : c.type === 'voice' ? '🔊 ' : '# ';
    html += `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${prefix}${esc(c.name)}</option>`;
  }
  return html;
}

// Toast element is injected on every page that includes this script
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('toast')) {
    const div = document.createElement('div');
    div.id = 'toast';
    document.body.appendChild(div);
  }
});
