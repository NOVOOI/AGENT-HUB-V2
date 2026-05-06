import { BENCHMARKS, state } from './data.js';

// ═══ FORMATERING ═════════════════════════════════════════════════
export const kr  = (m) => m ? 'kr ' + (m / 1e6).toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—';
export const pct = (n) => n ? (n * 100).toFixed(2) + '%' : '—';
export const fmt = (n) => n ? Number(n).toLocaleString('nb-NO') : '—';

export function ctrClass(v, type) {
  const bench = type === 'DISPLAY' ? BENCHMARKS.ctr.display : BENCHMARKS.ctr.search;
  if (v > bench * 1.3) return 'zone-green';
  if (v < bench * 0.7) return 'zone-red';
  return 'zone-orange';
}

export function convClass(v) {
  if (v > BENCHMARKS.convRate * 1.2) return 'zone-green';
  if (v < BENCHMARKS.convRate * 0.6) return 'zone-red';
  return '';
}

export function statusBadge(s) {
  if (s === 'ENABLED') return '<span class="badge b-green">Aktiv</span>';
  if (s === 'PAUSED')  return '<span class="badge b-orange">Pauset</span>';
  return `<span class="badge b-gray">${s}</span>`;
}

export function matchBadge(m) {
  const labels = { EXACT: 'Eksakt', PHRASE: 'Frase', BROAD: 'Bred' };
  return `<span class="badge b-gray">${labels[m] || m}</span>`;
}

// ═══ SPARKLINE ════════════════════════════════════════════════════
export function sparkSVG(name) {
  const d = state.sparkData[name];
  if (!d?.length) return '';
  const w = 70, h = 20, mx = Math.max(...d), mn = Math.min(...d);
  const pts = d.map((v, i) => {
    const x = i * (w / (d.length - 1));
    const y = h - ((v - mn) / (mx - mn || 1)) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(' ');
  return `<svg class="sparkline" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function genSpark(camp) {
  const base = (camp?.ctr || 0.02) * 100;
  const vol  = Math.max(base * 0.3, 0.2);
  return Array.from({ length: 14 }, (_, i) =>
    Math.max(0, base + (Math.random() - 0.5) * vol * 2 + Math.sin(i / 3) * vol * 0.5)
  );
}

// ═══ WORKER / FETCH ═══════════════════════════════════════════════
export function getWorker() {
  // Sjekk topbar-input først, fallback til onboarding-input
  const raw = document.getElementById('worker-url-tb')?.value.trim()
    || document.getElementById('worker-url')?.value.trim()
    || '';
  let v = raw.replace(/\/$/, '');
  if (v && !v.startsWith('http')) v = 'https://' + v;
  return v;
}

export async function wPost(path, body) {
  const url = getWorker();
  if (!url) throw new Error('Lim inn Worker URL');
  const r = await fetch(url + path, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Password': state.sessionPW },
    body:    JSON.stringify(body),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d;
}

// ═══ FEILHÅNDTERING ───────────────────────────────────────────────
/** Sett error-status og vis toast med én linje */
export function handleError(statusEl, err) {
  console.error(err);
  setStatus(statusEl, 'err', 'Feil: ' + err.message);
  showToast('err', err.message);
}

// ═══ UI FEEDBACK ══════════════════════════════════════════════════
export function showToast(type, msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'on' + (type === 'err' ? ' err' : type === 'ok' ? ' ok' : '');
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => { el.className = ''; }, 4000);
}

export function setTopStatus(msg, color) {
  const el = document.getElementById('top-status');
  if (!el) return;
  el.textContent = '— ' + msg;
  el.className = 'tb-status' + (color === 'green' ? ' ok' : color === 'red' ? ' err' : '');
}

/**
 * Sett status-element til loading / ok / err.
 * type: 'loading' | 'ok' | 'err'
 */
export function setStatus(el, type, msg) {
  if (!el) return;
  el.className = 'status on' + (type === 'ok' ? ' ok' : type === 'err' ? ' err' : '');
  el.textContent = msg;
}

/** Deaktiver knapp og vis spinner. Lagrer original tekst i dataset. */
export function setBtnLoading(btn, label = 'Laster...') {
  if (!btn) return;
  btn.disabled = true;
  btn.dataset.originalText = btn.textContent;
  btn.innerHTML = `<span class="spinner"></span> ${label}`;
}

/** Reaktiver knapp. Bruker lagret originalText om label ikke oppgis. */
export function resetBtn(btn, label) {
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = label ?? btn.dataset.originalText ?? 'OK';
}

// ═══ AUTH ═════════════════════════════════════════════════════════
export async function hashInput(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ═══ TABELBYGGER ══════════════════════════════════════════════════
export function buildTable(data, cols) {
  if (!data?.length) return '<p style="font-size:14px;color:var(--ink3);padding:16px">Ingen data</p>';
  return '<table><thead><tr>' +
    cols.map(c => `<th>${c.label}</th>`).join('') +
    '</tr></thead><tbody>' +
    data.map(r => '<tr>' + cols.map(c => `<td>${c.render(r)}</td>`).join('') + '</tr>').join('') +
    '</tbody></table>';
}

/**
 * Bygg sorterbar tabell. Kolonneheadere får data-sort-* attributter
 * som brukes av event delegation i app.js.
 */
export function buildSortableTable(tableId, key, data, cols) {
  const tbl = document.getElementById(tableId);
  if (!tbl) return;
  const ss     = state.sortState[key] || { col: null, dir: 1 };
  const sorted = [...data];
  if (ss.col !== null) {
    const col = cols[ss.col];
    sorted.sort((a, b) => {
      let va = a[col.key], vb = b[col.key];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      return va > vb ? ss.dir : va < vb ? -ss.dir : 0;
    });
  }
  tbl.innerHTML =
    '<thead><tr>' +
    cols.map((c, i) => {
      const cls = ss.col === i ? (ss.dir === 1 ? ' sort-asc' : ' sort-desc') : '';
      return `<th class="${cls}" data-sort-table="${tableId}" data-sort-key="${key}" data-sort-col="${i}">${c.label}</th>`;
    }).join('') +
    '</tr></thead><tbody>' +
    sorted.map(r =>
      `<tr data-search="${Object.values(r).join(' ').toLowerCase()}">` +
      cols.map(c => `<td>${c.render(r)}</td>`).join('') +
      '</tr>'
    ).join('') +
    '</tbody>';
}

export function filterTable(tableId, query) {
  const tbl = document.getElementById(tableId);
  if (!tbl) return;
  const q = query.toLowerCase();
  tbl.querySelectorAll('tbody tr').forEach(row => {
    row.style.display = !q || (row.getAttribute('data-search') || '').includes(q) ? '' : 'none';
  });
}

// ═══ AKTIVITETSLOGG ═══════════════════════════════════════════════
export function logAction(msg) {
  state.actLog.unshift({ time: new Date().toLocaleTimeString('nb-NO'), msg });
  if (state.actLog.length > 50) state.actLog.pop();
  renderLog();
}

export function renderLog() {
  const el = document.getElementById('log-content');
  if (!el) return;
  el.innerHTML = state.actLog.length
    ? state.actLog.map(e => `<div class="log-entry"><span class="log-time">${e.time}</span><span>${e.msg}</span></div>`).join('')
    : '<div class="log-empty">Ingen aktivitet ennå.</div>';
}

// ═══ SCRIPT-LASTER ════════════════════════════════════════════════
export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}
