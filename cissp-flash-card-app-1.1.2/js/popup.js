/* ============================================================
   popup.js — Extension Popup Controller
   ============================================================ */

(async function () {

  const DB_NAME = 'CISSPStudyDeck';
  const DB_VERSION = 2;

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

  // ──────────────────────────────────────────────
  // Helper: Open StudyDeck in a new tab
  // MUST be defined at the top level of the IIFE
  // so both try and catch blocks can access it
  // ──────────────────────────────────────────────
  function openStudyDeck(hash) {
    var url = hash ? 'newtab.html#' + hash : 'newtab.html';
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.create === 'function') {
        chrome.tabs.create({ url: url });
        window.close();
      } else {
        window.open(url, '_blank');
      }
    } catch (e) {
      window.open(url, '_blank');
    }
  }

  // ──────────────────────────────────────────────
  // Theme initialization
  // ──────────────────────────────────────────────
  let currentTheme = 'dark';

  try {
    var stored = localStorage.getItem('cissp-theme');
    if (stored) currentTheme = stored;
  } catch (e) {
    // localStorage may not be available
  }

  document.documentElement.setAttribute('data-theme', currentTheme);

  var themeToggleBtn = document.getElementById('popupThemeToggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', function () {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', currentTheme);
      try {
        localStorage.setItem('cissp-theme', currentTheme);
      } catch (e) {
        // localStorage may not be available
      }
    });
  }

  // ──────────────────────────────────────────────
  // IndexedDB helpers
  // ──────────────────────────────────────────────
  function openDB() {
    return new Promise(function (resolve, reject) {
      var request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        reject(e);
        return;
      }

      request.onupgradeneeded = function (event) {
        var database = event.target.result;
        if (!database.objectStoreNames.contains('cards')) {
          var cardStore = database.createObjectStore('cards', { keyPath: 'id' });
          cardStore.createIndex('term', 'term', { unique: false });
          cardStore.createIndex('domain', 'domain', { unique: false });
          cardStore.createIndex('type', 'type', { unique: false });
          cardStore.createIndex('flagged', 'flagged', { unique: false });
          cardStore.createIndex('selfAssessment', 'selfAssessment', { unique: false });
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

      request.onsuccess = function (event) {
        resolve(event.target.result);
      };
      request.onerror = function (event) {
        reject(event.target.error);
      };
    });
  }

  function getAllFromStore(db, storeName) {
    return new Promise(function (resolve, reject) {
      try {
        var tx = db.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var req = store.getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      } catch (e) {
        resolve([]);
      }
    });
  }

  function getSettingFromStore(db, key) {
    return new Promise(function (resolve, reject) {
      try {
        var tx = db.transaction('settings', 'readonly');
        var store = tx.objectStore('settings');
        var req = store.get(key);
        req.onsuccess = function () { resolve(req.result ? req.result.value : null); };
        req.onerror = function () { resolve(null); };
      } catch (e) {
        resolve(null);
      }
    });
  }

  // ──────────────────────────────────────────────
  // Card utility helpers
  // ──────────────────────────────────────────────
  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function getMasteryTier(card) {
    if (!card) return 'new';
    var sm2 = card.sm2;
    var rep = sm2 ? (sm2.repetitions || 0) : 0;
    var ef = sm2 ? (sm2.easeFactor || 2.5) : 2.5;
    var interval = sm2 ? (sm2.interval || 0) : 0;
    var history = card.reviewHistory || [];

    if (rep === 0 && history.length === 0) return 'new';
    if (rep < 2 || interval < 3) return 'learning';
    if (rep < 5 || interval < 21) return 'reviewing';
    if (rep >= 5 && ef >= 2.0 && interval >= 21) return 'mastered';
    return 'reviewing';
  }

  function isDueToday(card) {
    if (!card || !card.sm2) return false;
    var nrd = card.sm2.nextReviewDate;
    if (!nrd) return false;
    return nrd <= todayStr();
  }

  // ──────────────────────────────────────────────
  // Safe element setter helpers
  // ──────────────────────────────────────────────
  function safeSetHTML(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
    return el;
  }

  function safeAddClick(id, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
    return el;
  }

  // ──────────────────────────────────────────────
  // Main render logic
  // ──────────────────────────────────────────────
  var popupBody = document.getElementById('popupBody');

  if (!popupBody) {
    console.error('Popup error: #popupBody element not found in DOM');
    return;
  }

  try {
    var db = await openDB();
    var cards = await getAllFromStore(db, 'cards');
    var streakData = await getSettingFromStore(db, 'streak');

    // Sync theme from IndexedDB if available
    var savedTheme = await getSettingFromStore(db, 'theme');
    if (savedTheme) {
      currentTheme = savedTheme;
      document.documentElement.setAttribute('data-theme', currentTheme);
    }

    var totalCards = cards.length;
    var dueToday = 0;
    var mastered = 0;

    for (var ci = 0; ci < cards.length; ci++) {
      if (isDueToday(cards[ci])) dueToday++;
      if (getMasteryTier(cards[ci]) === 'mastered') mastered++;
    }

    var streak = (streakData && typeof streakData === 'object')
      ? (streakData.current || 0)
      : (typeof streakData === 'number' ? streakData : 0);

    // Domain breakdown
    var domainCounts = {};
    for (var di = 0; di < DOMAINS.length; di++) {
      domainCounts[DOMAINS[di].name] = 0;
    }
    for (var cj = 0; cj < cards.length; cj++) {
      var d = cards[cj].domain;
      if (domainCounts[d] !== undefined) {
        domainCounts[d]++;
      }
    }

    var domainRowsHTML = '';
    for (var dk = 0; dk < DOMAINS.length; dk++) {
      var dom = DOMAINS[dk];
      domainRowsHTML +=
        '<div class="popup-domain-row">' +
          '<span class="popup-domain-num">' + dom.num + '</span>' +
          '<span class="popup-domain-name">' + dom.name + '</span>' +
          '<span class="popup-domain-count">' + domainCounts[dom.name] + '</span>' +
        '</div>';
    }

    if (totalCards === 0) {
      popupBody.innerHTML =
        '<div style="text-align:center;padding:1.5rem 0">' +
          '<div style="font-size:2.5rem;margin-bottom:0.5rem">&#x1F4DA;</div>' +
          '<p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:1rem">No cards loaded yet.</p>' +
          '<p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:1.25rem">Open a new tab to access the full StudyDeck and import your first deck.</p>' +
          '<div class="popup-actions">' +
            '<button class="popup-btn popup-btn-primary" id="openNewTab">&#x1F4C2; Open StudyDeck</button>' +
          '</div>' +
        '</div>';
    } else {
      var dueBanner = '';
      if (dueToday > 0) {
        dueBanner =
          '<div class="popup-due-banner">&#x1F514; You have <strong>' + dueToday + '</strong> card' +
          (dueToday > 1 ? 's' : '') + ' due for review today!</div>';
      } else {
        dueBanner =
          '<div class="popup-due-banner" style="border-color:rgba(34,197,94,0.2);background:rgba(34,197,94,0.1)">&#x2705; All caught up! No cards due today.</div>';
      }

      popupBody.innerHTML =
        '<div class="popup-stats">' +
          '<div class="popup-stat">' +
            '<span class="popup-stat-num">' + totalCards + '</span>' +
            '<span class="popup-stat-label">Total Cards</span>' +
          '</div>' +
          '<div class="popup-stat">' +
            '<span class="popup-stat-num" style="color:var(--accent-yellow)">' + dueToday + '</span>' +
            '<span class="popup-stat-label">Due Today</span>' +
          '</div>' +
          '<div class="popup-stat">' +
            '<span class="popup-stat-num" style="color:var(--accent-green)">' + mastered + '</span>' +
            '<span class="popup-stat-label">Mastered</span>' +
          '</div>' +
          '<div class="popup-stat">' +
            '<span class="popup-stat-num" style="color:var(--accent-red)">' + streak + '</span>' +
            '<span class="popup-stat-label">Day Streak</span>' +
          '</div>' +
        '</div>' +
        dueBanner +
        '<div class="popup-actions">' +
          '<button class="popup-btn popup-btn-primary" id="openNewTab">&#x1F4DA; Open StudyDeck</button>' +
          '<button class="popup-btn popup-btn-secondary" id="openStudy">&#x1F0CF; Quick Study</button>' +
          '<button class="popup-btn popup-btn-ghost" id="openDashboard">&#x1F4CA; Dashboard</button>' +
        '</div>' +
        '<hr class="popup-divider" />' +
        '<div class="popup-domains">' +
          '<h4>Cards by Domain</h4>' +
          domainRowsHTML +
        '</div>';
    }

    // ── Attach button handlers safely ──
    safeAddClick('openNewTab', function () { openStudyDeck(''); });
    safeAddClick('openStudy', function () { openStudyDeck('study'); });
    safeAddClick('openDashboard', function () { openStudyDeck('dashboard'); });

    // ── Close DB connection ──
    try {
      db.close();
    } catch (e) {
      // Ignore close errors
    }

  } catch (err) {
    console.error('Popup error:', err);

    // ── Fallback UI ──
    // popupBody was checked for null above the try block,
    // so it is guaranteed to exist here
    popupBody.innerHTML =
      '<div style="text-align:center;padding:1.5rem 0">' +
        '<div style="font-size:2rem;margin-bottom:0.5rem">&#x26A0;&#xFE0F;</div>' +
        '<p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:1rem">Unable to load data.</p>' +
        '<div class="popup-actions">' +
          '<button class="popup-btn popup-btn-primary" id="openNewTabFallback">Open StudyDeck</button>' +
        '</div>' +
      '</div>';

    // openStudyDeck is defined at the top of the IIFE — always in scope
    safeAddClick('openNewTabFallback', function () { openStudyDeck(''); });
  }

})();