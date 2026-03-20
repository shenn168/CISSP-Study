/* ============================================================
   popup.js — Extension Popup Controller
   ============================================================ */

(async function () {

  const DB_NAME = 'CISSPStudyDeck';
  const DB_VERSION = 1;

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

  // ---- Theme ----
  let currentTheme = 'dark';

  try {
    const stored = localStorage.getItem('cissp-theme');
    if (stored) currentTheme = stored;
  } catch (e) {}

  document.documentElement.setAttribute('data-theme', currentTheme);

  document.getElementById('popupThemeToggle').addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    try { localStorage.setItem('cissp-theme', currentTheme); } catch (e) {}
  });

  // ---- Open IndexedDB ----
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains('cards')) {
          const cardStore = database.createObjectStore('cards', { keyPath: 'id' });
          cardStore.createIndex('term', 'term', { unique: false });
          cardStore.createIndex('domain', 'domain', { unique: false });
          cardStore.createIndex('type', 'type', { unique: false });
          cardStore.createIndex('flagged', 'flagged', { unique: false });
          cardStore.createIndex('nextReviewDate', 'sm2.nextReviewDate', { unique: false });
        }
        if (!database.objectStoreNames.contains('decks')) {
          database.createObjectStore('decks', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('sessions')) {
          database.createObjectStore('sessions', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  function getAllFromStore(db, storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function getSettingFromStore(db, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function getMasteryTier(card) {
    const rep = card.sm2 ? card.sm2.repetitions : 0;
    const ef = card.sm2 ? card.sm2.easeFactor : 2.5;
    const interval = card.sm2 ? card.sm2.interval : 0;
    const history = card.reviewHistory || [];

    if (rep === 0 && history.length === 0) return 'new';
    if (rep < 2 || interval < 3) return 'learning';
    if (rep < 5 || interval < 21) return 'reviewing';
    if (rep >= 5 && ef >= 2.0 && interval >= 21) return 'mastered';
    return 'reviewing';
  }

  function isDueToday(card) {
    const today = todayStr();
    return card.sm2 && card.sm2.nextReviewDate <= today;
  }

  // ---- Render ----
  try {
    const db = await openDB();
    const cards = await getAllFromStore(db, 'cards');
    const streakData = await getSettingFromStore(db, 'streak');

    // Also sync theme from IndexedDB if available
    const savedTheme = await getSettingFromStore(db, 'theme');
    if (savedTheme) {
      currentTheme = savedTheme;
      document.documentElement.setAttribute('data-theme', currentTheme);
    }

    const totalCards = cards.length;
    const dueToday = cards.filter(c => isDueToday(c)).length;
    const mastered = cards.filter(c => getMasteryTier(c) === 'mastered').length;
    const streak = streakData ? streakData.current : 0;

    // Domain breakdown
    const domainCounts = {};
    DOMAINS.forEach(d => { domainCounts[d.name] = 0; });
    cards.forEach(c => {
      if (domainCounts[c.domain] !== undefined) domainCounts[c.domain]++;
    });

    const body = document.getElementById('popupBody');

    let domainRowsHTML = '';
    DOMAINS.forEach(d => {
      domainRowsHTML += `
        <div class="popup-domain-row">
          <span class="popup-domain-num">${d.num}</span>
          <span class="popup-domain-name">${d.name}</span>
          <span class="popup-domain-count">${domainCounts[d.name]}</span>
        </div>
      `;
    });

    if (totalCards === 0) {
      body.innerHTML = `
        <div style="text-align:center;padding:1.5rem 0">
          <div style="font-size:2.5rem;margin-bottom:0.5rem">&#x1F4DA;</div>
          <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:1rem">No cards loaded yet.</p>
          <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:1.25rem">Open a new tab to access the full StudyDeck and import your first deck.</p>
          <div class="popup-actions">
            <button class="popup-btn popup-btn-primary" id="openNewTab">&#x1F4C2; Open StudyDeck</button>
          </div>
        </div>
      `;
    } else {
      body.innerHTML = `
        <div class="popup-stats">
          <div class="popup-stat">
            <span class="popup-stat-num">${totalCards}</span>
            <span class="popup-stat-label">Total Cards</span>
          </div>
          <div class="popup-stat">
            <span class="popup-stat-num" style="color:var(--accent-yellow)">${dueToday}</span>
            <span class="popup-stat-label">Due Today</span>
          </div>
          <div class="popup-stat">
            <span class="popup-stat-num" style="color:var(--accent-green)">${mastered}</span>
            <span class="popup-stat-label">Mastered</span>
          </div>
          <div class="popup-stat">
            <span class="popup-stat-num" style="color:var(--accent-red)">${streak}</span>
            <span class="popup-stat-label">Day Streak</span>
          </div>
        </div>

        ${dueToday > 0 ? `<div class="popup-due-banner">&#x1F514; You have <strong>${dueToday}</strong> card${dueToday > 1 ? 's' : ''} due for review today!</div>` : '<div class="popup-due-banner" style="border-color:rgba(34,197,94,0.2);background:rgba(34,197,94,0.1)">&#x2705; All caught up! No cards due today.</div>'}

        <div class="popup-actions">
          <button class="popup-btn popup-btn-primary" id="openNewTab">&#x1F4DA; Open StudyDeck</button>
          <button class="popup-btn popup-btn-secondary" id="openStudy">&#x1F0CF; Quick Study</button>
          <button class="popup-btn popup-btn-ghost" id="openDashboard">&#x1F4CA; Dashboard</button>
        </div>

        <hr class="popup-divider" />

        <div class="popup-domains">
          <h4>Cards by Domain</h4>
          ${domainRowsHTML}
        </div>
      `;
    }

    // Attach button handlers
    const openNewTabBtn = document.getElementById('openNewTab');
    if (openNewTabBtn) {
      openNewTabBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'newtab.html' });
        window.close();
      });
    }

    const openStudyBtn = document.getElementById('openStudy');
    if (openStudyBtn) {
      openStudyBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'newtab.html#study' });
        window.close();
      });
    }

    const openDashboardBtn = document.getElementById('openDashboard');
    if (openDashboardBtn) {
      openDashboardBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'newtab.html#dashboard' });
        window.close();
      });
    }

    db.close();

  } catch (err) {
    console.error('Popup error:', err);
    document.getElementById('popupBody').innerHTML = `
      <div style="text-align:center;padding:1.5rem 0">
        <div style="font-size:2rem;margin-bottom:0.5rem">&#x26A0;&#xFE0F;</div>
        <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:1rem">Unable to load data.</p>
        <div class="popup-actions">
          <button class="popup-btn popup-btn-primary" id="openNewTabFallback">Open StudyDeck</button>
        </div>
      </div>
    `;
    document.getElementById('openNewTabFallback').addEventListener('click', () => {
      chrome.tabs.create({ url: 'newtab.html' });
      window.close();
    });
  }

})();