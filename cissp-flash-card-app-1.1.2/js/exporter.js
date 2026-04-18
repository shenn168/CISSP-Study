/* ============================================================
   exporter.js — Export Engine (Phase 5)
   ============================================================ */

const Exporter = (() => {

  async function init() {
    const container = document.getElementById('exportContent');
    const cards = await DB.getAllCards();

    if (cards.length === 0) {
      container.innerHTML = `
        <div class="no-cards">
          <span class="no-cards-icon">&#x1F4E6;</span>
          <p>No cards to export. Import a deck first.</p>
          <button class="btn btn-primary" data-view="import">Import Deck</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <p class="view-desc">Export your cards to share with study group members.</p>
      <div class="export-options">
        <div class="export-group">
          <h3 style="color:var(--accent-primary);margin-bottom:0.75rem">Format</h3>
          <label><input type="radio" name="exportFormat" value="json" checked /> JSON (full fidelity)</label>
          <label><input type="radio" name="exportFormat" value="csv" /> CSV (spreadsheet-friendly)</label>
          <label><input type="radio" name="exportFormat" value="txt" /> Plain Text (readable)</label>
        </div>
        <div class="export-group">
          <h3 style="color:var(--accent-primary);margin-bottom:0.75rem">Domain Filter</h3>
          <label><input type="radio" name="exportDomain" value="all" checked /> All Domains</label>
          ${Utils.DOMAINS.map(d => `<label><input type="radio" name="exportDomain" value="${d.name}" /> ${d.num}. ${d.name}</label>`).join('')}
        </div>
        <div class="export-group">
          <h3 style="color:var(--accent-primary);margin-bottom:0.75rem">Options</h3>
          <label><input type="checkbox" id="exportIncludeProgress" /> Include progress/review data</label>
          <label><input type="checkbox" id="exportFlaggedOnly" /> Flagged cards only</label>
        </div>
        <div style="margin-top:1rem">
          <button class="btn btn-primary btn-lg" id="exportBtn">&#x1F4BE; Export Deck</button>
          <span id="exportInfo" style="margin-left:1rem;color:var(--text-muted);font-size:0.85rem"></span>
        </div>
      </div>
    `;

    document.getElementById('exportBtn').addEventListener('click', doExport);

    // Show card count preview
    updateExportInfo();
    container.querySelectorAll('input[name="exportDomain"], #exportFlaggedOnly').forEach(el => {
      el.addEventListener('change', updateExportInfo);
    });
  }

  async function updateExportInfo() {
    const cards = await getFilteredCards();
    document.getElementById('exportInfo').textContent = `${cards.length} card(s) will be exported`;
  }

  async function getFilteredCards() {
    let cards = await DB.getAllCards();
    const domain = document.querySelector('input[name="exportDomain"]:checked').value;
    const flaggedOnly = document.getElementById('exportFlaggedOnly').checked;

    if (domain !== 'all') {
      cards = cards.filter(c => c.domain === domain);
    }
    if (flaggedOnly) {
      cards = cards.filter(c => c.flagged);
    }
    return cards;
  }

  async function doExport() {
    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    const includeProgress = document.getElementById('exportIncludeProgress').checked;
    const cards = await getFilteredCards();

    if (cards.length === 0) {
      Utils.toast('No cards to export with current filters.', 'error');
      return;
    }

    let content, mimeType, ext;

    switch (format) {
      case 'json':
        content = exportJSON(cards, includeProgress);
        mimeType = 'application/json';
        ext = 'json';
        break;
      case 'csv':
        content = exportCSV(cards, includeProgress);
        mimeType = 'text/csv';
        ext = 'csv';
        break;
      case 'txt':
        content = exportPlainText(cards, includeProgress);
        mimeType = 'text/plain';
        ext = 'txt';
        break;
    }

    const filename = `cissp-studydeck-export-${Utils.todayStr()}.${ext}`;
    downloadFile(content, filename, mimeType);
    Utils.toast(`Exported ${cards.length} cards as ${ext.toUpperCase()}.`, 'success');
  }

  function exportJSON(cards, includeProgress) {
    const exportCards = cards.map(card => {
      const obj = {
        id: card.id,
        term: card.term,
        domain: card.domain,
        type: card.type,
        primaryAnswer: card.primaryAnswer,
        alsoSee: card.alsoSee,
        examTip: card.examTip,
        scenarioText: card.scenarioText,
        relatedCards: card.relatedCards,
        tags: card.tags,
        flagged: card.flagged
      };

      if (includeProgress) {
        obj.sm2 = card.sm2;
        obj.selfAssessment = card.selfAssessment;
        obj.reviewHistory = card.reviewHistory;
      }

      return obj;
    });

    return JSON.stringify(exportCards, null, 2);
  }

  function exportCSV(cards, includeProgress) {
    let headers = ['term', 'domain', 'type', 'answer', 'examTip', 'relatedCards', 'contributor', 'tags', 'scenarioText', 'flagged'];

    if (includeProgress) {
      headers.push('sm2Interval', 'sm2EaseFactor', 'sm2Repetitions', 'sm2NextReview', 'selfAssessment');
    }

    const rows = [headers.join(',')];

    cards.forEach(card => {
      const vals = [
        csvEscape(card.term),
        csvEscape(card.domain),
        csvEscape(card.type),
        csvEscape(card.primaryAnswer.text),
        csvEscape(card.examTip || ''),
        csvEscape((card.relatedCards || []).join(';')),
        csvEscape(card.primaryAnswer.contributor || ''),
        csvEscape((card.tags || []).join(';')),
        csvEscape(card.scenarioText || ''),
        card.flagged ? 'true' : 'false'
      ];

      if (includeProgress) {
        vals.push(
          card.sm2.interval,
          card.sm2.easeFactor,
          card.sm2.repetitions,
          csvEscape(card.sm2.nextReviewDate),
          csvEscape(card.selfAssessment || '')
        );
      }

      rows.push(vals.join(','));
    });

    return rows.join('\
');
  }

  function exportPlainText(cards, includeProgress) {
    const blocks = cards.map(card => {
      let block = `TERM: ${card.term}\
`;
      block += `DOMAIN: ${card.domain}\
`;
      block += `TYPE: ${card.type}\
`;
      block += `ANSWER: ${card.primaryAnswer.text}\
`;
      if (card.examTip) block += `TIP: ${card.examTip}\
`;
      if (card.relatedCards && card.relatedCards.length > 0) {
        block += `RELATED: ${card.relatedCards.join('; ')}\
`;
      }
      block += `CONTRIBUTOR: ${card.primaryAnswer.contributor}\n`;
      if (card.tags && card.tags.length > 0) {
        block += `TAGS: ${card.tags.join('; ')}\
`;
      }
      if (card.scenarioText) block += `SCENARIO: ${card.scenarioText}\
`;
      if (card.flagged) block += `FLAGGED: true\n`;

      if (includeProgress) {
        block += `SM2_INTERVAL: ${card.sm2.interval}\
`;
        block += `SM2_EASE: ${card.sm2.easeFactor}\
`;
        block += `SM2_REPS: ${card.sm2.repetitions}\
`;
        block += `SM2_NEXT: ${card.sm2.nextReviewDate}\
`;
      }

      return block;
    });

    return blocks.join('---\
');
  }

  function csvEscape(val) {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\
')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { init };

})();