/* ============================================================
   settings.js — Settings Panel (Phase 6)
   ============================================================ */

const Settings = (() => {

  async function init() {
    const container = document.getElementById('settingsContent');

    const theme = document.documentElement.getAttribute('data-theme') || 'dark';

    container.innerHTML = `
      <div class="settings-group">
        <h3>Appearance</h3>
        <div class="setting-row">
          <div>
            <div class="setting-label">Dark Theme</div>
            <div class="setting-desc">Toggle between dark and light theme</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="settingDarkTheme" ${theme === 'dark' ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="settings-group">
        <h3>Study Preferences</h3>
        <div class="setting-row">
          <div>
            <div class="setting-label">Cards Per Session</div>
            <div class="setting-desc">Maximum cards in a study session (0 = unlimited)</div>
          </div>
          <input type="number" id="settingCardsPerSession" class="text-input" style="width:80px" min="0" max="500" value="0" />
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Shuffle Cards</div>
            <div class="setting-desc">Randomize card order each session</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="settingShuffle" checked />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Auto-flip After Assessment</div>
            <div class="setting-desc">Automatically flip back to front when moving to next card</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="settingAutoFlip" checked />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="settings-group">
        <h3>Spaced Repetition</h3>
        <div class="setting-row">
          <div>
            <div class="setting-label">Initial Ease Factor</div>
            <div class="setting-desc">SM-2 starting ease factor (default: 2.5)</div>
          </div>
          <input type="number" id="settingEaseFactor" class="text-input" style="width:80px" min="1.3" max="4.0" step="0.1" value="2.5" />
        </div>
      </div>

      <div class="settings-group">
        <h3>Keyboard Shortcuts</h3>
        <div class="setting-row">
          <div class="setting-label" style="font-family:var(--font-mono);font-size:0.85rem">Space</div>
          <div class="setting-desc">Flip card</div>
        </div>
        <div class="setting-row">
          <div class="setting-label" style="font-family:var(--font-mono);font-size:0.85rem">1</div>
          <div class="setting-desc">Know It</div>
        </div>
        <div class="setting-row">
          <div class="setting-label" style="font-family:var(--font-mono);font-size:0.85rem">2</div>
          <div class="setting-desc">Unsure</div>
        </div>
        <div class="setting-row">
          <div class="setting-label" style="font-family:var(--font-mono);font-size:0.85rem">3</div>
          <div class="setting-desc">Don't Know</div>
        </div>
        <div class="setting-row">
          <div class="setting-label" style="font-family:var(--font-mono);font-size:0.85rem">&rarr;</div>
          <div class="setting-desc">Next card (auto-assess as Unsure)</div>
        </div>
      </div>

      <div class="settings-group">
        <h3>About</h3>
        <div class="setting-row">
          <div class="setting-label">CISSP StudyDeck</div>
          <div class="setting-desc">Version 1.1.1</div>
        </div>
        <div class="setting-row">
          <div class="setting-label">Storage</div>
          <div class="setting-desc" id="settingStorageInfo">Calculating...</div>
        </div>
      </div>
    `;

    // Load saved settings
    await loadSettings();

    // Attach handlers
    document.getElementById('settingDarkTheme').addEventListener('change', async (e) => {
      const theme = e.target.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', theme);
      await DB.setSetting('theme', theme);
    });

    document.getElementById('settingCardsPerSession').addEventListener('change', async (e) => {
      await DB.setSetting('cardsPerSession', parseInt(e.target.value) || 0);
    });

    document.getElementById('settingShuffle').addEventListener('change', async (e) => {
      await DB.setSetting('shuffle', e.target.checked);
    });

    document.getElementById('settingAutoFlip').addEventListener('change', async (e) => {
      await DB.setSetting('autoFlip', e.target.checked);
    });

    document.getElementById('settingEaseFactor').addEventListener('change', async (e) => {
      await DB.setSetting('easeFactor', parseFloat(e.target.value) || 2.5);
    });

    // Storage info
    updateStorageInfo();
  }

  async function loadSettings() {
    const cardsPerSession = await DB.getSetting('cardsPerSession');
    if (cardsPerSession !== null) {
      document.getElementById('settingCardsPerSession').value = cardsPerSession;
    }

    const shuffle = await DB.getSetting('shuffle');
    if (shuffle !== null) {
      document.getElementById('settingShuffle').checked = shuffle;
    }

    const autoFlip = await DB.getSetting('autoFlip');
    if (autoFlip !== null) {
      document.getElementById('settingAutoFlip').checked = autoFlip;
    }

    const easeFactor = await DB.getSetting('easeFactor');
    if (easeFactor !== null) {
      document.getElementById('settingEaseFactor').value = easeFactor;
    }
  }

  async function updateStorageInfo() {
    const el = document.getElementById('settingStorageInfo');
    try {
      const cardCount = await DB.getCardCount();
      const deckCount = (await DB.getAllDecks()).length;
      const sessionCount = (await DB.getAllSessions()).length;

      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const usedMB = (estimate.usage / (1024 * 1024)).toFixed(2);
        const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(0);
        el.textContent = `${cardCount} cards, ${deckCount} decks, ${sessionCount} sessions | ${usedMB} MB used of ${quotaMB} MB`;
      } else {
        el.textContent = `${cardCount} cards, ${deckCount} decks, ${sessionCount} sessions`;
      }
    } catch (err) {
      el.textContent = 'Unable to estimate storage';
    }
  }

  return { init };

})();