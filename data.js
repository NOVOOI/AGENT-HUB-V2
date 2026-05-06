// ═══ MUTABLE STATE (delt på tvers av moduler) ════════════════════
export const state = {
  D: { campaigns: [], adGroups: [], ads: [], keywords: [], searchterms: [] },
  negKwList: [],
  chatHistory: [],
  sortState: {},
  kwViewMode: 'grouped',   // 'grouped' | 'flat'
  selectedTone: 'brutal',
  structData: null,
  sessionPW: '',
  sparkData: {},
  actLog: [],
  obStep: 0,
};

// ═══ AUTH ════════════════════════════════════════════════════════
export const PW_HASH = 'dcd458ef95a356fe810c809b4ace850962a2f35b4bd6a23f664c4ef64de40df5';

// ═══ BENCHMARKS ══════════════════════════════════════════════════
export const BENCHMARKS = {
  ctr: { search: 0.028, display: 0.004 },
  convRate: 0.018,
  cpa: 890,
};

// ═══ TAB ANALYSE-PROMPTS ══════════════════════════════════════════
export const TAB_PROMPTS = {
  campaigns: {
    system: `Du er en senior Google Ads-strateg for Novooi, en norsk premium nettbutikk for møbler og interiør (novooi.com) som aggregerer 100+ norske designere.

Analyser kampanjene og gi to typer tilbakemeldinger:
DEL 1 — FORBEDRINGER: Konkrete, spesifikke tiltak for å forbedre eksisterende kampanjer.
DEL 2 — STRATEGISKE ALTERNATIVER: For underytende kampanjer — radikalt annerledes tilnærming.

Vær direkte og konkret. Bruk norsk.`,
    userMsg: (D) => `Kampanjdata (siste 30 dager):\n${JSON.stringify(D.campaigns.map(c => ({
      navn: c.name, status: c.status, type: c.type,
      visninger: c.impressions, klikk: c.clicks,
      ctr: (c.ctr * 100).toFixed(2) + '%',
      forbruk_kr: (c.costMicros / 1e6).toFixed(0),
      konverteringer: c.conversions.toFixed(1),
      konvRate: (c.conversionRate * 100).toFixed(2) + '%',
    })), null, 2)}\n\nBransjesnitt: CTR 2,8%, conv rate 1,8%, CPA kr 890.`,
  },

  keywords: {
    system: `Du er en senior Google Ads-søkeordstrateg for Novooi, en norsk premium møbel- og interiørnettbutikk.
Analyser søkeordene og gi: forbedringer for eksisterende + strategiske alternativer for underytende søkeord.
Vær direkte og konkret. Bruk norsk.`,
    userMsg: (D) => `Søkeorddata (siste 30 dager):\n${JSON.stringify(D.keywords.map(k => ({
      søkeord: k.keyword, match: k.matchType, kampanje: k.campaign,
      visninger: k.impressions, klikk: k.clicks,
      ctr: (k.ctr * 100).toFixed(2) + '%',
      forbruk_kr: (k.costMicros / 1e6).toFixed(0),
      konverteringer: k.conversions.toFixed(1), qs: k.qs,
    })), null, 2)}\n\nBransjenorm QS: 7+, CTR: 2,8%+.`,
  },

  ads: {
    system: `Du er en senior Google Ads copywriter for Novooi, norsk premium møbel- og interiørnettbutikk med 100+ norske designere.
Analyser annonsene: forbedringer i kopi + strategiske alternativer for lav-CTR annonser.
Gi faktiske eksempler på tekst. Vær direkte. Bruk norsk.`,
    userMsg: (D) => `Annonsedata (siste 30 dager):\n${JSON.stringify(D.ads.map(a => ({
      headline: a.headline, kampanje: a.campaign, status: a.status,
      visninger: a.impressions, klikk: a.clicks,
      ctr: (a.ctr * 100).toFixed(2) + '%',
      konverteringer: a.conversions.toFixed(1),
    })), null, 2)}\n\nBransjenorm CTR: 2,8%+. USP-er: norsk design, 100+ merkevarer, premium kvalitet.`,
  },
};
