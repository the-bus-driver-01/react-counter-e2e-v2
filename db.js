/**
 * Data Persistence Layer
 *
 * Provides a unified API for client-side data storage using
 * localStorage with fallback support and optional IndexedDB
 * for larger datasets.
 */

// ── Configuration ────────────────────────────────────────────────────────────

const DB_CONFIG = {
  prefix: 'app_',
  version: 1,
  dbName: 'appDatabase',
  storeName: 'appStore',
};

// ── LocalStorage Adapter ─────────────────────────────────────────────────────

const LocalStorageAdapter = {
  /**
   * Check if localStorage is available
   * @returns {boolean}
   */
  isAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Get a value by key
   * @param {string} key
   * @returns {*} Parsed value or null
   */
  get(key) {
    try {
      const raw = localStorage.getItem(DB_CONFIG.prefix + key);
      if (raw === null) return null;
      const envelope = JSON.parse(raw);
      // Check expiry
      if (envelope.exp && Date.now() > envelope.exp) {
        this.remove(key);
        return null;
      }
      return envelope.value;
    } catch (e) {
      console.warn(`[db] Failed to read key "${key}":`, e);
      return null;
    }
  },

  /**
   * Set a value by key
   * @param {string} key
   * @param {*} value - Must be JSON-serializable
   * @param {object} [options]
   * @param {number} [options.ttl] - Time-to-live in milliseconds
   * @returns {boolean} Success
   */
  set(key, value, options = {}) {
    try {
      const envelope = {
        value,
        ts: Date.now(),
      };
      if (options.ttl) {
        envelope.exp = Date.now() + options.ttl;
      }
      localStorage.setItem(DB_CONFIG.prefix + key, JSON.stringify(envelope));
      return true;
    } catch (e) {
      console.warn(`[db] Failed to write key "${key}":`, e);
      // Handle quota exceeded
      if (e.name === 'QuotaExceededError') {
        this._evictOldest();
        try {
          localStorage.setItem(
            DB_CONFIG.prefix + key,
            JSON.stringify({ value, ts: Date.now() })
          );
          return true;
        } catch (_) {
          return false;
        }
      }
      return false;
    }
  },

  /**
   * Remove a value by key
   * @param {string} key
   */
  remove(key) {
    localStorage.removeItem(DB_CONFIG.prefix + key);
  },

  /**
   * Get all keys managed by this app
   * @returns {string[]}
   */
  keys() {
    const result = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DB_CONFIG.prefix)) {
        result.push(k.slice(DB_CONFIG.prefix.length));
      }
    }
    return result;
  },

  /**
   * Clear all app-scoped data
   */
  clear() {
    this.keys().forEach((k) => this.remove(k));
  },

  /**
   * Evict the oldest entry to free space
   * @private
   */
  _evictOldest() {
    let oldestKey = null;
    let oldestTs = Infinity;

    for (const key of this.keys()) {
      try {
        const raw = localStorage.getItem(DB_CONFIG.prefix + key);
        const envelope = JSON.parse(raw);
        if (envelope.ts < oldestTs) {
          oldestTs = envelope.ts;
          oldestKey = key;
        }
      } catch (_) {
        // Skip malformed entries
      }
    }

    if (oldestKey) {
      this.remove(oldestKey);
    }
  },
};

// ── IndexedDB Adapter ────────────────────────────────────────────────────────

const IndexedDBAdapter = {
  /** @type {IDBDatabase|null} */
  _db: null,

  /**
   * Check if IndexedDB is available
   * @returns {boolean}
   */
  isAvailable() {
    return typeof indexedDB !== 'undefined';
  },

  /**
   * Open (or create) the database
   * @returns {Promise<IDBDatabase>}
   */
  _open() {
    if (this._db) return Promise.resolve(this._db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.dbName, DB_CONFIG.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(DB_CONFIG.storeName)) {
          db.createObjectStore(DB_CONFIG.storeName, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve(this._db);
      };

      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get a value by key
   * @param {string} key
   * @returns {Promise<*>}
   */
  async get(key) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_CONFIG.storeName, 'readonly');
      const store = tx.objectStore(DB_CONFIG.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const record = request.result;
        if (!record) return resolve(null);
        // Check expiry
        if (record.exp && Date.now() > record.exp) {
          this.remove(key);
          return resolve(null);
        }
        resolve(record.value);
      };

      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Set a value by key
   * @param {string} key
   * @param {*} value
   * @param {object} [options]
   * @param {number} [options.ttl] - Time-to-live in milliseconds
   * @returns {Promise<boolean>}
   */
  async set(key, value, options = {}) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_CONFIG.storeName, 'readwrite');
      const store = tx.objectStore(DB_CONFIG.storeName);
      const record = { key, value, ts: Date.now() };
      if (options.ttl) {
        record.exp = Date.now() + options.ttl;
      }
      const request = store.put(record);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Remove a value by key
   * @param {string} key
   * @returns {Promise<void>}
   */
  async remove(key) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_CONFIG.storeName, 'readwrite');
      const store = tx.objectStore(DB_CONFIG.storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all keys
   * @returns {Promise<string[]>}
   */
  async keys() {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_CONFIG.storeName, 'readonly');
      const store = tx.objectStore(DB_CONFIG.storeName);
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clear all data
   * @returns {Promise<void>}
   */
  async clear() {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_CONFIG.storeName, 'readwrite');
      const store = tx.objectStore(DB_CONFIG.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
};

// ── Unified Persistence API ──────────────────────────────────────────────────

const DataStore = {
  /** @type {'localStorage'|'indexedDB'|'memory'} */
  _backend: 'localStorage',

  /** @type {Map} In-memory fallback */
  _memoryStore: new Map(),

  /**
   * Initialize the persistence layer, selecting the best available backend
   * @param {object} [options]
   * @param {string} [options.prefer] - Preferred backend: 'localStorage' or 'indexedDB'
   * @returns {Promise<string>} The backend that was selected
   */
  async init(options = {}) {
    const prefer = options.prefer || 'localStorage';

    if (prefer === 'indexedDB' && IndexedDBAdapter.isAvailable()) {
      this._backend = 'indexedDB';
      try {
        await IndexedDBAdapter._open();
      } catch (e) {
        console.warn('[db] IndexedDB failed to open, falling back:', e);
        this._backend = LocalStorageAdapter.isAvailable() ? 'localStorage' : 'memory';
      }
    } else if (LocalStorageAdapter.isAvailable()) {
      this._backend = 'localStorage';
    } else if (IndexedDBAdapter.isAvailable()) {
      this._backend = 'indexedDB';
    } else {
      this._backend = 'memory';
      console.warn('[db] No persistent storage available, using in-memory fallback');
    }

    console.log(`[db] Initialized with backend: ${this._backend}`);
    return this._backend;
  },

  /**
   * Get a value
   * @param {string} key
   * @returns {Promise<*>}
   */
  async get(key) {
    switch (this._backend) {
      case 'localStorage':
        return LocalStorageAdapter.get(key);
      case 'indexedDB':
        return IndexedDBAdapter.get(key);
      case 'memory':
        return this._memoryStore.get(key) ?? null;
    }
  },

  /**
   * Set a value
   * @param {string} key
   * @param {*} value
   * @param {object} [options]
   * @param {number} [options.ttl] - Time-to-live in ms
   * @returns {Promise<boolean>}
   */
  async set(key, value, options = {}) {
    switch (this._backend) {
      case 'localStorage':
        return LocalStorageAdapter.set(key, value, options);
      case 'indexedDB':
        return IndexedDBAdapter.set(key, value, options);
      case 'memory':
        this._memoryStore.set(key, value);
        return true;
    }
  },

  /**
   * Remove a value
   * @param {string} key
   * @returns {Promise<void>}
   */
  async remove(key) {
    switch (this._backend) {
      case 'localStorage':
        return LocalStorageAdapter.remove(key);
      case 'indexedDB':
        return IndexedDBAdapter.remove(key);
      case 'memory':
        this._memoryStore.delete(key);
    }
  },

  /**
   * Get all keys
   * @returns {Promise<string[]>}
   */
  async keys() {
    switch (this._backend) {
      case 'localStorage':
        return LocalStorageAdapter.keys();
      case 'indexedDB':
        return IndexedDBAdapter.keys();
      case 'memory':
        return [...this._memoryStore.keys()];
    }
  },

  /**
   * Clear all data
   * @returns {Promise<void>}
   */
  async clear() {
    switch (this._backend) {
      case 'localStorage':
        return LocalStorageAdapter.clear();
      case 'indexedDB':
        return IndexedDBAdapter.clear();
      case 'memory':
        this._memoryStore.clear();
    }
  },

  /**
   * Save a collection of items (batch write)
   * @param {Object<string, *>} entries - Key-value pairs
   * @param {object} [options]
   * @returns {Promise<void>}
   */
  async setMany(entries, options = {}) {
    const promises = Object.entries(entries).map(([k, v]) => this.set(k, v, options));
    await Promise.all(promises);
  },

  /**
   * Get multiple values at once
   * @param {string[]} keys
   * @returns {Promise<Object<string, *>>}
   */
  async getMany(keys) {
    const results = {};
    const promises = keys.map(async (k) => {
      results[k] = await this.get(k);
    });
    await Promise.all(promises);
    return results;
  },

  /**
   * Get the active backend name
   * @returns {string}
   */
  getBackend() {
    return this._backend;
  },
};