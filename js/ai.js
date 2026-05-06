import { state, TAB_PROMPTS } from './data.js';
import {
  wPost, getWorker, showToast, setStatus, setBtnLoading, resetBtn,
  handleError, logAction, loadScript,
} from './helpers.js';
import {
  renderAnalysisAccordion, renderAnalysisMarkdown,
  renderCampaignStructure, renderNegAdded,
  buildMemoryDiff, renderMemoryDiff,
} from './render.js';

// ═══ INTERN HJELPEFUNKSJON ════════════════════════════════════════
/**
 * Robust JSON-parser med bracket-counting.
 * Håndterer at Claude noen ganger pakker JSON i ```json ... ```.
 */
function parseAIJson(raw) {
  // Fjern markdown-kodeblokk hvis present
  let txt = raw.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

  // Finn første { eller [
  const start = Math.min(
    txt.indexOf('{') === -1 ? Infinity : txt.indexOf('{'),
    txt.indexOf('[') === -1 ? Infinity : txt.indexOf('['),
  );
  if (start === Infinity) throw new Error('Ingen JSON funnet i AI-svar');

  const opener  = txt[start];
  const closer  = opener === '{' ? '}' : ']';
  let depth = 0, end = -1;

  for (let i = start; i < txt.length; i++) {
    if (txt[i] === opener)  depth++;
    else if (txt[i] === closer) { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error('Ufullstendig JSON i AI-svar');
  return JSON.parse(txt.slice(start, end + 1));
}

/** Felles Claude API-kall (via Worker-proxy) */
async function callClaude(system, userMsg, maxTokens = 2000) {
  return await wPost('/ai', { system, userMsg, maxTokens });
}

// ═══ FANE-ANALYSE ═════════════════════════════════════════════════
export async function runTabAnalysis(type) {
  const cfg    = TAB_PROMPTS[type];
  const btn    = document.getElementById(`analyse-${type}-btn`);
  const status = document.getElementById(`analyse-${type}-status`);
  const out    = document.getElementById(`analyse-${type}-out`);
  if (!cfg || !out) return;

  setBtnLoading(btn, 'Analyserer...');
  setStatus(status, 'loading', 'Spør Claude...');
  out.innerHTML = '';

  try {
    const res = await callClaude(cfg.system, cfg.userMsg(state.D), 2500);
    const raw = res.content?.[0]?.text || res.text || '';

    // Prøv strukturert JSON-format først, fallback til markdown
    let html;
    try {
      const parsed = parseAIJson(raw);
      const suggestions = Array.isArray(parsed) ? parsed : parsed.suggestions || parsed.items || [];
      html = renderAnalysisAccordion(suggestions);
    } catch {
      html = renderAnalysisMarkdown(raw);
    }
    out.innerHTML = html;
    setStatus(status, 'ok', '✓ Analyse ferdig');
    logAction(`Kjørte ${type}-analyse`);
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn);
  }
}

// ═══ KAMPANJESTRUKTUR-GENERATOR ════════════════════════════════════
export async function generateCampaignStructure() {
  const btn    = document.getElementById('gen-structure-btn');
  const status = document.getElementById('gen-structure-status');
  const out    = document.getElementById('gen-structure-out');
  if (!out) return;

  setBtnLoading(btn, 'Genererer...');
  setStatus(status, 'loading', 'Spør Claude...');
  out.innerHTML = '';

  const budget = document.getElementById('struct-budget-input')?.value || '40000';
  const focus  = document.getElementById('struct-focus-input')?.value  || '';

  const system = `Du er en senior Google Ads-strateg for Novooi, en norsk premium nettbutikk for møbler og interiør (novooi.com). 
Du skal foreslå en optimal kampanjestruktur basert på eksisterende data og gitt budsjett.

SVAR KUN MED GYLDIG JSON i dette formatet (ingen tekst utenfor JSON):
{
  "campaigns": [
    {
      "name": "Kampanjenavn",
      "type": "SEARCH|PMAX|DISPLAY",
      "budget": "kr X/dag",
      "budgetRationale": "Forklaring",
      "description": "Strategi og mål",
      "adGroups": [
        {
          "name": "Annonsegruppenavn",
          "description": "Fokus",
          "keywords": [{"text": "søkeord", "match": "EXACT|PHRASE|BROAD"}],
          "adHeadlines": ["Overskrift 1", "Overskrift 2", "Overskrift 3"],
          "adDescriptions": ["Beskrivelse 1", "Beskrivelse 2"]
        }
      ]
    }
  ],
  "totalBudgetNote": "Generell budsjettkommentar"
}`;

  const userMsg = `Eksisterende kampanjer: ${JSON.stringify(state.D.campaigns.map(c => ({
    navn: c.name, type: c.type, forbruk: (c.costMicros / 1e6).toFixed(0),
    konverteringer: c.conversions.toFixed(1), ctr: (c.ctr * 100).toFixed(2) + '%',
  })))}

Månedlig budsjett: kr ${budget}
${focus ? 'Spesielt fokus: ' + focus : ''}

Lag en optimal struktur med 3-5 kampanjer. Tilpass til norsk premium møbelmarked.`;

  try {
    const res = await callClaude(system, userMsg, 3000);
    const raw = res.content?.[0]?.text || res.text || '';
    const data = parseAIJson(raw);
    out.innerHTML = renderCampaignStructure(data);
    setStatus(status, 'ok', '✓ Struktur generert');
    logAction('Genererte kampanjestruktur');
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn);
  }
}

// ═══ NEGATIVE SØKEORD-GENERATOR ════════════════════════════════════
export async function generateNegativeKeywords() {
  const btn    = document.getElementById('gen-neg-btn');
  const status = document.getElementById('gen-neg-status');
  const out    = document.getElementById('gen-neg-out');
  if (!out) return;

  setBtnLoading(btn, 'Analyserer...');
  setStatus(status, 'loading', 'Analyserer søketermer...');

  const system = `Du er en Google Ads-ekspert for Novooi, en norsk premium nettbutikk for møbler og interiør.
Analyser søketermen og foreslå negative søkeord som bør ekskluderes.

SVAR KUN MED GYLDIG JSON:
{
  "negatives": [
    {"keyword": "søkeord", "match": "EXACT|PHRASE|BROAD", "reason": "Forklaring"}
  ]
}`;

  const terms = state.D.searchterms
    .filter(t => t.status === 'NONE' && t.clicks > 0 && t.conversions === 0 && t.costMicros > 500000)
    .sort((a, b) => b.costMicros - a.costMicros)
    .slice(0, 30);

  const userMsg = `Søketermer uten konverteringer (topp 30 etter forbruk):\n${JSON.stringify(
    terms.map(t => ({ term: t.term, klikk: t.clicks, forbruk: (t.costMicros / 1e6).toFixed(0) + ' kr' }))
  )}`;

  try {
    const res = await callClaude(system, userMsg, 1500);
    const raw = res.content?.[0]?.text || res.text || '';
    const data = parseAIJson(raw);
    const negs = data.negatives || [];

    out.innerHTML = negs.map(n => `
      <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1">
          <span style="font-weight:600">${n.keyword}</span>
          <span class="badge b-gray" style="margin-left:8px">${n.match}</span>
          <div style="font-size:12px;color:var(--ink3);margin-top:4px">${n.reason}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="quickAddNeg('${n.keyword.replace(/'/g, "\\'")}','${n.match}')">+ Legg til</button>
      </div>`).join('');

    setStatus(status, 'ok', `✓ ${negs.length} negative søkeord foreslått`);
    logAction(`Genererte ${negs.length} negative søkeordforslag`);
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn);
  }
}

// ═══ SØKETERM-ANALYSE ══════════════════════════════════════════════
export async function analyseSearchTerms() {
  const btn    = document.getElementById('st-analyse-btn');
  const status = document.getElementById('st-analyse-status');
  const out    = document.getElementById('st-analyse-out');
  if (!out) return;

  setBtnLoading(btn, 'Analyserer...');
  setStatus(status, 'loading', 'Analyserer søketermer...');

  const system = `Du er en senior Google Ads-strateg for Novooi, norsk premium møbel- og interiørnettbutikk.
Analyser søketermer og identifiser: 1) termer som bør legges til som søkeord, 2) termer som bør negeres, 3) mønstre og muligheter.
Gi konkrete handlingsforslag. Bruk norsk.`;

  const userMsg = `Søketermer (siste 30 dager):\n${JSON.stringify(
    state.D.searchterms.slice(0, 50).map(t => ({
      term: t.term, status: t.status,
      klikk: t.clicks, konv: t.conversions.toFixed(1),
      forbruk: (t.costMicros / 1e6).toFixed(0) + ' kr',
    }))
  )}`;

  try {
    const res = await callClaude(system, userMsg, 2000);
    const raw = res.content?.[0]?.text || res.text || '';
    out.innerHTML = `<div class="ai-markdown">${raw.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>`;
    setStatus(status, 'ok', '✓ Analyse ferdig');
    logAction('Analyserte søketermer');
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn);
  }
}

// ═══ CHAT ═════════════════════════════════════════════════════════
export async function sendChat() {
  const input  = document.getElementById('chat-input');
  const out    = document.getElementById('chat-out');
  const btn    = document.getElementById('chat-send-btn');
  const msg    = input?.value.trim();
  if (!msg || !out) return;

  setBtnLoading(btn, 'Sender...');
  input.disabled = true;

  const system = `Du er en senior Google Ads-strateg for Novooi, en norsk premium nettbutikk for møbler og interiør med over 100 norske designere.

Du har tilgang til kampanjedata:
${JSON.stringify({
  kampanjer: state.D.campaigns.map(c => ({
    navn: c.name, status: c.status,
    klikk: c.clicks, ctr: (c.ctr * 100).toFixed(2) + '%',
    forbruk: (c.costMicros / 1e6).toFixed(0) + ' kr',
    konv: c.conversions.toFixed(1),
  })).slice(0, 10),
}, null, 2)}

Svar kort, konkret og handlingsorientert. Bruk norsk.`;

  state.chatHistory.push({ role: 'user', content: msg });
  input.value = '';
  renderChat(out);

  try {
    const res = await wPost('/chat', {
      system,
      messages: state.chatHistory.slice(-10),
    });
    const reply = res.content?.[0]?.text || res.text || '(Tomt svar)';
    state.chatHistory.push({ role: 'assistant', content: reply });
    renderChat(out);
    logAction('Chat: "' + msg.slice(0, 40) + (msg.length > 40 ? '…' : '') + '"');
  } catch (err) {
    state.chatHistory.push({ role: 'assistant', content: '⚠ Feil: ' + err.message });
    renderChat(out);
  } finally {
    resetBtn(btn, 'Send');
    input.disabled = false;
    input.focus();
  }
}

function renderChat(el) {
  el.innerHTML = state.chatHistory.map(m => `
    <div class="chat-msg chat-${m.role}">
      <div class="chat-bubble">${m.content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
    </div>`).join('');
  el.scrollTop = el.scrollHeight;
}

// ═══ SØKEORDFORSLAG ═══════════════════════════════════════════════
export async function suggestKeywords() {
  const btn    = document.getElementById('kw-suggest-btn');
  const status = document.getElementById('kw-suggest-status');
  const out    = document.getElementById('kw-suggest-out');
  if (!out) return;

  setBtnLoading(btn, 'Genererer...');
  setStatus(status, 'loading', 'Spør Claude...');

  const system = `Du er en senior Google Ads-strateg for Novooi, en norsk premium møbel- og interiørnettbutikk.
Foreslå nye søkeord basert på eksisterende høytytende søkeord og eventuelle gaps.

SVAR KUN MED GYLDIG JSON:
{
  "keywords": [
    {"keyword": "søkeord", "match": "EXACT|PHRASE|BROAD", "rationale": "Begrunnelse", "estimatedCtr": "2-4%"}
  ]
}`;

  const top = [...state.D.keywords]
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 20);

  const userMsg = `Topp 20 konverterende søkeord:\n${JSON.stringify(
    top.map(k => ({ søkeord: k.keyword, match: k.matchType, konv: k.conversions.toFixed(1), qs: k.qs }))
  )}\n\nForeslå 10-15 nye søkeord med høyt potensial for norsk premium møbelmarked.`;

  try {
    const res = await callClaude(system, userMsg, 2000);
    const raw = res.content?.[0]?.text || res.text || '';
    const data = parseAIJson(raw);
    const kws = data.keywords || [];
    out.innerHTML = kws.map(k => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1">
          <span style="font-weight:600">${k.keyword}</span>
          <span class="badge b-gray" style="margin-left:6px">${k.match}</span>
          <span class="badge b-gray" style="margin-left:4px">~CTR ${k.estimatedCtr}</span>
          <div style="font-size:12px;color:var(--ink3);margin-top:4px">${k.rationale}</div>
        </div>
      </div>`).join('');
    setStatus(status, 'ok', `✓ ${kws.length} søkeord foreslått`);
    logAction(`Genererte ${kws.length} søkeordforslag`);
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn);
  }
}

// ═══ ANNONSETEKST-GENERATOR ════════════════════════════════════════
export async function generateAdCopy() {
  const btn    = document.getElementById('gen-ad-btn');
  const status = document.getElementById('gen-ad-status');
  const out    = document.getElementById('gen-ad-out');
  const theme  = document.getElementById('ad-theme-input')?.value  || 'Norsk designmøbel';
  const url    = document.getElementById('ad-url-input')?.value    || 'novooi.com';
  if (!out) return;

  setBtnLoading(btn, 'Genererer...');
  setStatus(status, 'loading', 'Spør Claude...');

  const toneMap = {
    brutal:   'Direkte og faktabasert. Ingen fluff. Kortfattet og informativt.',
    warm:     'Varm og innbydende. Fokus på hjemmefølelse og inspirasjonsverdi.',
    premium:  'Eksklusiv og raffinert. Presisjon og kvalitetsfokus.',
    playful:  'Leken og engasjerende. Frisk og energisk tone.',
    urgent:   'Handlingsfremmende og tidssensitiv. Klar til å kjøpe-fokus.',
  };

  const system = `Du er en senior Google Ads copywriter for Novooi, norsk premium nettbutikk for møbler og interiør med 100+ norske designere.

SVAR KUN MED GYLDIG JSON:
{
  "ads": [
    {
      "headlines": ["Overskrift 1 (max 30 tegn)", "Overskrift 2", "Overskrift 3"],
      "descriptions": ["Beskrivelse 1 (max 90 tegn)", "Beskrivelse 2"],
      "displayUrl": "novooi.com/[sti]",
      "rationale": "Hvorfor denne varianten fungerer"
    }
  ]
}`;

  const userMsg = `Lag 3 unike annonsevariasjoner for:
- Tema: ${theme}
- URL: ${url}
- Tone: ${toneMap[state.selectedTone] || toneMap.premium}
- USP-er: Norsk design, 100+ merkevarer, premium kvalitet, rask levering
- Konkurrenter: IKEA, Bohus, Living

Inkluder minst 5 overskrifter og 3 beskrivelser per variant.`;

  try {
    const res = await callClaude(system, userMsg, 2000);
    const raw = res.content?.[0]?.text || res.text || '';
    const data = parseAIJson(raw);
    const ads = data.ads || [];
    // Bugfiks: korrekte CSS-variabler i border-color
    out.innerHTML = ads.map((ad, i) => `
      <div style="border:1px solid var(--border);padding:16px;margin-bottom:12px;background:var(--bg2)">
        <div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:10px">Variant ${i + 1}</div>
        <div class="ad-preview">
          <div class="ad-url">${ad.displayUrl || url}</div>
          <div class="ad-headlines">${ad.headlines.map(h => `<span class="ad-h">${h}</span>`).join(' · ')}</div>
          <div class="ad-descs">${(ad.descriptions || []).map(d => `<div style="font-size:13px;color:var(--ink3);margin-top:4px">${d}</div>`).join('')}</div>
        </div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:12px;color:var(--ink3)">${ad.rationale}</div>
      </div>`).join('');
    setStatus(status, 'ok', `✓ ${ads.length} annonsevarianter klar`);
    logAction(`Genererte ${ads.length} annonsevarianter`);
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn);
  }
}

// ═══ DAGLIG VARSEL (TEST) ══════════════════════════════════════════
export async function testDailyAlert() {
  const btn    = document.getElementById('test-daily-btn');
  const status = document.getElementById('test-daily-status');
  const out    = document.getElementById('test-daily-out');
  if (!out) return;

  setBtnLoading(btn, 'Genererer...');
  setStatus(status, 'loading', 'Genererer daglig varsel...');

  const system = `Du er en Google Ads-assistent for Novooi. Lag et kort, skannbart daglig statusvarsel (maks 150 ord).
Format: 1 linje status, 3 korte punkter med viktigste funn, 1 konkret anbefaling for dagen.
Bruk norsk.`;

  const spend   = state.D.campaigns.reduce((s, c) => s + c.costMicros, 0) / 1e6;
  const clicks  = state.D.campaigns.reduce((s, c) => s + c.clicks, 0);
  const convs   = state.D.campaigns.reduce((s, c) => s + c.conversions, 0);
  const avgCtr  = state.D.campaigns.reduce((s, c) => s + c.impressions, 0);
  const userMsg = `Status i dag: kr ${spend.toFixed(0)} brukt, ${clicks} klikk, ${convs.toFixed(1)} konverteringer, snitt CTR ${avgCtr ? (clicks / avgCtr * 100).toFixed(2) : 0}%`;

  try {
    const res = await callClaude(system, userMsg, 400);
    const text = res.content?.[0]?.text || res.text || '';
    out.innerHTML = `<div class="ai-markdown" style="font-size:14px;line-height:1.7">${text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>`;
    setStatus(status, 'ok', '✓ Varsel generert');
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn);
  }
}

// ═══ MÅNEDLIG RAPPORT-TEKST (TEST) ════════════════════════════════
export async function testMonthlyReport() {
  const btn    = document.getElementById('test-monthly-btn');
  const status = document.getElementById('test-monthly-status');
  const out    = document.getElementById('test-monthly-out');
  if (!out) return;

  setBtnLoading(btn, 'Genererer...');
  setStatus(status, 'loading', 'Genererer rapport-tekst...');

  const system = `Du er en senior Google Ads-strateg for Novooi. Skriv en profesjonell månedlig rapport-oppsummering (200-300 ord).
Inkluder: ytelsessammendrag, viktigste funn, anbefalinger for neste måned.
Skriv til en ikke-teknisk markedssjef. Bruk norsk.`;

  const totalSpend = state.D.campaigns.reduce((s, c) => s + c.costMicros, 0) / 1e6;
  const totalConv  = state.D.campaigns.reduce((s, c) => s + c.conversions, 0);
  const userMsg = `Totalt forbruk: kr ${totalSpend.toFixed(0)}, ${totalConv.toFixed(1)} konverteringer, ${state.D.campaigns.length} aktive kampanjer.`;

  try {
    const res = await callClaude(system, userMsg, 600);
    const text = res.content?.[0]?.text || res.text || '';
    out.innerHTML = `<div class="ai-markdown" style="font-size:14px;line-height:1.8">${text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>`;
    setStatus(status, 'ok', '✓ Rapport-tekst klar');
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn);
  }
}

// ═══ KAMPANJEHUKOMMELSE ═══════════════════════════════════════════
export async function saveCampaignMemoryNow() {
  const btn    = document.getElementById('save-memory-btn');
  const status = document.getElementById('memory-status');
  if (!state.D.campaigns.length) {
    showToast('err', 'Hent data før du lagrer hukommelse');
    return;
  }
  setBtnLoading(btn, 'Lagrer...');
  setStatus(status, 'loading', 'Lagrer kampanjehukommelse...');
  try {
    const week = getIsoWeek();
    const snap = {
      week, date: new Date().toLocaleDateString('nb-NO'),
      campaigns: state.D.campaigns.map(c => ({
        id: c.id, name: c.name, status: c.status, type: c.type,
        ctr: c.ctr, conversionRate: c.conversionRate,
        costMicros: c.costMicros, conversions: c.conversions,
      })),
      summary: {
        totalSpend: state.D.campaigns.reduce((s, c) => s + c.costMicros, 0) / 1e6,
        totalConv:  state.D.campaigns.reduce((s, c) => s + c.conversions, 0),
        avgCtr:     state.D.campaigns.reduce((s, c) => s + c.ctr, 0) / (state.D.campaigns.length || 1),
      },
    };
    await wPost('/memory/save', { snap });
    setStatus(status, 'ok', `✓ Lagret uke ${week}`);
    logAction('Lagret kampanjehukommelse for ' + week);
    showToast('ok', 'Hukommelse lagret');
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn);
  }
}

export async function loadCampaignMemory() {
  const btn    = document.getElementById('load-memory-btn');
  const status = document.getElementById('memory-status');
  const out    = document.getElementById('memory-out');
  if (!out) return;
  setBtnLoading(btn, 'Laster...');
  setStatus(status, 'loading', 'Henter historikk...');
  try {
    const res   = await wPost('/memory/load', {});
    const snaps = res.snapshots || [];
    if (!snaps.length) {
      out.innerHTML = '<p style="color:var(--ink3);font-family:var(--mono);font-size:12px">Ingen lagret hukommelse funnet.</p>';
      setStatus(status, 'ok', 'Ingen data');
      return;
    }
    const latest = snaps[snaps.length - 1];
    const prev   = snaps.length > 1 ? snaps[snaps.length - 2] : null;
    const diff   = buildMemoryDiff(state.D.campaigns, prev);
    const diffHtml = diff ? renderMemoryDiff(diff, prev?.week) : '';

    out.innerHTML = diffHtml + snaps.map(s => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
        <span class="mono" style="font-size:12px">${s.week}</span>
        <span class="mono" style="font-size:12px">${s.date}</span>
        <span class="mono">kr ${s.summary?.totalSpend?.toFixed(0) || '—'}</span>
        <span class="mono">${s.summary?.totalConv?.toFixed(1) || '—'} konv.</span>
        <span class="mono">${((s.summary?.avgCtr || 0) * 100).toFixed(2)}% CTR</span>
      </div>`).join('');

    setStatus(status, 'ok', `✓ ${snaps.length} uker lastet`);
    logAction('Lastet kampanjehukommelse');
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn);
  }
}

// ═══ HJELPERE ═════════════════════════════════════════════════════
function getIsoWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const wn = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(wn).padStart(2, '0')}`;
}
