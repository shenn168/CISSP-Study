/* ============================================================
   db.js — IndexedDB Storage Engine
   ============================================================ */

const DB = (() => {

  const DB_NAME = 'CISSPStudyDeck';
  const DB_VERSION = 1;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) { resolve(db); return; }

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

  async function getAllCards() { return getAll('cards'); }
  async function getCardById(id) { return get('cards', id); }
  async function saveCard(card) { return put('cards', card); }
  async function saveCards(cards) { return putBatch('cards', cards); }
  async function deleteCard(id) { return remove('cards', id); }
  async function getCardsByDomain(domain) { return getAllByIndex('cards', 'domain', domain); }
  async function getCardCount() { return count('cards'); }

  async function getAllDecks() { return getAll('decks'); }
  async function saveDeck(deck) { return put('decks', deck); }
  async function deleteDeck(id) { return remove('decks', id); }

  async function getAllSessions() { return getAll('sessions'); }
  async function saveSession(session) { return put('sessions', session); }

  async function getSetting(key) {
    const record = await get('settings', key);
    return record ? record.value : null;
  }

  async function setSetting(key, value) {
    return put('settings', { key, value });
  }

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

  return {
    open, put, putBatch, get, getAll, getAllByIndex,
    remove, removeBatch, count, clear,
    getAllCards, getCardById, saveCard, saveCards,
    deleteCard, getCardsByDomain, getCardCount,
    getAllDecks, saveDeck, deleteDeck,
    getAllSessions, saveSession,
    getSetting, setSetting,
    buildTermIndex, resolveRelatedCard
  };

})();