import { state } from './data.js';
import {
  wPost, getWorker, setStatus, setBtnLoading, resetBtn,
  handleError, logAction, loadScript, kr, pct, fmt,
} from './helpers.js';

// ═══ INNGANGSPUNKT ════════════════════════════════════════════════
export async function generateReport() {
  const btn    = document.getElementById('gen-report-btn');
  const status = document.getElementById('report-status');
  if (!state.D.campaigns.length) {
    setStatus(status, 'err', 'Hent kampanjedata først');
    return;
  }
  setBtnLoading(btn, 'Genererer PDF...');
  setStatus(status, 'loading', 'Forbereder rapport...');

  const period  = document.getElementById('report-period')?.value  || '30 dager';
  const aiText  = document.getElementById('report-ai-text')?.value || '';
  const tone    = state.selectedTone;
  const opts = {
    showCampaigns:    document.getElementById('rpt-campaigns')?.checked   ?? true,
    showKeywords:     document.getElementById('rpt-keywords')?.checked    ?? true,
    showRecommend:    document.getElementById('rpt-recommendations')?.checked ?? true,
    showBranding:     document.getElementById('rpt-branding')?.checked    ?? true,
    clientName:       document.getElementById('rpt-client')?.value        || 'Novooi',
  };

  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    await buildPDF(state.D, period, opts, aiText, tone);
    setStatus(status, 'ok', '✓ PDF lastet ned');
    logAction('Genererte PDF-rapport');
  } catch (err) {
    handleError(status, err);
  } finally {
    resetBtn(btn);
  }
}

// ═══ PDF-BYGGER ═══════════════════════════════════════════════════
async function buildPDF(data, period, opts, aiText, tone) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const MARGIN   = 20;
  const PW       = 210 - MARGIN * 2;
  const BRAND_C  = [10, 10, 10];
  const ACCENT_C = [180, 140, 100];
  const GRAY_C   = [100, 100, 100];
  const LIGHT_C  = [240, 240, 240];

  let y = MARGIN;

  // ── Hjelpere ────────────────────────────────────────────────────
  const newPage = () => {
    doc.addPage();
    y = MARGIN;
    if (opts.showBranding) {
      doc.setFontSize(7).setTextColor(...GRAY_C);
      doc.text('Novooi — Google Ads Rapport', MARGIN, 8);
      doc.text(new Date().toLocaleDateString('nb-NO'), 210 - MARGIN, 8, { align: 'right' });
      doc.setDrawColor(...LIGHT_C).setLineWidth(0.3);
      doc.line(MARGIN, 10, 210 - MARGIN, 10);
      y = MARGIN;
    }
  };

  const checkPage = (needed = 20) => {
    if (y + needed > 280) newPage();
  };

  const h1 = (txt) => {
    checkPage(14);
    doc.setFontSize(20).setFont(undefined, 'bold').setTextColor(...BRAND_C);
    doc.text(txt, MARGIN, y);
    y += 10;
  };

  const h2 = (txt) => {
    checkPage(12);
    doc.setFontSize(12).setFont(undefined, 'bold').setTextColor(...BRAND_C);
    doc.text(txt, MARGIN, y);
    doc.setDrawColor(...ACCENT_C).setLineWidth(0.5);
    doc.line(MARGIN, y + 1.5, MARGIN + doc.getTextWidth(txt), y + 1.5);
    y += 9;
  };

  const p = (txt, color = BRAND_C, size = 10) => {
    checkPage(8);
    doc.setFontSize(size).setFont(undefined, 'normal').setTextColor(...color);
    const lines = doc.splitTextToSize(txt, PW);
    doc.text(lines, MARGIN, y);
    y += lines.length * 5 + 2;
  };

  const spacer = (mm = 6) => { y += mm; };

  // ── Forside ─────────────────────────────────────────────────────
  doc.setFillColor(...BRAND_C);
  doc.rect(0, 0, 210, 60, 'F');
  doc.setFontSize(28).setFont(undefined, 'bold').setTextColor(255, 255, 255);
  doc.text('Google Ads Rapport', MARGIN, 32);
  doc.setFontSize(13).setFont(undefined, 'normal').setTextColor(...ACCENT_C);
  doc.text(opts.clientName, MARGIN, 42);
  doc.setFontSize(10).setTextColor(180, 180, 180);
  doc.text(`Periode: ${period}  ·  Generert: ${new Date().toLocaleDateString('nb-NO')}`, MARGIN, 50);

  y = 70;

  // ── Nøkkeltall ─────────────────────────────────────────────────
  const totalSpend = data.campaigns.reduce((s, c) => s + c.costMicros, 0) / 1e6;
  const totalClicks = data.campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalImpr   = data.campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalConv   = data.campaigns.reduce((s, c) => s + c.conversions, 0);
  const avgCtr      = totalImpr ? totalClicks / totalImpr : 0;
  const cpa         = totalConv ? totalSpend / totalConv : 0;

  const metrics = [
    { label: 'Forbruk',         value: 'kr ' + Math.round(totalSpend).toLocaleString('nb-NO') },
    { label: 'Klikk',           value: totalClicks.toLocaleString('nb-NO') },
    { label: 'Konverteringer',  value: totalConv.toFixed(1) },
    { label: 'Gj.sn. CTR',     value: (avgCtr * 100).toFixed(2) + '%' },
    { label: 'CPA',             value: 'kr ' + cpa.toFixed(0) },
    { label: 'Aktive kampanjer',value: String(data.campaigns.filter(c => c.status === 'ENABLED').length) },
  ];

  const boxW = (PW - 8) / 3;
  const boxH = 22;
  metrics.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx  = MARGIN + col * (boxW + 4);
    const by  = y + row * (boxH + 4);
    doc.setFillColor(248, 248, 248).setDrawColor(...LIGHT_C).setLineWidth(0.3);
    doc.roundedRect(bx, by, boxW, boxH, 2, 2, 'FD');
    doc.setFontSize(16).setFont(undefined, 'bold').setTextColor(...BRAND_C);
    doc.text(m.value, bx + boxW / 2, by + 12, { align: 'center' });
    doc.setFontSize(7).setFont(undefined, 'normal').setTextColor(...GRAY_C);
    doc.text(m.label.toUpperCase(), bx + boxW / 2, by + 18, { align: 'center' });
  });

  y += Math.ceil(metrics.length / 3) * (boxH + 4) + 8;

  // ── AI-tekst (innledning/analyse) ───────────────────────────────
  if (aiText?.trim()) {
    spacer();
    h2('AI-analyse');
    const lines = aiText.split('\n').filter(l => l.trim());
    lines.forEach(line => {
      const clean = line.replace(/^\*\*(.*?)\*\*/g, '$1').replace(/^#{1,3}\s*/, '').trim();
      if (!clean) return;
      if (/^#{1,2}/.test(line) || /^\*\*/.test(line)) {
        checkPage(8);
        doc.setFontSize(10).setFont(undefined, 'bold').setTextColor(...BRAND_C);
        doc.text(clean, MARGIN, y); y += 7;
      } else {
        p(clean, GRAY_C, 9);
      }
    });
  }

  // ── Kampanjetabell ─────────────────────────────────────────────
  if (opts.showCampaigns && data.campaigns.length) {
    newPage();
    h2('Kampanjeyteelse');
    spacer(2);
    doc.autoTable({
      startY: y,
      head: [['Kampanje', 'Status', 'Klikk', 'CTR', 'Forbruk', 'Konv.', 'CPA']],
      body: data.campaigns.map(c => [
        c.name.length > 28 ? c.name.slice(0, 27) + '…' : c.name,
        c.status === 'ENABLED' ? 'Aktiv' : 'Pauset',
        c.clicks.toLocaleString('nb-NO'),
        (c.ctr * 100).toFixed(2) + '%',
        'kr ' + Math.round(c.costMicros / 1e6).toLocaleString('nb-NO'),
        c.conversions.toFixed(1),
        c.conversions > 0 ? 'kr ' + Math.round(c.costMicros / 1e6 / c.conversions).toLocaleString('nb-NO') : '—',
      ]),
      styles: { fontSize: 8, cellPadding: 3, font: 'helvetica', textColor: [30, 30, 30] },
      headStyles: { fillColor: BRAND_C, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 16 } },
      margin: { left: MARGIN, right: MARGIN },
      didDrawPage: () => { y = doc.lastAutoTable.finalY + 8; },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Søkeord-tabell ─────────────────────────────────────────────
  if (opts.showKeywords && data.keywords.length) {
    checkPage(30);
    h2('Topp søkeord');
    spacer(2);
    const topKws = [...data.keywords].sort((a, b) => b.conversions - a.conversions).slice(0, 20);
    doc.autoTable({
      startY: y,
      head: [['Søkeord', 'Match', 'Klikk', 'CTR', 'Forbruk', 'Konv.', 'QS']],
      body: topKws.map(k => [
        k.keyword.length > 30 ? k.keyword.slice(0, 29) + '…' : k.keyword,
        k.matchType === 'EXACT' ? 'Eksakt' : k.matchType === 'PHRASE' ? 'Frase' : 'Bred',
        k.clicks.toLocaleString('nb-NO'),
        (k.ctr * 100).toFixed(2) + '%',
        'kr ' + Math.round(k.costMicros / 1e6).toLocaleString('nb-NO'),
        k.conversions.toFixed(1),
        k.qs > 0 ? String(k.qs) : '—',
      ]),
      styles: { fontSize: 8, cellPadding: 3, textColor: [30, 30, 30] },
      headStyles: { fillColor: BRAND_C, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: { 0: { cellWidth: 55 } },
      margin: { left: MARGIN, right: MARGIN },
      didDrawPage: () => { y = doc.lastAutoTable.finalY + 8; },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Anbefalinger ────────────────────────────────────────────────
  if (opts.showRecommend) {
    checkPage(30);
    newPage();
    h2('Anbefalinger');
    spacer(2);

    const lowQs    = data.keywords.filter(k => k.qs && k.qs <= 4);
    const zeroConv = data.campaigns.filter(c => c.status === 'ENABLED' && c.costMicros > 2e9 && c.conversions === 0);
    const highCtr  = data.campaigns.filter(c => c.ctr > 0.05 && c.status === 'ENABLED');

    const recs = [];
    if (zeroConv.length) recs.push({ prio: '🔴', txt: `Pause eller evaluer ${zeroConv.map(c => c.name).join(', ')} — forbruker budsjett uten konverteringer.` });
    if (lowQs.length)    recs.push({ prio: '🟠', txt: `${lowQs.length} søkeord med QS ≤ 4. Restrukturér i dedikerte annonsegrupper og forbedre landingssider.` });
    if (highCtr.length)  recs.push({ prio: '🟢', txt: `Skaler opp ${highCtr.map(c => c.name).join(', ')} — leverer over 5% CTR.` });
    recs.push({ prio: '🔵', txt: 'Legg til negative søkeord basert på søketermer uten konverteringer for å forbedre ROAS.' });
    recs.push({ prio: '🔵', txt: 'Vurder Performance Max-kampanje for remarketing og produkter som ikke dekkes av søkekampanjer.' });

    recs.forEach((r, i) => {
      checkPage(12);
      doc.setFontSize(9).setFont(undefined, 'normal').setTextColor(...BRAND_C);
      const lines = doc.splitTextToSize(`${i + 1}. ${r.prio} ${r.txt}`, PW - 4);
      doc.text(lines, MARGIN + 2, y);
      y += lines.length * 5 + 3;
    });
  }

  // ── Bunntekst siste side ────────────────────────────────────────
  if (opts.showBranding) {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7).setTextColor(...GRAY_C);
      doc.text(`Side ${i} av ${pageCount}`, 210 - MARGIN, 292, { align: 'right' });
      doc.text('Konfidensielt — Novooi Digital', MARGIN, 292);
    }
  }

  // ── Last ned ────────────────────────────────────────────────────
  const fname = `novooi-ads-rapport-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
}
