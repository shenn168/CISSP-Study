/* ============================================================
   deckmanager.js — Deck Manager (Phase 5)
   ============================================================ */

const DeckManager = (() => {

  async function init() {
    const container = document.getElementById('deckManagerContent');
    const decks = await DB.getAllDecks();
    const totalCards = await DB.getCardCount();

    let html = `
      <div class="summary-row" style="margin-bottom:1.5rem;padding:0.75rem;background:var(--bg-card);border-radius:var(--radius-md);border:1px solid var(--border-color)">
        <span class="summary-label">Total Cards in Library</span>
        <span class="summary-value">${totalCards}</span>
      </div>
    `;

    if (decks.length === 0) {
      html += `
        <div class="no-cards">
          <span class="no-cards-icon">&#x1F4DA;</span>
          <p>No decks imported yet.</p>
          <button class="btn btn-primary" data-view="import">Import Deck</button>
        </div>
      `;
    } else {
      html += '<div class="deck-list">';
      decks.sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt));

      decks.forEach(deck => {
        html += `
          <div class="deck-item" data-deck-id="${deck.id}">
            <div class="deck-info">
              <h4>${Utils.escapeHTML(deck.name)}</h4>
              <div class="deck-meta">
                Contributor: ${Utils.escapeHTML(deck.contributor || 'Unknown')}
                &bull; ${deck.cardCount || 0} cards
                (${deck.newCards || 0} new, ${deck.mergedCards || 0} merged)
                &bull; Imported: ${Utils.formatDate(deck.importedAt)}
              </div>
            </div>
            <div class="deck-actions">
              <button class="btn btn-sm btn-danger deck-delete-btn" data-deck-id="${deck.id}" data-deck-name="${Utils.escapeHTML(deck.name)}">Delete</button>
            </div>
          </div>
        `;
      });
      html += '</div>';

      html += `
        <div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border-color)">
          <button class="btn btn-danger" id="clearAllData">&#x26A0; Clear All Data</button>
          <span style="margin-left:0.75rem;font-size:0.8rem;color:var(--text-muted)">Removes all cards, decks, and progress</span>
        </div>
      `;
    }

    container.innerHTML = html;

    // Attach delete handlers
    container.querySelectorAll('.deck-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const deckId = btn.dataset.deckId;
        const deckName = btn.dataset.deckName;
        if (confirm(`Delete deck "${deckName}"? This removes the deck record but keeps the imported cards.`)) {
          await DB.deleteDeck(deckId);
          Utils.toast(`Deck "${deckName}" deleted.`, 'success');
          init();
        }
      });
    });

    // Clear all data
    const clearBtn = document.getElementById('clearAllData');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (confirm('Are you sure? This will permanently delete ALL cards, decks, sessions, and progress data.')) {
          if (confirm('This cannot be undone. Proceed?')) {
            await DB.clear('cards');
            await DB.clear('decks');
            await DB.clear('sessions');
            await DB.clear('settings');
            Utils.toast('All data cleared.', 'success');
            init();
          }
        }
      });
    }
  }

  return { init };

})();