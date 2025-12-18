// Local config -> localStorage
const CONFIG_KEY = "ahub_config_v1";
const META_KEY = "ahub_files_meta_v1";
const AUTH_KEY = "ahub_auth_v1";

// ---------- Helpers ----------
export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function formatBytes(bytes = 0) {
  const sizes = ["B", "KB", "MB", "GB"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < sizes.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export function todayISO() {
  return new Date().toISOString();
}

export function safeJSONParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

// ---------- Default Config ----------
export function defaultConfig() {
  return {
    academyName: "Academia Salva tu Mate",
    logoUrl: "",
    admin: {
      email: "admin@academia.com",
      password: "admin123" // SOLO TEMPORAL LOCAL
    },
    subjects: [
      { id: "algebra", name: "Álgebra", icon: "Sigma" },
      { id: "geo-trig", name: "Geo. y Trigonometría", icon: "Flask" },
      { id: "geo-analitica", name: "Geometría Analítica", icon: "Code" },
      { id: "calc-dif", name: "Cálculo Diferencial", icon: "Book" }
    ]
  };
}

export function loadConfig() {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) {
    const cfg = defaultConfig();
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    return cfg;
  }
  const cfg = safeJSONParse(raw, defaultConfig());
  // merge suave por si faltan llaves
  const def = defaultConfig();
  return { ...def, ...cfg, admin: { ...def.admin, ...(cfg.admin || {}) } };
}

export function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  return cfg;
}

// ---------- Auth (LOCAL) ----------
export function getSession() {
  return safeJSONParse(sessionStorage.getItem(AUTH_KEY), null);
}
export function setSession(session) {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
}
export function clearSession() {
  sessionStorage.removeItem(AUTH_KEY);
}

// ---------- Metadata de archivos (localStorage) ----------
export function loadMeta() {
  return safeJSONParse(localStorage.getItem(META_KEY), []);
}
export function saveMeta(list) {
  localStorage.setItem(META_KEY, JSON.stringify(list));
  return list;
}

// ---------- IndexedDB (Blobs) ----------
const DB_NAME = "ahub_db_v1";
const STORE = "files";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(key, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbDel(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
