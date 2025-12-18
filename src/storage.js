// src/storage.js
// Almacenamiento LOCAL (sin Firebase por ahora)
// - Configuración y materias: localStorage
// - Archivos (PDF/IMG): IndexedDB (permite blobs sin límite ridículo de localStorage)

const LS_PREFIX = "academicHub:";
const LS_KEYS = {
  config: `${LS_PREFIX}config`,
  subjects: `${LS_PREFIX}subjects`,
  activeSubjectId: `${LS_PREFIX}activeSubjectId`,
};

// ---------------------------
// LocalStorage helpers
// ---------------------------
function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function lsGet(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  return safeParse(raw, fallback);
}

export function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------------------------
// Config & Subjects (localStorage)
// ---------------------------
export function getConfig() {
  return lsGet(LS_KEYS.config, {
    academyName: "Academia Salva tu Mate",
    logoDataUrl: "", // opcional
  });
}

export function saveConfig(nextConfig) {
  lsSet(LS_KEYS.config, nextConfig);
  return nextConfig;
}

export function getSubjects() {
  return lsGet(LS_KEYS.subjects, [
    { id: "algebra", name: "Álgebra" },
    { id: "geo-trigo", name: "Geo. y Trigonometría" },
    { id: "geo-analitica", name: "Geometría Analítica" },
    { id: "calculo-dif", name: "Cálculo Diferencial" },
  ]);
}

export function saveSubjects(nextSubjects) {
  lsSet(LS_KEYS.subjects, nextSubjects);
  return nextSubjects;
}

export function getActiveSubjectId() {
  const subjects = getSubjects();
  const saved = localStorage.getItem(LS_KEYS.activeSubjectId);
  return saved || (subjects[0]?.id ?? "algebra");
}

export function setActiveSubjectId(subjectId) {
  localStorage.setItem(LS_KEYS.activeSubjectId, subjectId);
  return subjectId;
}

// ---------------------------
// IndexedDB for files
// ---------------------------
const DB_NAME = "academicHubDB";
const DB_VERSION = 1;
const STORE = "files";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("bySubject", "subjectId", { unique: false });
        store.createIndex("byCategory", "category", { unique: false });
        store.createIndex("byCreatedAt", "createdAt", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export const CATEGORIES = {
  tasks: "tareas",
  solutions: "soluciones",
  controlExams: "examenes_control",
  etsExams: "examenes_ets",
  reference: "libros_referencia",
  archives: "archivos",
  formats: "formatos",
};

// Guardar archivo (File) por materia y categoría
export async function uploadFile({ subjectId, category, file }) {
  const db = await openDB();
  const record = {
    id: uid(),
    subjectId,
    category,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    blob: file, // <- Guardamos el blob real
  };

  await new Promise((resolve, reject) => {
    const store = tx(db, "readwrite");
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  db.close();
  return record;
}

export async function deleteFile(fileId) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const store = tx(db, "readwrite");
    const req = store.delete(fileId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  db.close();
  return true;
}

export async function listFiles({ subjectId, category, query = "" } = {}) {
  const db = await openDB();
  const out = [];

  await new Promise((resolve, reject) => {
    const store = tx(db, "readonly");
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return resolve();

      const r = cursor.value;
      const matchSubject = subjectId ? r.subjectId === subjectId : true;
      const matchCategory = category ? r.category === category : true;
      const matchQuery = query
        ? (r.name || "").toLowerCase().includes(query.toLowerCase())
        : true;

      if (matchSubject && matchCategory && matchQuery) {
        out.push({
          ...r,
          // Para abrir/descargar:
          url: r.blob ? URL.createObjectURL(r.blob) : "",
        });
      }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });

  db.close();

  // recientes primero
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return out;
}

export async function getRecentFiles(limit = 10) {
  const files = await listFiles({});
  return files.slice(0, limit);
}

// Export default “por si acaso” tu App lo importa como default
const storage = {
  // config/subjects
  getConfig,
  saveConfig,
  getSubjects,
  saveSubjects,
  getActiveSubjectId,
  setActiveSubjectId,
  // files
  uploadFile,
  deleteFile,
  listFiles,
  getRecentFiles,
  CATEGORIES,
};

export default storage;