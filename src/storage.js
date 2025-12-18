// src/storage.js  ✅ (ESM)
// LocalStorage (config/meta/session) + IndexedDB (files)

const LS_PREFIX = "academicHub:";
const LS_KEYS = {
  config: `${LS_PREFIX}config`,
  meta: `${LS_PREFIX}meta`,
  session: `${LS_PREFIX}session`,
};

export const defaultConfig = {
  academyName: "Academia Salva tu Mate",
  logoUrl: "",
  admin: { email: "admin@academia.com", password: "admin123" },
  subjects: [
    { id: "algebra", name: "Álgebra" },
    { id: "geo-trigo", name: "Geo. y Trigonometría" },
    { id: "geo-analitica", name: "Geometría Analítica" },
    { id: "calculo-dif", name: "Cálculo Diferencial" },
  ],
};

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function todayISO() {
  return new Date().toISOString();
}

export function formatBytes(bytes = 0) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}

// --------------------
// CONFIG (localStorage)
// --------------------
export function loadConfig() {
  const raw = localStorage.getItem(LS_KEYS.config);
  const saved = raw ? safeParse(raw, null) : null;

  const cfg = {
    ...defaultConfig,
    ...(saved || {}),
    admin: { ...defaultConfig.admin, ...(saved?.admin || {}) },
    subjects: Array.isArray(saved?.subjects) ? saved.subjects : defaultConfig.subjects,
  };

  if (!cfg.academyName) cfg.academyName = defaultConfig.academyName;
  if (!cfg.admin?.email) cfg.admin.email = defaultConfig.admin.email;
  if (!cfg.admin?.password) cfg.admin.password = defaultConfig.admin.password;

  return cfg;
}

export function saveConfig(cfg) {
  localStorage.setItem(LS_KEYS.config, JSON.stringify(cfg));
  return cfg;
}

// --------------------
// META (localStorage)
// --------------------
export function loadMeta() {
  const raw = localStorage.getItem(LS_KEYS.meta);
  const meta = raw ? safeParse(raw, []) : [];
  return Array.isArray(meta) ? meta : [];
}

export function saveMeta(meta) {
  localStorage.setItem(LS_KEYS.meta, JSON.stringify(meta || []));
  return meta;
}

// --------------------
// SESSION (localStorage)
// --------------------
export function getSession() {
  const raw = localStorage.getItem(LS_KEYS.session);
  return raw ? safeParse(raw, null) : null;
}

export function setSession(session) {
  localStorage.setItem(LS_KEYS.session, JSON.stringify(session));
  return session;
}

export function clearSession() {
  localStorage.removeItem(LS_KEYS.session);
}

// --------------------
// IndexedDB (files)
// --------------------
const DB_NAME = "academicHubDB";
const DB_VERSION = 1;
const STORE_FILES = "files";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(key, value) {
  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, "readwrite");
      const store = tx.objectStore(STORE_FILES);
      const r = store.put(value, key);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}

export async function idbGet(key) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, "readonly");
      const store = tx.objectStore(STORE_FILES);
      const r = store.get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}

export async function idbDel(key) {
  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, "readwrite");
      const store = tx.objectStore(STORE_FILES);
      const r = store.delete(key);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}