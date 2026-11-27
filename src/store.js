// IndexedDB wrapper (browser only).
const DB_NAME = 'tripsplit';
const DB_VERSION = 1;
const DATA_STORES = ['groups', 'expenses', 'settlements'];

const reqP = (req) => new Promise((res, rej) => {
  req.onsuccess = () => res(req.result);
  req.onerror = () => rej(req.error);
});
const txDone = (tx) => new Promise((res, rej) => {
  tx.oncomplete = () => res();
  tx.onerror = () => rej(tx.error);
  tx.onabort = () => rej(tx.error || new Error('transaction aborted'));
});

let dbPromise = null;
export function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('groups', { keyPath: 'id' });
        db.createObjectStore('expenses', { keyPath: 'id' }).createIndex('groupId', 'groupId');
        db.createObjectStore('settlements', { keyPath: 'id' }).createIndex('groupId', 'groupId');
        db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
  }
  return dbPromise;
}

export async function getAll(storeName) {
  const db = await openDB();
  return reqP(db.transaction(storeName).objectStore(storeName).getAll());
}

export async function getByGroup(storeName, groupId) {
  const db = await openDB();
  return reqP(db.transaction(storeName).objectStore(storeName).index('groupId').getAll(groupId));
}

export async function put(storeName, obj) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(obj);
  await txDone(tx);
  return obj;
}

export async function del(storeName, id) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(id);
  await txDone(tx);
}

export async function deleteGroup(groupId) {
  const db = await openDB();
  const tx = db.transaction(DATA_STORES, 'readwrite');
  tx.objectStore('groups').delete(groupId);
  for (const name of ['expenses', 'settlements']) {
    const store = tx.objectStore(name);
    const cur = store.index('groupId').openKeyCursor(IDBKeyRange.only(groupId));
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) { store.delete(c.primaryKey); c.continue(); }
    };
  }
  await txDone(tx);
}

export async function replaceAll({ groups, expenses, settlements }) {
  const db = await openDB();
  const tx = db.transaction(DATA_STORES, 'readwrite');
  const data = { groups, expenses, settlements };
  for (const name of DATA_STORES) {
    const store = tx.objectStore(name);
    store.clear();
    for (const obj of data[name]) store.put(obj);
  }
  await txDone(tx);
}

export async function getMeta(key) {
  const db = await openDB();
  const row = await reqP(db.transaction('meta').objectStore('meta').get(key));
  return row ? row.value : null;
}

export async function setMeta(key, value) {
  const db = await openDB();
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').put({ key, value });
  await txDone(tx);
}

export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) return !!(await navigator.storage.persist());
  } catch { /* ignore */ }
  return false;
}
