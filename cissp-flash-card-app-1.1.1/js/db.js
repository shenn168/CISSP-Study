/* ============================================================
   db.js — IndexedDB Storage Engine (HARDENED)
   ============================================================ */

const DB = (() => {

  const DB_NAME = 'CISSPStudyDeck';
  const DB_VERSION = 2;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) { resolve(db); return; }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        const oldVersion = event.oldVersion;

        if (!database.objectStoreNames.contains('cards')) {
          const cardStore = database.createObjectStore('cards', { keyPath: 'id' });
          cardStore.createIndex('term', 'term', { unique: false });
          cardStore.createIndex('domain', 'domain', { unique: false });
          cardStore.createIndex('type', 'type', { unique: false });
          cardStore.createIndex('flagged', 'flagged', { unique: false });
          cardStore.createIndex('selfAssessment', 'selfAssessment', { unique: false });
        }

        if (!database.objectStoreNames.contains('decks')) {
          const deckStore = database.createObjectStore('decks', { keyPath: 'id' });
          deckStore.createIndex('name', 'name', { unique: false });
        }

        if (!database.objectStoreNames.contains('sessions')) {
          const sessionStore = database.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('date', 'date', { unique: false });
        }

        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings', { keyPath: 'key' });
        }

        // ──────────────────────────────────────────────
        // V2 migration: remove unstable nested keyPath
        // index and replace with flat field indexes
        // ──────────────────────────────────────────────
        if (oldVersion < 2) {
          const tx = event.target.transaction;
          const cardStore = tx.objectStore('cards');

          if (cardStore.indexNames.contains('nextReviewDate')) {
            cardStore.deleteIndex('nextReviewDate');
          }

          if (!cardStore.indexNames.contains('nextReview')) {
            cardStore.createIndex('nextReview', 'nextReviewDate', { unique: false });
          }

          if (!cardStore.indexNames.contains('selfAssessment')) {
            cardStore.createIndex('selfAssessment', 'selfAssessment', { unique: false });
          }
        }
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        resolve(db);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  function getStore(storeName, mode = 'readonly') {
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  function put(storeName, record) {
    return new Promise((resolve, reject) => {
      const store = getStore(storeName, 'readwrite');
      const req = store.put(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function putBatch(storeName, records) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      records.forEach(rec => store.put(rec));
      tx.oncomplete = () => resolve(records.length);
      tx.onerror = () => reject(tx.error);
    });
  }

  function get(storeName, key) {
    return new Promise((resolve, reject) => {
      const store = getStore(storeName, 'readonly');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  function getAll(storeName) {
    return new Promise((resolve, reject) => {
      const store = getStore(storeName, 'readonly');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function getAllByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const store = getStore(storeName, 'readonly');
      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function remove(storeName, key) {
    return new Promise((resolve, reject) => {
      const store = getStore(storeName, 'readwrite');
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function removeBatch(storeName, keys) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      keys.forEach(key => store.delete(key));
      tx.oncomplete = () => resolve(keys.length);
      tx.onerror = () => reject(tx.error);
    });
  }

  function count(storeName) {
    return new Promise((resolve, reject) => {
      const store = getStore(storeName, 'readonly');
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function clear(storeName) {
    return new Promise((resolve, reject) => {
      const store = getStore(storeName, 'readwrite');
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ──────────────────────────────────────────────
  // Card helpers
  // ──────────────────────────────────────────────
  async function getAllCards() { return getAll('cards'); }
  async function getCardById(id) { return get('cards', id); }

  // ──────────────────────────────────────────────
  // FIX: saveCard now flattens sm2.nextReviewDate
  // into a top-level field for reliable indexing
  // ──────────────────────────────────────────────
  async function saveCard(card) {
    const prepared = prepareCardForStorage(card);
    return put('cards', prepared);
  }

  async function saveCards(cards) {
    const prepared = cards.map(c => prepareCardForStorage(c));
    return putBatch('cards', prepared);
  }

  function prepareCardForStorage(card) {
    return {
      ...card,
      nextReviewDate: (card.sm2 && card.sm2.nextReviewDate)
        ? card.sm2.nextReviewDate
        : null,
      reviewHistory: card.reviewHistory || [],
      selfAssessment: card.selfAssessment || 'new'
    };
  }

  async function deleteCard(id) { return remove('cards', id); }
  async function getCardsByDomain(domain) { return getAllByIndex('cards', 'domain', domain); }
  async function getCardCount() { return count('cards'); }

  // ──────────────────────────────────────────────
  // NEW: Get cards due for review on a given date
  // ──────────────────────────────────────────────
  async function getCardsDueByDate(dateStr) {
    return new Promise((resolve, reject) => {
      const store = getStore('cards', 'readonly');

      if (!store.indexNames.contains('nextReview')) {
        const req = store.getAll();
        req.onsuccess = () => {
          const results = (req.result || []).filter(card => {
            const nrd = card.nextReviewDate || (card.sm2 && card.sm2.nextReviewDate);
            return nrd && nrd <= dateStr;
          });
          resolve(results);
        };
        req.onerror = () => reject(req.error);
        return;
      }

      const index = store.index('nextReview');
      const range = IDBKeyRange.upperBound(dateStr);
      const req = index.getAll(range);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // ──────────────────────────────────────────────
  // Deck helpers
  // ──────────────────────────────────────────────
  async function getAllDecks() { return getAll('decks'); }
  async function saveDeck(deck) { return put('decks', deck); }
  async function deleteDeck(id) { return remove('decks', id); }

  // ──────────────────────────────────────────────
  // Session helpers
  // ──────────────────────────────────────────────
  async function getAllSessions() { return getAll('sessions'); }
  async function saveSession(session) { return put('sessions', session); }

  // ──────────────────────────────────────────────
  // Settings helpers
  // ──────────────────────────────────────────────
  async function getSetting(key) {
    const record = await get('settings', key);
    return record ? record.value : null;
  }

  async function setSetting(key, value) {
    return put('settings', { key, value });
  }

  // ──────────────────────────────────────────────
  // Term resolution helpers
  // ──────────────────────────────────────────────
  async function buildTermIndex() {
    const cards = await getAllCards();
    const index = {};
    cards.forEach(card => {
      const normalized = Utils.normalizeTerm(card.term);
      index[normalized] = card.id;
      index[card.term.toLowerCase().trim()] = card.id;
    });
    return index;
  }

  async function resolveRelatedCard(termStr, termIndex) {
    if (!termStr) return null;
    const idx = termIndex || await buildTermIndex();
    const normalized = Utils.normalizeTerm(termStr);
    return idx[normalized] || idx[termStr.toLowerCase().trim()] || null;
  }

  // ──────────────────────────────────────────────
  // NEW: Database maintenance utility
  // ──────────────────────────────────────────────
  async function migrateCards() {
    const cards = await getAllCards();
    let migrated = 0;

    const needsMigration = cards.filter(card => {
      return (
        card.nextReviewDate === undefined ||
        !Array.isArray(card.reviewHistory)
      );
    });

    if (needsMigration.length > 0) {
      const prepared = needsMigration.map(c => prepareCardForStorage(c));
      await putBatch('cards', prepared);
      migrated = prepared.length;
    }

    return { migrated, total: cards.length };
  }

  return {
    open, put, putBatch, get, getAll, getAllByIndex,
    remove, removeBatch, count, clear,
    getAllCards, getCardById, saveCard, saveCards,
    deleteCard, getCardsByDomain, getCardCount,
    getCardsDueByDate, migrateCards,
    getAllDecks, saveDeck, deleteDeck,
    getAllSessions, saveSession,
    getSetting, setSetting,
    buildTermIndex, resolveRelatedCard
  };

})();