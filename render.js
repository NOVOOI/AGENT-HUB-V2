import { state, BENCHMARKS } from './data.js';
import {
  kr, pct, fmt, ctrClass, convClass, statusBadge, matchBadge,
  sparkSVG, buildTable, buildSortableTable,
} from './helpers.js';

// ═══ RENDER ALL ═══════════════════════════════════════════════════
export function renderAll() {
  renderStats();
  renderBudget();
  renderRoas();
  renderChecklist();
  renderHealthScores();
  renderFunnel();
  renderTopCampaigns();
  renderCampaignsTable();
  renderKeywordsView();
  renderAdGroupsTable();
  renderAdsTable();
  renderNegAdded();
  renderQsGuide();
  requestNotificationPermission();
}

// ═══ STATISTIKK-KORT ══════════════════════════════════════════════
export function renderStats() {
  const { D } = state;
  const totalSpend  = D.campaigns.reduce((s, c) => s + c.costMicros, 0);
  const totalClicks = D.campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalImpr   = D.campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalConv   = D.campaigns.reduce((s, c) => s + c.conversions, 0);
  const avgCtr      = totalImpr ? totalClicks / totalImpr : 0;
  const cpa         = totalConv ? (totalSpend / 1e6) / totalConv : 0;
  const ctrVsBench  = avgCtr / BENCHMARKS.ctr.search;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card">
      <span class="stat-value">${kr(totalSpend)}</span>
      <span class="stat-label">Forbruk (periode)</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${fmt(totalClicks)}</span>
      <span class="stat-label">Klikk</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${(avgCtr * 100).toFixed(2)}%</span>
      <span class="stat-label">Gj.sn. CTR</span>
      <div class="stat-bench ${ctrVsBench > 1 ? 'bench-good' : 'bench-bad'}">
        Bransje: ${(BENCHMARKS.ctr.search * 100).toFixed(1)}% ${ctrVsBench > 1 ? '▲ over' : '▼ under'}
      </div>
    </div>
    <div class="stat-card">
      <span class="stat-value">${totalConv.toFixed(1)}</span>
      <span class="stat-label">Konverteringer</span>
      <div class="stat-bench bench-ok">CPA: kr ${cpa.toFixed(0)} (bransje: kr ${BENCHMARKS.cpa})</div>
    </div>`;
}

// ═══ BUDSJETT ════════════════════════════════════════════════════
export function renderBudget() {
  const el = document.getElementById('budget-content');
  if (!el) return;
  const budget = parseFloat(document.getElementById('budget-input')?.value) || 40000;
  const spend  = state.D.campaigns.reduce((s, c) => s + c.costMicros, 0) / 1e6;
  const ratio  = Math.min(spend / budget * 100, 100);
  const over   = spend > budget;
  const warn   = ratio > 80;
  // Bugfiks: var(--green)/var(--red)/var(--orange) → korrekte CSS-variabler
  const color  = over ? 'var(--bad)' : warn ? 'var(--warn)' : 'var(--good)';

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:11px;margin-bottom:6px">
      <span>Brukt: <strong>kr ${spend.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}</strong></span>
      <span>Budsjett: kr ${budget.toLocaleString('nb-NO')}</span>
    </div>
    <div class="budget-track">
      <div class="budget-fill" style="width:${ratio}%;background:${color}"></div>
    </div>
    <div style="margin-top:6px;font-family:var(--mono);font-size:10px;color:${color}">
      ${over
        ? '⚠ Overskredet med kr ' + (spend - budget).toFixed(0)
        : warn
          ? '⚠ ' + ratio.toFixed(0) + '% brukt — nærmer seg grensen'
          : '✓ ' + ratio.toFixed(0) + '% brukt'}
    </div>`;
}

// ═══ ROAS ════════════════════════════════════════════════════════
export function renderRoas() {
  const el = document.getElementById('roas-content');
  if (!el) return;
  const orderVal   = parseFloat(document.getElementById('roas-input')?.value) || 3500;
  const totalSpend = state.D.campaigns.reduce((s, c) => s + c.costMicros, 0) / 1e6;
  const totalConv  = state.D.campaigns.reduce((s, c) => s + c.conversions, 0);
  const revenue    = totalConv * orderVal;
  const roas       = totalSpend > 0 ? revenue / totalSpend : 0;
  const roasColor  = roas >= 4 ? 'var(--good)' : roas >= 2 ? 'var(--warn)' : 'var(--bad)';

  el.innerHTML = `
    <div class="roas-grid">
      <div class="roas-card">
        <div class="roas-val" style="color:${roasColor}">${roas.toFixed(2)}x</div>
        <div class="roas-sub">ROAS</div>
      </div>
      <div class="roas-card">
        <div class="roas-val">kr ${Math.round(revenue).toLocaleString('nb-NO')}</div>
        <div class="roas-sub">Est. omsetning</div>
      </div>
      <div class="roas-card">
        <div class="roas-val" style="color:${revenue > totalSpend ? 'var(--good)' : 'var(--bad)'}">
          kr ${Math.round(revenue - totalSpend).toLocaleString('nb-NO')}
        </div>
        <div class="roas-sub">Est. fortjeneste</div>
      </div>
    </div>
    <p style="font-family:var(--mono);font-size:10px;color:var(--ink3);margin-top:8px">
      ${totalConv.toFixed(1)} konv. × kr ${orderVal.toLocaleString('nb-NO')} ordreverdi
    </p>`;
}

// ═══ SJEKKLISTE ═══════════════════════════════════════════════════
export function renderChecklist() {
  const el = document.getElementById('checklist-block');
  if (!el || !state.D.campaigns.length) return;
  const { D } = state;
  const budget     = parseFloat(document.getElementById('budget-input')?.value) || 40000;
  const totalSpend = D.campaigns.reduce((s, c) => s + c.costMicros, 0) / 1e6;
  const lowQs      = D.keywords.filter(k => k.qs && k.qs <= 4);
  const highCpa    = D.campaigns.filter(c => c.conversions > 0 && (c.costMicros / 1e6 / c.conversions) > 1500);
  const zeroConv   = D.campaigns.filter(c => c.status === 'ENABLED' && c.costMicros > 2000000000 && c.conversions === 0);
  const topCtr     = D.campaigns.filter(c => c.ctr > 0.05 && c.status === 'ENABLED');

  const items = [];
  if (lowQs.length)    items.push({ t: 'bad',  txt: `${lowQs.length} søkeord med QS ≤ 4: ${lowQs.slice(0, 3).map(k => '"' + k.keyword + '"').join(', ')} — vurder pause eller omstrukturering` });
  if (zeroConv.length) items.push({ t: 'bad',  txt: `${zeroConv.map(c => '"' + c.name + '"').join(', ')} bruker budsjett uten konverteringer` });
  if (highCpa.length)  items.push({ t: 'warn', txt: `${highCpa.map(c => '"' + c.name + '"').join(', ')} har CPA over kr 1 500` });
  if (totalSpend / budget > 0.85) items.push({ t: 'warn', txt: `${((totalSpend / budget) * 100).toFixed(0)}% av månedlig budsjett brukt — vurder justering` });
  if (topCtr.length)   items.push({ t: 'ok',   txt: `${topCtr.map(c => '"' + c.name + '"').join(', ')} leverer over 5% CTR — vurder å skalere opp` });
  if (!items.length)   items.push({ t: 'ok',   txt: 'Ingen kritiske varsler — alt ser bra ut' });

  // Bugfiks: bruker korrekte CSS-variabler
  const dotCol = { bad: 'var(--bad)', warn: 'var(--warn)', ok: 'var(--good)' };
  const txtCol = { bad: 'zone-red',   warn: 'zone-orange', ok: 'zone-green' };

  el.innerHTML = '<div class="block-title" style="margin-bottom:12px">Daglig sjekkliste</div>' +
    items.map(i =>
      `<div class="check-item">
        <div class="check-dot" style="background:${dotCol[i.t]}"></div>
        <div class="check-text ${txtCol[i.t]}">${i.txt}</div>
       </div>`
    ).join('');
}

// ═══ HELSESKÅR ════════════════════════════════════════════════════
export function renderHealthScores() {
  const el = document.getElementById('health-grid');
  if (!el || !state.D.campaigns.length) return;
  const active = state.D.campaigns.filter(c => c.status === 'ENABLED');

  el.innerHTML = active.slice(0, 6).map(c => {
    let score = 5;
    if (c.ctr > 0.04) score += 2; else if (c.ctr < 0.015) score -= 2;
    if (c.conversionRate > 0.02) score += 2; else if (c.conversionRate < 0.008 && c.conversions > 0) score -= 1;
    const cpa = c.costMicros / 1e6 / (c.conversions || 1);
    if (c.conversions > 0 && cpa < 800) score += 1; else if (c.conversions > 0 && cpa > 1500) score -= 1;
    score = Math.max(1, Math.min(10, score));
    const cls  = score >= 7 ? 'score-green' : score >= 5 ? 'score-orange' : 'score-red';
    const name = c.name.length > 22 ? c.name.slice(0, 21) + '…' : c.name;
    return `<div class="health-card">
      <div class="health-name">${name}</div>
      <div class="health-score ${cls}">${score}</div>
      <div class="health-label">av 10</div>
    </div>`;
  }).join('');

  const critical = active.filter(c => {
    let s = 5;
    if (c.ctr < 0.015) s -= 2;
    if (c.conversionRate < 0.008 && c.conversions > 0) s -= 1;
    return Math.max(1, Math.min(10, s)) < 4;
  });
  if (critical.length) sendBrowserNotification('Novooi Ads', `${critical.length} kampanjer har lav helse-score`);
}

// ═══ TRAKT ════════════════════════════════════════════════════════
export function renderFunnel() {
  const el = document.getElementById('funnel-content');
  if (!el || !state.D.campaigns.length) return;
  const top = [...state.D.campaigns]
    .filter(c => c.status === 'ENABLED')
    .sort((a, b) => b.costMicros - a.costMicros)
    .slice(0, 3);

  el.innerHTML = top.map(c => {
    const stages = [
      { label: 'Visninger', val: fmt(c.impressions),      pct: 100 },
      { label: 'Klikk',     val: fmt(c.clicks),           pct: c.impressions ? Math.min(100, c.clicks / c.impressions * 100 * 20) : 0 },
      { label: 'Konv.',     val: c.conversions.toFixed(1), pct: c.clicks ? Math.min(100, c.conversions / c.clicks * 100 * 100) : 0 },
    ];
    return `<div style="margin-bottom:20px">
      <div class="funnel-campaign">${c.name}</div>
      ${stages.map(s => `<div class="funnel-row">
        <div class="funnel-label">${s.label}</div>
        <div class="funnel-bar-wrap"><div class="funnel-bar" style="width:${s.pct}%"></div></div>
        <div class="funnel-val">${s.val}</div>
      </div>`).join('')}
    </div>`;
  }).join('');
}

// ═══ TOPP-KAMPANJER ══════════════════════════════════════════════
export function renderTopCampaigns() {
  const cols = [
    { key: 'name',        label: 'Kampanje',        render: r => `<span style="font-weight:500">${r.name}</span>` },
    { key: 'status',      label: 'Status',          render: r => statusBadge(r.status) },
    { key: 'clicks',      label: 'Klikk',           render: r => `<span class="mono">${fmt(r.clicks)}</span>` },
    { key: 'ctr',         label: 'CTR',             render: r => `<span class="mono ${ctrClass(r.ctr, r.type)}">${pct(r.ctr)}</span>` },
    { key: 'costMicros',  label: 'Forbruk',         render: r => `<span class="mono">${kr(r.costMicros)}</span>` },
    { key: 'conversions', label: 'Konv.',           render: r => `<span class="mono">${r.conversions.toFixed(1)}</span>` },
    { key: 'spark',       label: '14-dagers trend', render: r => sparkSVG(r.name) },
  ];
  document.getElementById('top-campaigns-table').innerHTML = buildTable(state.D.campaigns, cols);
}

// ═══ KAMPANJETABELL (sorterbar) ═══════════════════════════════════
export function renderCampaignsTable() {
  const cols = [
    { key: 'name',           label: 'Kampanje',   render: r => `<span style="font-weight:500">${r.name}</span>` },
    { key: 'status',         label: 'Status',     render: r => statusBadge(r.status) },
    { key: 'type',           label: 'Type',       render: r => `<span class="mono">${(r.type || '').replace('_', ' ')}</span>` },
    { key: 'impressions',    label: 'Visninger',  render: r => `<span class="mono">${fmt(r.impressions)}</span>` },
    { key: 'clicks',         label: 'Klikk',      render: r => `<span class="mono">${fmt(r.clicks)}</span>` },
    { key: 'ctr',            label: 'CTR',        render: r => `<span class="mono ${ctrClass(r.ctr, r.type)}">${pct(r.ctr)}</span>` },
    { key: 'costMicros',     label: 'Forbruk',    render: r => `<span class="mono">${kr(r.costMicros)}</span>` },
    { key: 'conversions',    label: 'Konv.',      render: r => `<span class="mono">${r.conversions.toFixed(1)}</span>` },
    { key: 'conversionRate', label: 'Conv. rate', render: r => `<span class="mono ${convClass(r.conversionRate)}">${pct(r.conversionRate)}</span>` },
    { key: 'avgCpc',         label: 'Gj.sn. CPC', render: r => `<span class="mono">${kr(r.avgCpc)}</span>` },
    { key: 'spark',          label: 'Trend',      render: r => sparkSVG(r.name) },
  ];
  buildSortableTable('campaigns-tbl', 'campaigns', state.D.campaigns, cols);
}

// ═══ SØKEORD-VISNING (gruppert + flat) ═══════════════════════════
export function renderKeywordsView() {
  const search = (document.getElementById('kw-search')?.value     || '').toLowerCase();
  const matchF  = document.getElementById('kw-match-filter')?.value || '';
  const sortF   = document.getElementById('kw-sort-field')?.value   || 'costMicros';
  const qsF     = document.getElementById('kw-qs-filter')?.value    || '';
  const el      = document.getElementById('keywords-view');
  if (!el || !state.D.keywords.length) return;

  const kws = state.D.keywords.filter(k => {
    if (search && !k.keyword?.toLowerCase().includes(search) && !k.campaign?.toLowerCase().includes(search)) return false;
    if (matchF && k.matchType !== matchF) return false;
    if (qsF === 'low'  && (k.qs < 1 || k.qs > 4)) return false;
    if (qsF === 'mid'  && (k.qs < 5 || k.qs > 7)) return false;
    if (qsF === 'high' && k.qs < 8) return false;
    return true;
  }).sort((a, b) => b[sortF] - a[sortF]);

  const countEl = document.getElementById('kw-count');
  if (countEl) countEl.textContent = kws.length + ' søkeord';

  if (state.kwViewMode === 'flat') {
    el.innerHTML = `<div class="table-wrap">${buildKwTable(kws)}</div>`;
    return;
  }

  // Gruppert visning
  const groups = {};
  kws.forEach(k => { const c = k.campaign || 'Ukjent'; (groups[c] || (groups[c] = [])).push(k); });

  el.innerHTML = Object.entries(groups).map(([camp, ks]) => {
    const totalClicks = ks.reduce((s, k) => s + k.clicks, 0);
    const totalSpend  = ks.reduce((s, k) => s + k.costMicros, 0) / 1e6;
    const validQs     = ks.filter(k => k.qs > 0);
    const avgQs       = validQs.length ? validQs.reduce((s, k) => s + k.qs, 0) / validQs.length : 0;
    return `<div class="kw-group">
      <div class="kw-group-header" data-kw-toggle>
        <span class="kw-group-name">${camp}</span>
        <span class="kw-group-meta">${ks.length} søkeord · ${fmt(totalClicks)} klikk · ${kr(totalSpend * 1e6)} · Snitt QS ${avgQs.toFixed(1)}</span>
      </div>
      <div class="kw-group-table open">${buildKwTable(ks)}</div>
    </div>`;
  }).join('');
}

export function buildKwTable(kws) {
  const matchLabels = { EXACT: 'Eksakt', PHRASE: 'Frase', BROAD: 'Bred' };
  const rows = kws.map(k => {
    // Bugfiks: korrekte CSS-variabler for QS-farge
    const qsColor = k.qs >= 8 ? 'var(--good)' : k.qs >= 5 ? 'var(--warn)' : k.qs > 0 ? 'var(--bad)' : 'var(--ink3)';
    return `<tr>
      <td><span style="font-weight:500">${k.keyword || '—'}</span></td>
      <td><span class="badge b-gray">${matchLabels[k.matchType] || k.matchType || '—'}</span></td>
      <td class="mono" style="font-size:11px;color:var(--ink3)">${k.campaign || '—'}</td>
      <td class="mono">${fmt(k.impressions)}</td>
      <td class="mono">${fmt(k.clicks)}</td>
      <td class="mono ${ctrClass(k.ctr, 'SEARCH')}">${pct(k.ctr)}</td>
      <td class="mono">${kr(k.costMicros)}</td>
      <td class="mono">${k.conversions.toFixed(1)}</td>
      <td><span style="font-family:var(--mono);font-size:11px;color:${qsColor};font-weight:700">${k.qs || '—'}</span></td>
    </tr>`;
  }).join('');

  return `<table style="min-width:700px;width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:var(--ink);color:var(--bg)">
      ${['Søkeord', 'Match', 'Kampanje', 'Visn.', 'Klikk', 'CTR', 'Forbruk', 'Konv.', 'QS']
        .map(h => `<th style="padding:8px 12px;text-align:left;font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;font-weight:400">${h}</th>`)
        .join('')}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ═══ SØKETERMER-VISNING ════════════════════════════════════════════
export function renderSearchTermsView() {
  const search  = (document.getElementById('st-search')?.value          || '').toLowerCase();
  const statusF  = document.getElementById('st-status-filter')?.value   || '';
  const sortF    = document.getElementById('st-sort-field')?.value       || 'costMicros';
  const campF    = document.getElementById('st-campaign-filter')?.value  || '';
  const el       = document.getElementById('st-view');
  if (!el || !state.D.searchterms?.length) return;

  const terms = state.D.searchterms.filter(t => {
    if (search  && !t.term?.toLowerCase().includes(search) && !t.campaign?.toLowerCase().includes(search)) return false;
    if (statusF && t.status !== statusF) return false;
    if (campF   && t.campaign !== campF) return false;
    return true;
  }).sort((a, b) => b[sortF] - a[sortF]);

  const countEl = document.getElementById('st-count');
  if (countEl) countEl.textContent = terms.length + ' søketermer';

  const statusLabels   = { ADDED: 'Lagt til', EXCLUDED: 'Ekskludert', NONE: 'Ingen' };
  const statusBadgeMap = { ADDED: 'b-green', EXCLUDED: 'b-red', NONE: 'b-gray' };

  const rows = terms.map(t => `<tr>
    <td><span style="font-weight:500">${t.term}</span></td>
    <td><span class="badge ${statusBadgeMap[t.status] || 'b-gray'}">${statusLabels[t.status] || t.status}</span></td>
    <td class="mono" style="font-size:10px;color:var(--ink3)">${t.campaign}</td>
    <td class="mono">${fmt(t.impressions)}</td>
    <td class="mono">${fmt(t.clicks)}</td>
    <td class="mono ${ctrClass(t.ctr, 'SEARCH')}">${pct(t.ctr)}</td>
    <td class="mono">${kr(t.costMicros)}</td>
    <td class="mono">${t.conversions.toFixed(1)}</td>
  </tr>`).join('');

  el.innerHTML = `<div class="table-wrap">
    <table style="min-width:700px;width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:var(--ink);color:var(--bg)">
        ${['Søketerm', 'Status', 'Kampanje', 'Visn.', 'Klikk', 'CTR', 'Forbruk', 'Konv.']
          .map(h => `<th style="padding:8px 12px;text-align:left;font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;font-weight:400">${h}</th>`)
          .join('')}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ═══ ANNONSEGRUPPER (sorterbar) ═══════════════════════════════════
export function renderAdGroupsTable() {
  const cols = [
    { key: 'name',        label: 'Annonsegruppe', render: r => `<span style="font-weight:500">${r.name}</span>` },
    { key: 'campaign',    label: 'Kampanje',      render: r => `<span class="mono" style="font-size:11px;color:var(--ink3)">${r.campaign}</span>` },
    { key: 'status',      label: 'Status',        render: r => statusBadge(r.status) },
    { key: 'impressions', label: 'Visninger',     render: r => `<span class="mono">${fmt(r.impressions)}</span>` },
    { key: 'clicks',      label: 'Klikk',         render: r => `<span class="mono">${fmt(r.clicks)}</span>` },
    { key: 'ctr',         label: 'CTR',           render: r => `<span class="mono ${ctrClass(r.ctr, 'SEARCH')}">${pct(r.ctr)}</span>` },
    { key: 'costMicros',  label: 'Forbruk',       render: r => `<span class="mono">${kr(r.costMicros)}</span>` },
    { key: 'conversions', label: 'Konv.',         render: r => `<span class="mono">${r.conversions.toFixed(1)}</span>` },
  ];
  buildSortableTable('adgroups-tbl', 'adgroups', state.D.adGroups, cols);
}

// ═══ ANNONSER (sorterbar) ═════════════════════════════════════════
export function renderAdsTable() {
  const cols = [
    { key: 'headline',    label: 'Annonse',   render: r => `<span style="font-weight:500;font-size:13px">${r.headline}</span>` },
    { key: 'campaign',    label: 'Kampanje',  render: r => `<span class="mono" style="font-size:11px;color:var(--ink3)">${r.campaign}</span>` },
    { key: 'status',      label: 'Status',    render: r => statusBadge(r.status) },
    { key: 'impressions', label: 'Visninger', render: r => `<span class="mono">${fmt(r.impressions)}</span>` },
    { key: 'clicks',      label: 'Klikk',     render: r => `<span class="mono">${fmt(r.clicks)}</span>` },
    { key: 'ctr',         label: 'CTR',       render: r => `<span class="mono ${ctrClass(r.ctr, 'SEARCH')}">${pct(r.ctr)}</span>` },
    { key: 'conversions', label: 'Konv.',     render: r => `<span class="mono">${r.conversions.toFixed(1)}</span>` },
  ];
  buildSortableTable('ads-tbl', 'ads', state.D.ads, cols);
}

// ═══ QS-GUIDE ════════════════════════════════════════════════════
export function renderQsGuide() {
  const el = document.getElementById('qs-guide-content');
  if (!el) return;
  const lowQs = state.D.keywords.filter(k => k.qs && k.qs <= 6).sort((a, b) => a.qs - b.qs);
  if (!lowQs.length) {
    el.innerHTML = '<p style="font-size:15px;color:var(--good)">✓ Alle søkeord har QS over 6.</p>';
    return;
  }
  const tips = {
    3: 'Svært lav QS: Lag dedikerte annonsegrupper for dette søkeordet, og sørg for at landingssiden inneholder termen. Vurder å pause søkeordet inntil forbedringer er gjort.',
    4: 'Lav QS: Sjekk at annonseteksten inneholder søkeordet. Forbedre relevansen mellom annonse og landingsside.',
    5: 'Under middels: Legg søkeordet inn i annonseoverskriften. Test ny landingsside med sterkere match.',
    6: 'Middels: Legg til mer relevante annonsetekster og test ulike varianter for å øke CTR.',
  };
  el.innerHTML = lowQs.map(k => `
    <div style="border:1px solid var(--border);padding:14px 16px;margin-bottom:10px;background:var(--bg2)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <span style="font-weight:600;font-size:15px">${k.keyword}</span>
        <span class="badge b-${k.qs <= 4 ? 'red' : 'orange'}">QS ${k.qs}</span>
        <span style="font-family:var(--mono);font-size:10px;color:var(--ink3)">${k.campaign}</span>
      </div>
      <p style="font-size:14px;line-height:1.6;color:var(--ink)">${tips[k.qs] || tips[6]}</p>
    </div>`).join('');
}

// ═══ NEGATIVE SØKEORD — LISTE ══════════════════════════════════════
export function renderNegAdded() {
  const el = document.getElementById('neg-added-list');
  if (!el) return;
  if (!state.negKwList.length) { el.innerHTML = ''; return; }
  el.innerHTML =
    `<div style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-bottom:8px">Lagt til denne sesjonen</div>` +
    state.negKwList.map((n, i) => `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="font-weight:500">${n.kw}</span>
        ${matchBadge(n.match)}
        <span style="font-family:var(--mono);font-size:10px;color:var(--ink3)">${n.added}</span>
        <button class="btn btn-ghost btn-sm" onclick="removeNegKw(${i})">Fjern</button>
      </div>`).join('');
}

// ═══ HISTORIKK — GRAFER ═══════════════════════════════════════════
export function renderHistoryCharts(snaps) {
  const el = document.getElementById('hist-charts');
  if (!el) return;
  const weeks = snaps.map(s => s.week.replace(/\d{4}-/, ''));
  // Bugfiks: korrekte CSS-variabler (var(--green)→var(--good), var(--brown)→var(--warn))
  const charts = [
    { title: 'Forbruk per uke (kr)', vals: snaps.map(s => s.totalSpend),                     color: 'var(--accent)' },
    { title: 'CTR per uke (%)',       vals: snaps.map(s => +(s.avgCtr * 100).toFixed(2)),      color: 'var(--good)' },
    { title: 'Konverteringer per uke',vals: snaps.map(s => +s.totalConv.toFixed(1)),            color: 'var(--warn)' },
    { title: 'CPA per uke (kr)',       vals: snaps.map(s => +s.cpa.toFixed(0)),                 color: 'var(--bad)' },
  ];

  el.innerHTML = charts.map(ch => {
    const max = Math.max(...ch.vals, 1), min = Math.min(...ch.vals, 0);
    const W = 600, H = 120, padL = 50, padB = 28, padT = 10, padR = 10;
    const xStep  = (W - padL - padR) / (Math.max(weeks.length - 1, 1));
    const yScale = (H - padT - padB) / (max - min || 1);
    const pts    = ch.vals.map((v, i) => ({ x: padL + i * xStep, y: H - padB - (v - min) * yScale, v }));
    const path   = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area   = `${path} L${pts[pts.length - 1].x.toFixed(1)},${(H - padB).toFixed(1)} L${padL},${(H - padB).toFixed(1)} Z`;
    const labels = weeks.map((w, i) => {
      if (weeks.length > 8 && i % 2 !== 0) return '';
      return `<text x="${(padL + i * xStep).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="hist-label">${w}</text>`;
    }).join('');
    const dots = pts.map(p =>
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${ch.color}" stroke="var(--bg)" stroke-width="1.5"><title>${p.v}</title></circle>`
    ).join('');
    return `<div class="hist-chart-wrap">
      <div class="hist-chart-title">${ch.title}</div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
        <style>.hist-label{font-family:var(--mono);font-size:9px;fill:var(--ink3)}</style>
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="var(--border)" stroke-width="0.5"/>
        <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="var(--border)" stroke-width="0.5"/>
        <path d="${area}" fill="${ch.color}" opacity="0.08"/>
        <path d="${path}" fill="none" stroke="${ch.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="${padL - 4}" y="${padT + 8}" text-anchor="end" class="hist-label">${max.toFixed(0)}</text>
        <text x="${padL - 4}" y="${H - padB}" text-anchor="end" class="hist-label">${min.toFixed(0)}</text>
        ${labels}${dots}
      </svg>
    </div>`;
  }).join('');
}

export function renderHistoryTable(snaps) {
  const block = document.getElementById('hist-table-block');
  if (!block) return;
  block.style.display = 'block';
  document.getElementById('hist-tbl').innerHTML =
    `<thead><tr>${['Uke', 'Dato', 'Forbruk', 'Klikk', 'Konv.', 'CTR', 'CPA'].map(h => `<th>${h}</th>`).join('')}</tr></thead>` +
    '<tbody>' +
    [...snaps].reverse().map(s => `<tr>
      <td class="mono">${s.week}</td>
      <td class="mono" style="font-size:11px">${s.date}</td>
      <td class="mono">${kr(s.totalSpend * 1e6)}</td>
      <td class="mono">${fmt(s.totalClicks)}</td>
      <td class="mono">${s.totalConv.toFixed(1)}</td>
      <td class="mono">${pct(s.avgCtr)}</td>
      <td class="mono">${s.cpa > 0 ? kr(s.cpa * 1e6) : '—'}</td>
    </tr>`).join('') +
    '</tbody>';
}

// ═══ STRUKTURKART ═════════════════════════════════════════════════
export function renderStructure(d, filter) {
  const el = document.getElementById('struct-content');
  if (!el) return;
  const f = filter.toLowerCase();
  // Bugfiks: korrekte CSS-variabler
  const statusColors = { ENABLED: 'var(--good)', PAUSED: 'var(--warn)', REMOVED: 'var(--bad)' };
  const matchLabels  = { EXACT: 'Eksakt', PHRASE: 'Frase', BROAD: 'Bred' };

  el.innerHTML = d.campaigns.map(camp => {
    const ags      = d.adGroups.filter(ag => ag.campaignId === camp.id);
    const campMatch = !f || camp.name.toLowerCase().includes(f);
    const anyMatch  = campMatch || ags.some(ag =>
      ag.name.toLowerCase().includes(f) ||
      d.keywords.filter(k => k.adGroupId === ag.id).some(k => k.text?.toLowerCase().includes(f))
    );
    if (!anyMatch) return '';

    const dot = (c, w = 7) =>
      `<span style="display:inline-block;width:${w}px;height:${w}px;border-radius:50%;background:${statusColors[c] || 'var(--ink3)'};margin-right:6px"></span>`;

    const agHtml = ags.map(ag => {
      const kws     = d.keywords.filter(k => k.adGroupId === ag.id);
      const agMatch  = !f || ag.name.toLowerCase().includes(f) || campMatch;
      const kwMatch  = kws.some(k => k.text?.toLowerCase().includes(f));
      if (!agMatch && !kwMatch) return '';

      const kwHtml = kws.map(k => {
        if (f && !k.text?.toLowerCase().includes(f) && !agMatch && !campMatch) return '';
        const qsColor = k.qs >= 8 ? 'var(--good)' : k.qs >= 6 ? 'var(--warn)' : k.qs > 0 ? 'var(--bad)' : 'var(--ink3)';
        return `<div class="kw-row">
          <div class="kw-text">${k.text || '—'}</div>
          <span class="kw-badge">${matchLabels[k.matchType] || k.matchType || '—'}</span>
          ${k.qs > 0 ? `<span class="mono" style="color:${qsColor};font-size:10px">QS ${k.qs}</span>` : ''}
          <span class="mono" style="color:var(--ink3);font-size:10px">${fmt(k.clicks)} klikk</span>
        </div>`;
      }).join('');

      return `<div class="ag-node">
        <div class="ag-header" data-struct-toggle="ag">
          <div class="ag-name">${dot(ag.status, 6)}${ag.name}</div>
          <div class="ag-meta">${fmt(ag.clicks)} klikk · kr ${Math.round(ag.spend || 0).toLocaleString('nb-NO')} · ${kws.length} søkeord</div>
        </div>
        <div class="kw-list${(f && kwMatch) || !f ? ' open' : ''}">${kwHtml || '<div style="font-size:12px;color:var(--ink3);padding:8px 0">Ingen søkeord</div>'}</div>
      </div>`;
    }).join('');

    return `<div class="camp-node">
      <div class="camp-header" data-struct-toggle="camp">
        <div style="display:flex;align-items:center">${dot(camp.status)}
          <span class="camp-name">${camp.name}</span>
        </div>
        <div style="display:flex;align-items:center;gap:16px">
          <span class="camp-meta">kr ${Math.round(camp.spend || 0).toLocaleString('nb-NO')} · ${(camp.conversions || 0).toFixed(1)} konv. · ${ags.length} grupper</span>
          <span class="camp-toggle">▾</span>
        </div>
      </div>
      <div class="ag-list open">${agHtml || '<div style="padding:10px;font-size:13px;color:var(--ink3)">Ingen annonsegrupper</div>'}</div>
    </div>`;
  }).join('');
}

// ═══ KAMPANJESTRUKTUR-FORSLAG ══════════════════════════════════════
export function renderCampaignStructure(data) {
  const typeConfig = {
    SEARCH:  { label: 'Søk',             cls: 'cs-camp-type-search'  },
    PMAX:    { label: 'Performance Max', cls: 'cs-camp-type-pmax'    },
    DISPLAY: { label: 'Display',         cls: 'cs-camp-type-display' },
  };
  const matchCls   = { EXACT: 'exact', PHRASE: 'phrase', BROAD: 'broad' };
  const matchLabel = { EXACT: '[eksakt]', PHRASE: '"frase"', BROAD: 'bred' };

  const totalCamps = (data.campaigns || []).length;
  const totalAgs   = (data.campaigns || []).reduce((s, c) => s + (c.adGroups || []).length, 0);
  const totalKws   = (data.campaigns || []).reduce((s, c) =>
    s + (c.adGroups || []).reduce((s2, ag) => s2 + (ag.keywords || []).length, 0), 0);

  const summaryHtml = `<div class="cs-summary">
    <div class="cs-summary-item"><div class="cs-summary-val">${totalCamps}</div><div class="cs-summary-label">Kampanjer</div></div>
    <div class="cs-summary-item"><div class="cs-summary-val">${totalAgs}</div><div class="cs-summary-label">Annonsegrupper</div></div>
    <div class="cs-summary-item"><div class="cs-summary-val">${totalKws}</div><div class="cs-summary-label">Søkeord</div></div>
  </div>`;

  const budgetNoteHtml = data.totalBudgetNote
    ? `<div class="cs-budget-note">💡 ${data.totalBudgetNote}</div>` : '';

  const campaignsHtml = (data.campaigns || []).map(camp => {
    const cfg   = typeConfig[camp.type] || { label: camp.type, cls: 'cs-camp-type-search' };
    const agHtml = (camp.adGroups || []).map(ag => {
      const kwHtml   = (ag.keywords || []).map(k =>
        `<span class="cs-kw ${matchCls[k.match] || ''}" title="${matchLabel[k.match] || k.match}">${k.text}</span>`
      ).join('');
      const prodHtml = (ag.products || []).map(p => `<span class="cs-product">${p}</span>`).join('');
      const adHtml   = (ag.adHeadlines || []).length
        ? `<div class="cs-ad-preview">
            <div class="cs-ad-url">novooi.com</div>
            <div class="cs-ad-headline">${(ag.adHeadlines || []).slice(0, 3).join(' · ')}</div>
            <div class="cs-ad-desc">${(ag.adDescriptions || []).join(' ')}</div>
           </div>` : '';
      return `<div class="cs-ag">
        <div class="cs-ag-name">${ag.name}</div>
        <div class="cs-ag-desc">${ag.description || ''}</div>
        ${kwHtml   ? `<div class="cs-kw-label">Søkeord</div><div class="cs-kw-list">${kwHtml}</div>` : ''}
        ${prodHtml ? `<div class="cs-kw-label">Produkter</div><div class="cs-products">${prodHtml}</div>` : ''}
        ${adHtml}
      </div>`;
    }).join('');
    return `<div class="cs-campaign">
      <div class="cs-camp-header">
        <div class="cs-camp-left">
          <span class="cs-camp-type ${cfg.cls}">${cfg.label}</span>
          <div class="cs-camp-name">${camp.name}</div>
          <div class="cs-camp-desc">${camp.description || ''}</div>
          ${camp.budgetRationale ? `<div style="font-family:var(--mono);font-size:10px;color:var(--ink3);margin-top:8px">💰 ${camp.budgetRationale}</div>` : ''}
        </div>
        <div class="cs-camp-budget">
          <div class="cs-camp-budget-val">${camp.budget || '—'}</div>
          <div class="cs-camp-budget-label">Budsjett</div>
        </div>
      </div>
      <div class="cs-camp-body"><div class="cs-adgroups">${agHtml}</div></div>
    </div>`;
  }).join('');

  return `<div class="cs-wrap">${summaryHtml}${budgetNoteHtml}${campaignsHtml}</div>`;
}

// ═══ ANALYSE-ACCORDION ════════════════════════════════════════════
export function renderAnalysisAccordion(suggestions) {
  if (!suggestions?.length) return '<div style="color:var(--ink3);font-family:var(--mono);font-size:12px;padding:16px">Ingen forslag generert.</div>';
  const typeConfig = {
    critical:  { color: 'var(--bad)',  label: 'Kritisk',    cls: 'b-red'    },
    improve:   { color: 'var(--warn)', label: 'Forbedring', cls: 'b-orange' },
    strategic: { color: 'var(--good)', label: 'Mulighet',   cls: 'b-green'  },
    positive:  { color: '#5b99c2',     label: 'Går bra',    cls: 'b-gray'   },
  };
  return suggestions.map((s, i) => {
    const cfg     = typeConfig[s.type] || typeConfig.improve;
    const tagsHtml = (s.tags || []).length
      ? `<div class="ai-acc-tags">${s.tags.map(t =>
          `<span class="ai-acc-tag" onclick="copyTag('${t.replace(/'/g, "\\'")}',this)">${t}</span>`
        ).join('')}</div>` : '';
    return `<div class="ai-accordion">
      <div class="ai-acc-header" data-accordion>
        <div class="ai-acc-type" style="background:${cfg.color}"></div>
        <div class="ai-acc-title">${s.title}</div>
        <span class="badge ${cfg.cls}" style="margin-right:10px">${cfg.label}</span>
        <div class="ai-acc-arrow">▾</div>
      </div>
      <div class="ai-acc-body ${i === 0 ? 'open' : ''}">
        <div class="ai-acc-desc">${s.description}</div>
        ${s.action  ? `<div class="ai-acc-action"><div class="ai-acc-action-label">Hva gjør du</div><div class="ai-acc-action-text">${s.action}</div></div>` : ''}
        ${s.example ? `<div class="ai-acc-action" style="border-color:${cfg.color}"><div class="ai-acc-action-label" style="color:${cfg.color}">Konkret eksempel</div><div class="ai-acc-action-text">${s.example}</div></div>` : ''}
        ${tagsHtml}
      </div>
    </div>`;
  }).join('');
}

export function renderAnalysisMarkdown(text) {
  return text.split(/\n## /).map(sec => {
    if (!sec.trim()) return '';
    const lines = sec.split('\n');
    const title = lines[0].replace(/^#+\s*/, '').trim();
    const body  = lines.slice(1).join('\n').trim();
    const cls   = /strategisk|alternativ/i.test(title) ? 'strategic' : 'improve';
    const items = body.split(/\n(?=\*\*|[-–])/).filter(s => s.trim());
    const itemsHtml = items.map(item => {
      const hasBold = item.match(/^\*\*(.*?)\*\*/);
      if (hasBold) {
        const titleText = hasBold[1];
        const rest = item.replace(/^\*\*(.*?)\*\*\s*[—-]?\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return `<div class="analysis-item ${cls}"><div class="analysis-item-title">${titleText}</div><div class="analysis-item-body">${rest}</div></div>`;
      }
      return `<div class="analysis-item ${cls}"><div class="analysis-item-body">${item.replace(/^[-–]\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div></div>`;
    }).join('');
    return `<div class="analysis-section"><span class="analysis-label ${cls}">${title}</span>${itemsHtml}</div>`;
  }).join('');
}

// ═══ MINNEDIFF ════════════════════════════════════════════════════
export function buildMemoryDiff(currentCamps, prevSnap) {
  if (!prevSnap?.campaigns?.length) return null;
  const prevMap = Object.fromEntries(prevSnap.campaigns.map(c => [c.name, c]));
  const currMap = Object.fromEntries(currentCamps.map(c => [c.name, c]));
  const changes = [];

  currentCamps.forEach(c => {
    const p = prevMap[c.name];
    if (!p) {
      changes.push({ type: 'new', name: c.name, detail: 'Ny kampanje siden ' + prevSnap.week });
    } else {
      const ctrDelta   = ((c.ctr - p.ctr) / Math.max(p.ctr, 0.001) * 100).toFixed(0);
      const spendDelta = ((c.costMicros - p.costMicros) / Math.max(p.costMicros, 1) * 100).toFixed(0);
      if (Math.abs(ctrDelta) > 10 || Math.abs(spendDelta) > 15) {
        changes.push({ type: 'changed', name: c.name,
          detail: `CTR ${ctrDelta > 0 ? '+' : ''}${ctrDelta}% · Forbruk ${spendDelta > 0 ? '+' : ''}${spendDelta}%` });
      }
    }
  });
  prevSnap.campaigns.filter(p => !currMap[p.name]).forEach(p => {
    changes.push({ type: 'removed', name: p.name, detail: 'Ikke lenger aktiv' });
  });
  return changes.length ? changes : null;
}

export function renderMemoryDiff(changes, prevWeek) {
  if (!changes?.length) return '';
  const icons = { new: '✦', changed: '↕', removed: '✕' };
  const cls   = { new: 'diff-new', changed: 'diff-changed', removed: 'diff-removed' };
  return `<div style="margin-bottom:20px">
    <div style="font-family:var(--mono);font-size:8px;letter-spacing:.15em;text-transform:uppercase;color:var(--accent);margin-bottom:10px">Endringer siden ${prevWeek}</div>
    ${changes.map(c => `<div class="diff-item">
      <div class="diff-header">
        <span class="${cls[c.type]}">${icons[c.type]} ${c.type === 'new' ? 'Ny' : c.type === 'removed' ? 'Fjernet' : 'Endret'}</span>
        <span>${c.name}</span>
      </div>
      <div class="diff-body">${c.detail}</div>
    </div>`).join('')}
  </div>`;
}

// ═══ VARSLINGER (intern) ═══════════════════════════════════════════
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendBrowserNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}
