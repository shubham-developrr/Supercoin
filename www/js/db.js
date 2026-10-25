/* =========================================================================
   SuperCoin Vault — Persistent storage (IndexedDB)
   All data lives on the device. Nothing leaves the phone unless the user
   exports it themselves.
   ========================================================================= */

const DB_NAME = 'SuperCoinVaultDB';
const DB_VERSION = 1;
const STORE_ACCOUNTS = 'accounts';
const STORE_META = 'meta';

/* ------------------------------------------------------------------ */
/* Exact 11-account seed data (first-launch only)                     */
/* ------------------------------------------------------------------ */
const SEED_ACCOUNTS = [
  {
    id: 1,
    alias: 'Riya Bhabhi',
    balance: 24,
    pending: 457,
    expiringAmount: 0,
    expiryDate: '',
    shopsyDays: 0,
    phoneDevice: '',
    phoneNumber: '',
    gosatsStatus: 'Inactive',
    panHolder: 'Riya Bhabhi',
    notes: 'Riya bhabhi..... Now 24.....to come 457',
    history: [],
  },
  {
    id: 2,
    alias: '9169',
    balance: 1283,
    pending: 0,
    expiringAmount: 0,
    expiryDate: '',
    shopsyDays: 0,
    phoneDevice: '',
    phoneNumber: '9169...',
    gosatsStatus: 'Inactive',
    panHolder: '',
    notes: '9169.... 1283',
    history: [],
  },
  {
    id: 3,
    alias: '630650',
    balance: 175,
    pending: 0,
    expiringAmount: 0,
    expiryDate: '',
    shopsyDays: 0,
    phoneDevice: '',
    phoneNumber: '630650...',
    gosatsStatus: 'Inactive',
    panHolder: '',
    notes: '630650....... 175ish',
    history: [],
  },
  {
    id: 4,
    alias: '7355',
    balance: 150,
    pending: 0,
    expiringAmount: 0,
    expiryDate: '',
    shopsyDays: 0,
    phoneDevice: '',
    phoneNumber: '7355...',
    gosatsStatus: 'Inactive',
    panHolder: '',
    notes: '7355......150',
    history: [],
  },
  {
    id: 5,
    alias: 'Dadi',
    balance: 148,
    pending: 0,
    expiringAmount: 0,
    expiryDate: '',
    shopsyDays: 0,
    phoneDevice: '',
    phoneNumber: '',
    gosatsStatus: 'Inactive',
    panHolder: 'Dadi',
    notes: 'Dadi......148',
    history: [],
  },
  {
    id: 6,
    alias: '8056',
    balance: 45,
    pending: 105,
    expiringAmount: 0,
    expiryDate: '',
    shopsyDays: 0,
    phoneDevice: '',
    phoneNumber: '8056...',
    gosatsStatus: 'Inactive',
    panHolder: '',
    notes: '8056.....45....maybe 105 later',
    history: [],
  },
  {
    id: 7,
    alias: '9956',
    balance: 150,
    pending: 0,
    expiringAmount: 0,
    expiryDate: '',
    shopsyDays: 0,
    phoneDevice: '',
    phoneNumber: '9956...',
    gosatsStatus: 'Inactive',
    panHolder: '',
    notes: '9956.......150',
    history: [],
  },
  {
    id: 8,
    alias: '8562921546',
    balance: 0,
    pending: 0,
    expiringAmount: 0,
    expiryDate: '',
    shopsyDays: 0,
    phoneDevice: '',
    phoneNumber: '8562921546',
    gosatsStatus: 'Inactive',
    panHolder: '',
    notes: '8562921546.....0',
    history: [],
  },
  {
    id: 9,
    alias: 'Papa',
    balance: 0,
    pending: 50,
    expiringAmount: 0,
    expiryDate: '',
    shopsyDays: 0,
    phoneDevice: '',
    phoneNumber: '',
    gosatsStatus: 'Inactive',
    panHolder: 'Papa',
    notes: '',
    history: [],
  },
  {
    id: 10,
    alias: 'BSNL',
    balance: 53,
    pending: 107,
    expiringAmount: 0,
    expiryDate: '',
    shopsyDays: 0,
    phoneDevice: 'BSNL SIM',
    phoneNumber: 'BSNL',
    gosatsStatus: 'Inactive',
    panHolder: '',
    notes: 'Bsnl .....53.....maybe 107',
    history: [],
  },
  {
    id: 11,
    alias: 'M2 Pro',
    balance: 76,
    pending: 0,
    expiringAmount: 0,
    expiryDate: '',
    shopsyDays: 0,
    phoneDevice: 'M2 Pro',
    phoneNumber: '',
    gosatsStatus: 'Inactive',
    panHolder: '',
    notes: 'M2 Pro.....76',
    history: [],
  },
];

let dbPromise = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
        db.createObjectStore(STORE_ACCOUNTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
    };
  });
}

function getDb() {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

/* ------------------------------------------------------------------ */
/* Accounts                                                           */
/* ------------------------------------------------------------------ */

/** Load every account from the device. */
export function loadAccounts() {
  return getDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ACCOUNTS, 'readonly');
        const store = tx.objectStore(STORE_ACCOUNTS);
        const out = [];
        const cursor = store.openCursor();
        cursor.onsuccess = (e) => {
          const c = e.target.result;
          if (c) {
            out.push(c.value);
            c.continue();
          } else {
            resolve(out);
          }
        };
        tx.onerror = () => reject(tx.error);
      })
  );
}

/** Persist a single account. Resolves when written. */
export function saveAccount(account) {
  return getDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ACCOUNTS, 'readwrite');
        tx.objectStore(STORE_ACCOUNTS).put(normalize(account));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

/** Persist many accounts in one transaction. */
export function saveAll(accounts) {
  return getDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ACCOUNTS, 'readwrite');
        const store = tx.objectStore(STORE_ACCOUNTS);
        for (const a of accounts) store.put(normalize(a));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

/** Replace the whole account set (used by JSON restore). */
export function replaceAll(accounts) {
  return getDb().then((db) => {
    const txW = db.transaction(STORE_ACCOUNTS, 'readwrite');
    txW.objectStore(STORE_ACCOUNTS).clear();
    txW.oncomplete = () => {
      const tx = db.transaction(STORE_ACCOUNTS, 'readwrite');
      const store = tx.objectStore(STORE_ACCOUNTS);
      for (const a of accounts) store.put(normalize(a));
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    };
    return txW;
  });
}

/** Seed the 11 initial accounts ONLY if nothing is saved yet. */
export function seedIfEmpty() {
  return loadAccounts().then((existing) => {
    if (existing.length > 0) return existing;
    return saveAll(SEED_ACCOUNTS.map(clone)).then(() => SEED_ACCOUNTS.map(clone));
  });
}

function normalize(a) {
  return {
    id: a.id,
    alias: a.alias || '',
    balance: Number(a.balance) || 0,
    pending: Number(a.pending) || 0,
    expiringAmount: Number(a.expiringAmount) || 0,
    expiryDate: a.expiryDate || '',
    shopsyDays: Number(a.shopsyDays) || 0,
    phoneDevice: a.phoneDevice || '',
    phoneNumber: a.phoneNumber || '',
    gosatsStatus: a.gosatsStatus || 'Inactive',
    panHolder: a.panHolder || '',
    notes: a.notes || '',
    history: Array.isArray(a.history) ? a.history.map(clone) : [],
  };
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

/* ------------------------------------------------------------------ */
/* Meta (undo snapshot, settings)                                     */
/* ------------------------------------------------------------------ */

export function getMeta(id) {
  return getDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readonly');
        const req = tx.objectStore(STORE_META).get(id);
        req.onsuccess = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
      })
  );
}

export function setMeta(id, value) {
  return getDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readwrite');
        tx.objectStore(STORE_META).put({ id, ...value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

/** Export everything (accounts + meta) as a JSON-serializable object. */
export function exportBundle() {
  return Promise.all([loadAccounts(), getMeta('settings')]).then(
    ([accounts, settings]) => ({
      app: 'SuperCoin Vault',
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts,
      settings: settings || {},
    })
  );
}

/** Import a bundle, replacing all local data. */
export function importBundle(bundle) {
  if (!bundle || !Array.isArray(bundle.accounts)) {
    return Promise.reject(new Error('Invalid backup file'));
  }
  const accounts = bundle.accounts.map(normalize);
  return replaceAll(accounts).then(() => accounts);
}

export { SEED_ACCOUNTS };
