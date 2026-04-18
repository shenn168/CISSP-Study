/* ============================================================
   utils.js — Utility functions (FIXED)
   ============================================================ */

const Utils = (() => {

  const DOMAINS = [
    { num: 1, name: 'Security and Risk Management' },
    { num: 2, name: 'Asset Security' },
    { num: 3, name: 'Security Architecture and Engineering' },
    { num: 4, name: 'Communication and Network Security' },
    { num: 5, name: 'Identity and Access Management (IAM)' },
    { num: 6, name: 'Security Assessment and Testing' },
    { num: 7, name: 'Security Operations' },
    { num: 8, name: 'Software Development Security' }
  ];

  const DOMAIN_NAMES = DOMAINS.map(d => d.name);

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ──────────────────────────────────────────────
  // FIX: Return LOCAL date string instead of UTC.
  // toISOString() returns UTC which can be a
  // different calendar day than the user's local
  // date during evening hours west of UTC.
  // ──────────────────────────────────────────────
  function todayStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  // ──────────────────────────────────────────────
  // NEW: Timezone-safe date difference calculator.
  // Parses YYYY-MM-DD strings as local noon to
  // avoid DST boundary edge cases.
  // ──────────────────────────────────────────────
  function dateDiffDays(dateStrA, dateStrB) {
    if (!dateStrA || !dateStrB) return Infinity;

    const [yearA, monthA, dayA] = dateStrA.split('-').map(Number);
    const [yearB, monthB, dayB] = dateStrB.split('-').map(Number);

    const a = new Date(yearA, monthA - 1, dayA, 12, 0, 0);
    const b = new Date(yearB, monthB - 1, dayB, 12, 0, 0);

    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  }

  function normalizeTerm(term) {
    return term
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  function validateDomain(input) {
    if (!input) return null;
    const lower = input.trim().toLowerCase();

    for (const name of DOMAIN_NAMES) {
      if (name.toLowerCase() === lower) return name;
    }

    for (const name of DOMAIN_NAMES) {
      if (name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase())) {
        return name;
      }
    }

    const numMatch = lower.match(/^(\d)$/);
    if (numMatch) {
      const idx = parseInt(numMatch[1]) - 1;
      if (idx >= 0 && idx < DOMAIN_NAMES.length) return DOMAIN_NAMES[idx];
    }

    return null;
  }

  function validateType(input) {
    if (!input) return 'definition';
    const lower = input.trim().toLowerCase();
    if (lower === 'scenario') return 'scenario';
    return 'definition';
  }

  function createCard(data) {
    const card = {
      id: data.id || generateUUID(),
      term: (data.term || '').trim(),
      domain: validateDomain(data.domain) || 'Security and Risk Management',
      type: validateType(data.type),
      primaryAnswer: {
        text: '',
        contributor: 'Unknown',
        sourceDeck: 'Unknown',
        importedAt: nowISO()
      },
      alsoSee: [],
      examTip: (data.examTip || data.tip || '').trim(),
      scenarioText: (data.scenarioText || '').trim() || null,
      relatedCards: [],
      tags: [],
      flagged: data.flagged || false,
      sm2: {
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
        nextReviewDate: todayStr()
      },
      selfAssessment: null,
      reviewHistory: []
    };

    if (typeof data.primaryAnswer === 'object' && data.primaryAnswer !== null) {
      card.primaryAnswer = {
        text: (data.primaryAnswer.text || '').trim(),
        contributor: (data.primaryAnswer.contributor || 'Unknown').trim(),
        sourceDeck: (data.primaryAnswer.sourceDeck || 'Unknown').trim(),
        importedAt: data.primaryAnswer.importedAt || nowISO()
      };
    } else if (data.answer) {
      card.primaryAnswer.text = data.answer.trim();
      card.primaryAnswer.contributor = (data.contributor || 'Unknown').trim();
    }

    if (Array.isArray(data.alsoSee)) {
      card.alsoSee = data.alsoSee.map(item => ({
        text: (item.text || '').trim(),
        contributor: (item.contributor || 'Unknown').trim(),
        sourceDeck: (item.sourceDeck || 'Unknown').trim(),
        importedAt: item.importedAt || nowISO()
      }));
    }

    if (Array.isArray(data.relatedCards)) {
      card.relatedCards = data.relatedCards.map(r => (typeof r === 'string' ? r.trim() : r));
    } else if (typeof data.relatedCards === 'string') {
      card.relatedCards = data.relatedCards.split(';').map(r => r.trim()).filter(Boolean);
    }

    if (Array.isArray(data.tags)) {
      card.tags = data.tags.map(t => t.trim().toLowerCase()).filter(Boolean);
    } else if (typeof data.tags === 'string') {
      card.tags = data.tags.split(';').map(t => t.trim().toLowerCase()).filter(Boolean);
    }

    if (data.sm2 && typeof data.sm2 === 'object') {
      card.sm2 = { ...card.sm2, ...data.sm2 };
    }

    if (Array.isArray(data.reviewHistory)) {
      card.reviewHistory = data.reviewHistory;
    }

    return card;
  }

  function toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 3000);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ──────────────────────────────────────────────
  // FIX: Guard against undefined/null input
  // ──────────────────────────────────────────────
  function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ──────────────────────────────────────────────
  // FIX: Added defensive null checks for:
  //   - card.sm2 (may be undefined on malformed cards)
  //   - card.reviewHistory (may be undefined on
  //     freshly imported or legacy cards)
  // ──────────────────────────────────────────────
  function getMasteryTier(card) {
    const sm2 = card.sm2 || { interval: 0, easeFactor: 2.5, repetitions: 0 };
    const history = card.reviewHistory || [];

    const rep = sm2.repetitions || 0;
    const ef = sm2.easeFactor || 2.5;
    const interval = sm2.interval || 0;

    if (rep === 0 && history.length === 0) return 'new';
    if (rep < 2 || interval < 3) return 'learning';
    if (rep < 5 || interval < 21) return 'reviewing';
    if (rep >= 5 && ef >= 2.0 && interval >= 21) return 'mastered';
    return 'reviewing';
  }

  // ──────────────────────────────────────────────
  // FIX: Handle both nested sm2.nextReviewDate
  // and flattened top-level nextReviewDate field
  // ──────────────────────────────────────────────
  function isDueToday(card) {
    const today = todayStr();
    const sm2 = card.sm2 || {};
    const nextReview = card.nextReviewDate || sm2.nextReviewDate || today;
    return nextReview <= today;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return {
    DOMAINS,
    DOMAIN_NAMES,
    generateUUID,
    todayStr,
    nowISO,
    dateDiffDays,
    normalizeTerm,
    validateDomain,
    validateType,
    createCard,
    toast,
    formatDate,
    escapeHTML,
    getMasteryTier,
    isDueToday,
    shuffle
  };

})();