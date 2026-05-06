import { state, PW_HASH } from './data.js';
import {
  wPost, getWorker, showToast, setTopStatus, setStatus,
  setBtnLoading, resetBtn, handleError, hashInput,
  filterTable, buildSortableTable, logAction, renderLog,
  genSpark, sparkSVG, kr, pct, fmt,
} from './helpers.js';
import {
  renderAll, renderStats, renderBudget, renderRoas,
  renderCampaignsTable, renderKeywordsView, renderSearchTermsView,
  renderAdGroupsTable, renderAdsTable, renderHistoryCharts,
  renderHistoryTable, renderStructure, renderNegAdded,
} from './render.js';
import {
  runTabAnalysis, generateCampaignStructure, generateNegativeKeywords,
  analyseSearchTerms, sendChat, suggestKeywords, generateAdCopy,
  testDailyAlert, testMonthlyReport, saveCampaignMemoryNow, loadCampaignMemory,
} from './ai.js';
import { generateReport } from './report.js';

// ═══ WINDOW-EKSPONERING (for dynamisk HTML) ════════════════════════
window.quickAddNeg  = quickAddNeg;
window.removeNegKw  = removeNegKw;
window.copyTag      = copyTag;

// ═══ INIT ═════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  bindEvents();
  showPage('oversikt');

  const savedPW = sessionStorage.getItem('nv_pw');
  if (savedPW) { state.sessionPW = savedPW; showPage('oversikt'); }
  else showOnboarding();
});

function initTheme() {
  const saved = localStorage.getItem('nv_theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
}

export function toggleDark() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
  localStorage.setItem('nv_theme', isDark ? '' : 'dark');
}

// ═══ ONBOARDING ═══════════════════════════════════════════════════
function showOnboarding() {
  const ob = document.getElementById('onboarding');
  if (ob) ob.style.display = 'flex';
  showObStep(0);
}

function showObStep(n) {
  state.obStep = n;
  document.querySelectorAll('.ob-step').forEach((s, i) => {
    s.style.display = i === n ? 'block' : 'none';
  });
}

export function obNext() {
  showObStep(state.obStep + 1);
}

export async function checkGate() {
  const input = document.getElementById('pw-input');
  if (!input) return;
  const val    = input.value.trim();
  const errEl  = document.getElementById('pw-error');
  const hashed = await hashInput(val);
  if (hashed === PW_HASH) {
    state.sessionPW = val;
    sessionStorage.setItem('nv_pw', val);
    closeOnboarding();
  } else {
    if (errEl) errEl.textContent = 'Feil passord. Prøv igjen.';
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 500);
  }
}

export function closeOnboarding() {
  const ob = document.getElementById('onboarding');
  if (ob) ob.style.display = 'none';
}

// ═══ NAVIGASJON ═══════════════════════════════════════════════════
export function showPage(name) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('[data-page]').forEach(b => b.classList.remove('active'));

  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  document.querySelectorAll(`[data-page="${name}"]`).forEach(b => b.classList.add('active'));
  window.scrollTo(0, 0);
}

// ═══ DATAHENTING ═════════════════════════════════════════════════
export async function fetchAll() {
  const btn    = document.getElementById('fetch-btn');
  const status = document.getElementById('top-status');
  const dateFrom = document.getElementById('date-from')?.value;
  const dateTo   = document.getElementById('date-to')?.value;

  setBtnLoading(btn, 'Henter...');
  setTopStatus('Henter kampanjedata...', '');

  try {
    const [camps, ags, ads, kws] = await Promise.all([
      wPost('/campaigns',  { dateFrom, dateTo }),
      wPost('/adgroups',   { dateFrom, dateTo }),
      wPost('/ads',        { dateFrom, dateTo }),
      wPost('/keywords',   { dateFrom, dateTo }),
    ]);

    state.D.campaigns = camps.campaigns || [];
    state.D.adGroups  = ags.adGroups    || [];
    state.D.ads       = ads.ads         || [];
    state.D.keywords  = kws.keywords    || [];

    // Generer sparkline-data
    state.sparkData = {};
    state.D.campaigns.forEach(c => { state.sparkData[c.name] = genSpark(c); });

    renderAll();
    setTopStatus('Sist oppdatert: ' + new Date().toLocaleTimeString('nb-NO'), 'green');
    logAction('Hentet kampanjedata — ' + state.D.campaigns.length + ' kampanjer');
    showToast('ok', 'Data oppdatert');
  } catch (err) {
    setTopStatus('Feil: ' + err.message, 'red');
    showToast('err', err.message);
  } finally {
    resetBtn(btn, 'Hent live data');
  }
}

export async function fetchSearchTerms() {
  const btn    = document.getElementById('st-fetch-btn');
  const status = document.getElementById('st-status');
  setBtnLoading(btn, 'Henter...');
  setStatus(status, 'loading', 'Henter søketermer...');
  try {
    const dateFrom = document.getElementById('date-from')?.value;
    const dateTo   = document.getElementById('date-to')?.value;
    const res = await wPost('/searchterms', { dateFrom, dateTo });
    state.D.searchterms = res.searchterms || [];
    renderSearchTermsView();
    populateCampaignFilter();
    setStatus(status, 'ok', `✓ ${state.D.searchterms.length} søketermer`);
    logAction('Hentet ' + state.D.searchterms.length + ' søketermer');
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn, 'Hent søketermer');
  }
}

function populateCampaignFilter() {
  const sel = document.getElementById('st-campaign-filter');
  if (!sel) return;
  const camps = [...new Set(state.D.searchterms.map(t => t.campaign))].filter(Boolean).sort();
  sel.innerHTML = '<option value="">Alle kampanjer</option>' +
    camps.map(c => `<option value="${c}">${c}</option>`).join('');
}

// ═══ SAMMENLIGN ════════════════════════════════════════════════════
export async function runComparison() {
  const btn    = document.getElementById('cmp-run-btn');
  const status = document.getElementById('cmp-status');
  const out    = document.getElementById('cmp-out');
  if (!out) return;

  const from1 = document.getElementById('cmp-from1')?.value;
  const to1   = document.getElementById('cmp-to1')?.value;
  const from2 = document.getElementById('cmp-from2')?.value;
  const to2   = document.getElementById('cmp-to2')?.value;
  if (!from1 || !to1 || !from2 || !to2) {
    showToast('err', 'Fyll inn begge datoperioder');
    return;
  }

  setBtnLoading(btn, 'Henter...');
  setStatus(status, 'loading', 'Henter sammenligningsdata...');

  try {
    const [r1, r2] = await Promise.all([
      wPost('/campaigns', { dateFrom: from1, dateTo: to1 }),
      wPost('/campaigns', { dateFrom: from2, dateTo: to2 }),
    ]);
    const p1 = r1.campaigns || [], p2 = r2.campaigns || [];

    const buildRow = (c1, c2) => {
      const name    = c1?.name || c2?.name || '—';
      const spend1  = c1 ? c1.costMicros / 1e6 : 0;
      const spend2  = c2 ? c2.costMicros / 1e6 : 0;
      const ctr1    = c1?.ctr  || 0, ctr2  = c2?.ctr  || 0;
      const conv1   = c1?.conversions || 0, conv2 = c2?.conversions || 0;
      const delta   = (v1, v2) => {
        if (!v1) return '';
        const d = ((v2 - v1) / v1 * 100).toFixed(1);
        const cls = parseFloat(d) > 0 ? 'zone-green' : parseFloat(d) < 0 ? 'zone-red' : '';
        return `<span class="${cls}">${parseFloat(d) > 0 ? '+' : ''}${d}%</span>`;
      };
      return `<tr>
        <td style="font-weight:500">${name}</td>
        <td class="mono">kr ${spend1.toFixed(0)}</td>
        <td class="mono">kr ${spend2.toFixed(0)}</td>
        <td class="mono">${delta(spend1, spend2)}</td>
        <td class="mono">${(ctr1 * 100).toFixed(2)}%</td>
        <td class="mono">${(ctr2 * 100).toFixed(2)}%</td>
        <td class="mono">${delta(ctr1, ctr2)}</td>
        <td class="mono">${conv1.toFixed(1)}</td>
        <td class="mono">${conv2.toFixed(1)}</td>
        <td class="mono">${delta(conv1, conv2)}</td>
      </tr>`;
    };

    const allNames = [...new Set([...p1.map(c => c.name), ...p2.map(c => c.name)])];
    const rows = allNames.map(name => {
      const c1 = p1.find(c => c.name === name);
      const c2 = p2.find(c => c.name === name);
      return buildRow(c1, c2);
    }).join('');

    out.innerHTML = `<div class="table-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:var(--ink);color:var(--bg)">
        <th style="padding:8px;text-align:left">Kampanje</th>
        <th style="padding:8px;text-align:left">Forbruk P1</th>
        <th style="padding:8px;text-align:left">Forbruk P2</th>
        <th style="padding:8px">Δ Forbruk</th>
        <th style="padding:8px">CTR P1</th>
        <th style="padding:8px">CTR P2</th>
        <th style="padding:8px">Δ CTR</th>
        <th style="padding:8px">Konv. P1</th>
        <th style="padding:8px">Konv. P2</th>
        <th style="padding:8px">Δ Konv.</th>
      </tr></thead><tbody>${rows}</tbody></table></div>`;
    setStatus(status, 'ok', '✓ Sammenligning klar');
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn, 'Sammenlign');
  }
}

// ═══ HISTORIKK ════════════════════════════════════════════════════
export async function fetchHistory() {
  const btn    = document.getElementById('hist-fetch-btn');
  const status = document.getElementById('hist-status');
  setBtnLoading(btn, 'Henter...');
  setStatus(status, 'loading', 'Henter historikk...');
  try {
    const res = await wPost('/history', {});
    const snaps = res.snapshots || [];
    renderHistoryCharts(snaps);
    renderHistoryTable(snaps);
    setStatus(status, 'ok', `✓ ${snaps.length} uker`);
    logAction('Hentet historikk — ' + snaps.length + ' uker');
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn, 'Hent historikk');
  }
}

export async function saveSnapshotNow() {
  const btn    = document.getElementById('hist-snapshot-btn');
  const status = document.getElementById('hist-status');
  if (!state.D.campaigns.length) { showToast('err', 'Hent data først'); return; }
  setBtnLoading(btn, 'Lagrer...');
  try {
    const spend  = state.D.campaigns.reduce((s, c) => s + c.costMicros, 0) / 1e6;
    const clicks = state.D.campaigns.reduce((s, c) => s + c.clicks, 0);
    const conv   = state.D.campaigns.reduce((s, c) => s + c.conversions, 0);
    const impr   = state.D.campaigns.reduce((s, c) => s + c.impressions, 0);
    await wPost('/history/save', {
      totalSpend: spend, totalClicks: clicks, totalConv: conv,
      avgCtr: impr ? clicks / impr : 0,
      cpa: conv > 0 ? spend / conv : 0,
    });
    setStatus(status, 'ok', '✓ Snapshot lagret');
    logAction('Lagret historikk-snapshot');
    showToast('ok', 'Snapshot lagret');
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn, 'Lagre snapshot');
  }
}

// ═══ STRUKTURKART ═════════════════════════════════════════════════
export async function fetchStructure() {
  const btn    = document.getElementById('struct-fetch-btn');
  const status = document.getElementById('struct-status');
  setBtnLoading(btn, 'Henter...');
  setStatus(status, 'loading', 'Henter kontostruktur...');
  try {
    const res = await wPost('/structure', {});
    state.structData = res;
    renderStructure(res, '');
    setStatus(status, 'ok', `✓ ${res.campaigns?.length || 0} kampanjer`);
    logAction('Hentet kontostruktur');
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn, 'Hent struktur');
  }
}

// ═══ NEGATIVE SØKEORD ═════════════════════════════════════════════
export function addNegKw() {
  const kwEl    = document.getElementById('neg-kw-input');
  const matchEl = document.getElementById('neg-match-select');
  const campEl  = document.getElementById('neg-camp-select');
  if (!kwEl) return;
  const kw = kwEl.value.trim();
  if (!kw) { showToast('err', 'Skriv inn et søkeord'); return; }
  state.negKwList.push({
    kw,
    match: matchEl?.value || 'EXACT',
    camp:  campEl?.value  || 'Alle',
    added: new Date().toLocaleTimeString('nb-NO'),
  });
  kwEl.value = '';
  renderNegAdded();
  logAction(`La til negativt søkeord: "${kw}"`);
  showToast('ok', '"' + kw + '" lagt til');
}

export function quickAddNeg(kw, match = 'BROAD') {
  state.negKwList.push({ kw, match, camp: 'Alle', added: new Date().toLocaleTimeString('nb-NO') });
  renderNegAdded();
  logAction(`Hurtig-lagt til negativt: "${kw}"`);
  showToast('ok', '"' + kw + '" lagt til som negativ');
}

export function removeNegKw(i) {
  const removed = state.negKwList.splice(i, 1)[0];
  renderNegAdded();
  if (removed) logAction(`Fjernet negativt søkeord: "${removed.kw}"`);
}

// ═══ EKSPORT CSV ═════════════════════════════════════════════════
export function exportCSV(type) {
  const maps = {
    keywords: {
      data: state.D.keywords,
      cols: ['keyword', 'matchType', 'campaign', 'impressions', 'clicks', 'ctr', 'costMicros', 'conversions', 'qs'],
    },
    campaigns: {
      data: state.D.campaigns,
      cols: ['name', 'status', 'type', 'impressions', 'clicks', 'ctr', 'costMicros', 'conversions', 'conversionRate'],
    },
    adgroups: {
      data: state.D.adGroups,
      cols: ['name', 'campaign', 'status', 'impressions', 'clicks', 'ctr', 'costMicros', 'conversions'],
    },
    ads: {
      data: state.D.ads,
      cols: ['headline', 'campaign', 'status', 'impressions', 'clicks', 'ctr', 'conversions'],
    },
    searchterms: {
      data: state.D.searchterms,
      cols: ['term', 'status', 'campaign', 'impressions', 'clicks', 'ctr', 'costMicros', 'conversions'],
    },
    negatives: {
      data: state.negKwList,
      cols: ['kw', 'match', 'camp', 'added'],
    },
  };
  const m = maps[type];
  if (!m || !m.data.length) { showToast('err', 'Ingen data å eksportere'); return; }
  const header = m.cols.join(',');
  const rows   = m.data.map(r => m.cols.map(c => JSON.stringify(r[c] ?? '')).join(','));
  const blob   = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = `novooi-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  logAction(`Eksporterte ${m.data.length} ${type}-rader til CSV`);
}

// ═══ TABELLSORTERING (via event delegation) ════════════════════════
export function sortCol(tableId, key, colIdx) {
  const ss  = state.sortState[key] || { col: null, dir: 1 };
  const dir = ss.col === colIdx ? ss.dir * -1 : 1;
  state.sortState[key] = { col: colIdx, dir };

  if (tableId === 'campaigns-tbl')  renderCampaignsTable();
  if (tableId === 'adgroups-tbl')   renderAdGroupsTable();
  if (tableId === 'ads-tbl')        renderAdsTable();
}

// ═══ KOPIER TAG ════════════════════════════════════════════════════
export function copyTag(text, el) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = el.textContent;
    el.textContent = '✓ Kopiert';
    el.style.background = 'var(--good)';
    el.style.color       = '#fff';
    setTimeout(() => { el.textContent = orig; el.style.background = ''; el.style.color = ''; }, 1500);
  });
}

// ═══ EVENT BINDING ════════════════════════════════════════════════
function bindEvents() {
  const on  = (id, evt, fn) => document.getElementById(id)?.addEventListener(evt, fn);
  const onQ = (sel, evt, fn) => document.querySelectorAll(sel).forEach(el => el.addEventListener(evt, fn));

  // ── Auth ─────────────────────────────────────────────────────────
  on('pw-input', 'keydown', e => e.key === 'Enter' && checkGate());
  on('check-gate-btn', 'click', checkGate);
  on('ob-next-btn', 'click', obNext);
  on('close-ob-btn', 'click', closeOnboarding);
  on('theme-toggle', 'click', toggleDark);

  // ── Navigasjon (event delegation) ────────────────────────────────
  document.addEventListener('click', e => {
    const navBtn = e.target.closest('[data-page]');
    if (navBtn) showPage(navBtn.dataset.page);
  });

  // ── Datahenting ─────────────────────────────────────────────────
  on('fetch-btn',        'click', fetchAll);
  on('st-fetch-btn',     'click', fetchSearchTerms);
  on('struct-fetch-btn', 'click', fetchStructure);
  on('hist-fetch-btn',   'click', fetchHistory);
  on('hist-snapshot-btn','click', saveSnapshotNow);

  // ── Budget / ROAS kalkulatorer ────────────────────────────────────
  on('budget-input', 'input', renderBudget);
  on('roas-input',   'input', renderRoas);

  // ── Kampanjer ────────────────────────────────────────────────────
  on('camp-search',    'input', e => filterTable('campaigns-tbl', e.target.value));
  on('camp-export-btn','click', () => exportCSV('campaigns'));

  // ── Søkeord ──────────────────────────────────────────────────────
  on('kw-search',         'input',  () => renderKeywordsView());
  on('kw-match-filter',   'change', () => renderKeywordsView());
  on('kw-sort-field',     'change', () => renderKeywordsView());
  on('kw-qs-filter',      'change', () => renderKeywordsView());
  on('kw-export-btn',     'click',  () => exportCSV('keywords'));
  on('kw-suggest-btn',    'click',  suggestKeywords);
  on('kw-toggle-btn',     'click',  () => {
    state.kwViewMode = state.kwViewMode === 'grouped' ? 'flat' : 'grouped';
    const btn = document.getElementById('kw-toggle-btn');
    if (btn) btn.textContent = state.kwViewMode === 'grouped' ? 'Flat visning' : 'Gruppert visning';
    renderKeywordsView();
  });

  // ── Søketermer ────────────────────────────────────────────────────
  on('st-search',          'input',  () => renderSearchTermsView());
  on('st-status-filter',   'change', () => renderSearchTermsView());
  on('st-sort-field',      'change', () => renderSearchTermsView());
  on('st-campaign-filter', 'change', () => renderSearchTermsView());
  on('st-export-btn',      'click',  () => exportCSV('searchterms'));
  on('st-analyse-btn',     'click',  analyseSearchTerms);

  // ── Annonsegrupper ────────────────────────────────────────────────
  on('adgroups-search',    'input', e => filterTable('adgroups-tbl', e.target.value));
  on('adgroups-export-btn','click', () => exportCSV('adgroups'));

  // ── Annonser ─────────────────────────────────────────────────────
  on('ads-search',    'input', e => filterTable('ads-tbl', e.target.value));
  on('ads-export-btn','click', () => exportCSV('ads'));
  on('gen-ad-btn',    'click', generateAdCopy);

  // ── Tone-velger (event delegation) ────────────────────────────────
  document.addEventListener('click', e => {
    const toneBtn = e.target.closest('[data-tone]');
    if (!toneBtn) return;
    state.selectedTone = toneBtn.dataset.tone;
    document.querySelectorAll('[data-tone]').forEach(b => b.classList.remove('active'));
    toneBtn.classList.add('active');
  });

  // ── AI-analyse ───────────────────────────────────────────────────
  on('analyse-campaigns-btn', 'click', () => runTabAnalysis('campaigns'));
  on('analyse-keywords-btn',  'click', () => runTabAnalysis('keywords'));
  on('analyse-ads-btn',       'click', () => runTabAnalysis('ads'));

  // ── Negative søkeord ─────────────────────────────────────────────
  on('neg-add-btn',  'click', addNegKw);
  on('neg-kw-input', 'keydown', e => e.key === 'Enter' && addNegKw());
  on('neg-export-btn','click', () => exportCSV('negatives'));
  on('gen-neg-btn',   'click', generateNegativeKeywords);

  // ── Sammenlign ───────────────────────────────────────────────────
  on('cmp-run-btn', 'click', runComparison);

  // ── Strukturkart ─────────────────────────────────────────────────
  on('struct-search-input', 'input', e => {
    if (state.structData) renderStructure(state.structData, e.target.value);
  });

  // ── AI-verktøy ───────────────────────────────────────────────────
  on('gen-structure-btn',  'click', generateCampaignStructure);
  on('chat-send-btn',      'click', sendChat);
  on('chat-input',         'keydown', e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendChat()));

  // ── Varsling & logg ───────────────────────────────────────────────
  on('test-daily-btn',   'click', testDailyAlert);
  on('test-monthly-btn', 'click', testMonthlyReport);
  on('clear-log-btn',    'click', () => { state.actLog = []; renderLog(); });

  // ── Rapport ──────────────────────────────────────────────────────
  on('gen-report-btn', 'click', generateReport);

  // ── Hukommelse ───────────────────────────────────────────────────
  on('save-memory-btn', 'click', saveCampaignMemoryNow);
  on('load-memory-btn', 'click', loadCampaignMemory);

  // ── EVENT DELEGATION: tabellsortering ─────────────────────────────
  document.addEventListener('click', e => {
    const th = e.target.closest('th[data-sort-table]');
    if (!th) return;
    sortCol(th.dataset.sortTable, th.dataset.sortKey, parseInt(th.dataset.sortCol));
  });

  // ── EVENT DELEGATION: accordion ───────────────────────────────────
  document.addEventListener('click', e => {
    const header = e.target.closest('[data-accordion]');
    if (!header) return;
    const body = header.nextElementSibling;
    if (body) body.classList.toggle('open');
    const arrow = header.querySelector('.ai-acc-arrow');
    if (arrow) arrow.textContent = body?.classList.contains('open') ? '▴' : '▾';
  });

  // ── EVENT DELEGATION: søkeord-gruppe toggle ────────────────────────
  document.addEventListener('click', e => {
    const header = e.target.closest('[data-kw-toggle]');
    if (!header) return;
    const table = header.nextElementSibling;
    if (table) table.classList.toggle('open');
  });

  // ── EVENT DELEGATION: strukturkart ────────────────────────────────
  document.addEventListener('click', e => {
    const campHeader = e.target.closest('[data-struct-toggle="camp"]');
    if (campHeader) {
      const list   = campHeader.closest('.camp-node')?.querySelector('.ag-list');
      const toggle = campHeader.querySelector('.camp-toggle');
      if (list)   list.classList.toggle('open');
      if (toggle) toggle.textContent = list?.classList.contains('open') ? '▾' : '▸';
      return;
    }
    const agHeader = e.target.closest('[data-struct-toggle="ag"]');
    if (agHeader) {
      const list = agHeader.closest('.ag-node')?.querySelector('.kw-list');
      if (list) list.classList.toggle('open');
    }
  });
}
