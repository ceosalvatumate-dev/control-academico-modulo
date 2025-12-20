import React, { useEffect, useMemo, useState } from "react";
import {
  HashRouter, Routes, Route, Navigate, Link, useLocation, useNavigate, useParams
} from "react-router-dom";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut
} from "firebase/auth";
import { 
  doc, getDoc, setDoc, collection, onSnapshot, deleteDoc, serverTimestamp, updateDoc 
} from "firebase/firestore";
import { 
  ref, getDownloadURL, uploadBytesResumable, deleteObject 
} from "firebase/storage";

// IMPORTAMOS DIRECTAMENTE DE FIREBASE.JS
import { auth, googleProvider, db, storage } from "./firebase";

// Iconos
import {
  Bell, BookOpen, ChevronRight, Upload, Folder, LayoutDashboard, LogOut,
  Search, Settings, Trash2, Download, Plus, X, FileText, Image as ImageIcon,
  Sigma, FlaskConical, Code2, Calculator, Braces, BrainCircuit, Share2,
  Eye, Paperclip, Link2, Check, ArrowUp, ArrowDown, Palette,
  LayoutGrid, List as ListIcon, RefreshCcw, FileSpreadsheet, Presentation,
  Menu, Star, Edit, StickyNote, HardDrive
} from "lucide-react";

// -------------------------
// TEMAS
// -------------------------
const THEMES = {
  blue: { 
    name: "Azul Clásico",
    bg: "bg-blue-600", hover: "hover:bg-blue-500", 
    text: "text-blue-400", border: "border-blue-500",
    light: "bg-blue-500/10", icon: "text-blue-300"
  },
  emerald: { 
    name: "Verde Finanzas",
    bg: "bg-emerald-600", hover: "hover:bg-emerald-500", 
    text: "text-emerald-400", border: "border-emerald-500",
    light: "bg-emerald-500/10", icon: "text-emerald-300"
  },
  violet: { 
    name: "Violeta Creativo",
    bg: "bg-violet-600", hover: "hover:bg-violet-500", 
    text: "text-violet-400", border: "border-violet-500",
    light: "bg-violet-500/10", icon: "text-violet-300"
  },
  orange: { 
    name: "Naranja Energía",
    bg: "bg-orange-600", hover: "hover:bg-orange-500", 
    text: "text-orange-400", border: "border-orange-500",
    light: "bg-orange-500/10", icon: "text-orange-300"
  },
};

// Normalizar texto para búsqueda
const normalize = (text) => text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

const ICON_MAP = {
  Folder: Folder, FileText: FileText, BookOpen: BookOpen, Sigma: Sigma,
  FlaskConical: FlaskConical, Code2: Code2, Calculator: Calculator,
  Braces: Braces, BrainCircuit: BrainCircuit, Paperclip: Paperclip
};

const DEFAULT_CATEGORIES = [
  { key: "tasks", label: "Tareas", iconKey: "Folder" },
  { key: "exams", label: "Exámenes", iconKey: "FileText" },
  { key: "books", label: "Libros", iconKey: "BookOpen" }
];

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// -------------------------
// LOGICA FIRESTORE
// -------------------------
async function getUserConfig(uid) {
  try {
    const refDoc = doc(db, "users", uid, "app", "config");
    const snap = await getDoc(refDoc);
    if (snap.exists()) return snap.data();
    return { academyName: "Mi Repositorio", logoUrl: "", themeColor: "blue", subjects: [], categories: [], viewMode: "list" };
  } catch (e) {
    console.error("Error config:", e);
    return { academyName: "Error", subjects: [] };
  }
}

async function saveUserConfig(uid, cfg) {
  const refDoc = doc(db, "users", uid, "app", "config");
  const cleanCfg = JSON.parse(JSON.stringify(cfg)); 
  await setDoc(refDoc, cleanCfg, { merge: true });
}

function listenUserFiles(uid, callback) {
  const colRef = collection(db, "users", uid, "files");
  return onSnapshot(colRef, (snapshot) => {
    const files = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
    callback(files);
  });
}

async function addUserFile(uid, fileMeta) {
  const refDoc = doc(db, "users", uid, "files", fileMeta.id);
  await setDoc(refDoc, { ...fileMeta, createdAt: serverTimestamp(), deletedAt: null, isFavorite: false, notes: "" });
}

async function updateUserFile(uid, fileId, updates) {
  const refDoc = doc(db, "users", uid, "files", fileId);
  await updateDoc(refDoc, updates);
}

async function softDeleteFile(uid, fileId) {
  const refDoc = doc(db, "users", uid, "files", fileId);
  await updateDoc(refDoc, { deletedAt: new Date().toISOString() });
}

async function restoreFile(uid, fileId) {
  const refDoc = doc(db, "users", uid, "files", fileId);
  await updateDoc(refDoc, { deletedAt: null });
}

async function permanentDeleteFile(uid, fileId) {
  const refDoc = doc(db, "users", uid, "files", fileId);
  await deleteDoc(refDoc);
}

// -------------------------
// LOGICA STORAGE
// -------------------------
function uploadFileWithProgress(file, folderPath, onProgress) {
  return new Promise((resolve, reject) => {
    if (!storage) return reject(new Error("Firebase Storage no inicializado."));
    const storageRef = ref(storage, `${folderPath}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on("state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => reject(error),
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
}

async function deleteFileFromStorage(url) {
  if (!url || !storage) return;
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch (error) {
    console.warn("Storage delete error:", error);
  }
}

// -------------------------
// APP & AUTH
// -------------------------
function RequireAuth({ children, user }) {
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-bold">Cargando Sistema...</div>;

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/app/*" element={<RequireAuth user={user}><Shell user={user} /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </HashRouter>
  );
}

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (fn) => {
    try { await fn(); nav("/app"); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
      <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-sm space-y-6 shadow-2xl border border-slate-700">
        <div className="text-center">
          <h2 className="text-2xl font-black mb-1">Acceso</h2>
          <p className="text-slate-400 text-sm">Repositorio Académico</p>
        </div>
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-sm p-3 rounded-lg">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(() => signInWithEmailAndPassword(auth, email, password)); }} className="space-y-4">
          <input type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 rounded-xl bg-slate-950/50 border border-slate-700 outline-none focus:border-blue-500 transition" />
          <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-xl bg-slate-950/50 border border-slate-700 outline-none focus:border-blue-500 transition" />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 p-3 rounded-xl font-bold transition">Entrar</button>
        </form>
        <div className="relative border-t border-slate-700 pt-4">
          <button onClick={() => handleLogin(() => signInWithPopup(auth, googleProvider))} className="w-full bg-white text-slate-900 hover:bg-slate-200 p-3 rounded-xl font-bold transition flex items-center justify-center gap-2">
            <span className="text-lg">G</span> Entrar con Google
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------
// SHELL & LAYOUT (RESPONSIVO)
// -------------------------
function Shell({ user }) {
  const [cfg, setCfg] = useState({ subjects: [], categories: DEFAULT_CATEGORIES, academyName: "Cargando...", themeColor: "blue", logoUrl: "", viewMode: "list" });
  const [meta, setMeta] = useState([]);
  const [query, setQuery] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [editFile, setEditFile] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user?.uid) getUserConfig(user.uid).then(c => setCfg({ ...c, categories: c.categories || DEFAULT_CATEGORIES, themeColor: c.themeColor || "blue", viewMode: c.viewMode || "list" }));
  }, [user]);

  useEffect(() => { if (user?.uid) return listenUserFiles(user.uid, setMeta); }, [user]);

  const onLogout = async () => { await signOut(auth); window.location.hash = "#/login"; };

  const handleUpdateFile = async (id, updates) => { if(user?.uid) await updateUserFile(user.uid, id, updates); };
  const handleSoftDelete = async (f) => { if(user?.uid) await softDeleteFile(user.uid, f.id); };
  const handleRestore = async (f) => { if(user?.uid) await restoreFile(user.uid, f.id); };
  const handlePermanentDelete = async (f) => {
    if(!user?.uid) return;
    if(window.confirm("¿Eliminar definitivamente?")) {
      await deleteUserFile(user.uid, f.id);
      if(f.downloadURL) await deleteFileFromStorage(f.downloadURL);
    }
  };

  const toggleViewMode = async () => {
    const nextMode = cfg.viewMode === "list" ? "grid" : "list";
    const nextCfg = { ...cfg, viewMode: nextMode };
    setCfg(nextCfg);
    if(user?.uid) await saveUserConfig(user.uid, nextCfg);
  };

  const theme = THEMES[cfg.themeColor] || THEMES.blue;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-blue-500/30">
      <div className="flex h-screen overflow-hidden">
        {/* SIDEBAR DESKTOP & MOBILE */}
        <Sidebar 
          cfg={cfg} theme={theme} meta={meta}
          mobileOpen={mobileMenuOpen} closeMobile={() => setMobileMenuOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
          <Topbar 
            academyName={cfg.academyName} query={query} setQuery={setQuery} onLogout={onLogout} theme={theme} 
            openMobileMenu={() => setMobileMenuOpen(true)}
          />
          
          <div className="p-4 md:p-8 flex-1 overflow-y-auto pb-20">
            <Routes>
              <Route index element={<Dashboard cfg={cfg} meta={meta} theme={theme} />} />
              <Route path="subject/:id" element={
                <Subject 
                  user={user} cfg={cfg} meta={meta} query={query} 
                  onDelete={handleSoftDelete} onPreview={setPreviewFile} onEdit={setEditFile} onUpdate={handleUpdateFile}
                  theme={theme} viewMode={cfg.viewMode} toggleView={toggleViewMode}
                />
              } />
              <Route path="archives" element={
                <Archives 
                  cfg={cfg} meta={meta} query={query} 
                  onDelete={handleSoftDelete} onPreview={setPreviewFile} onEdit={setEditFile} onUpdate={handleUpdateFile}
                  theme={theme} viewMode={cfg.viewMode} toggleView={toggleViewMode}
                />
              } />
              <Route path="favorites" element={
                <FavoritesPage 
                  meta={meta} query={query} theme={theme}
                  onDelete={handleSoftDelete} onPreview={setPreviewFile} onEdit={setEditFile} onUpdate={handleUpdateFile}
                />
              } />
              <Route path="trash" element={
                <TrashPage meta={meta} query={query} theme={theme} onRestore={handleRestore} onPermanentDelete={handlePermanentDelete} />
              } />
              <Route path="settings" element={<SettingsPage user={user} cfg={cfg} setCfg={setCfg} theme={theme} />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </div>
        </div>
      </div>
      
      {/* Modales */}
      {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} theme={theme} />}
      {editFile && <EditFileModal file={editFile} cfg={cfg} onClose={() => setEditFile(null)} onSave={async (updates) => { await handleUpdateFile(editFile.id, updates); setEditFile(null); }} theme={theme} />}
    </div>
  );
}

function Sidebar({ cfg, theme, meta, mobileOpen, closeMobile }) {
  const subjects = cfg.subjects || [];
  const loc = useLocation();
  const isActive = (path) => loc.pathname === path;

  // Calculo de almacenamiento (simulado 5GB)
  const usedBytes = meta.reduce((acc, f) => acc + (f.size || 0), 0);
  const maxBytes = 5*1024 * 1024 * 1024; // 5GB
  const percentUsed = Math.min((usedBytes / maxBytes) * 100, 100);

  const sidebarClasses = `
    fixed inset-y-0 left-0 z-50 w-[280px] bg-slate-950 border-r border-slate-800 flex flex-col transition-transform duration-300
    md:translate-x-0 md:static
    ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
  `;

  return (
    <>
      {/* Backdrop movil */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/80 md:hidden" onClick={closeMobile}></div>}

      <aside className={sidebarClasses}>
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          {cfg.logoUrl ? (
            <img src={cfg.logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded-xl bg-white/10" />
          ) : (
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg bg-slate-800"><BookOpen className="text-white" size={20} /></div>
          )}
          <div className="min-w-0">
            <div className="font-bold truncate">{cfg.academyName}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Admin Panel</div>
          </div>
          <button className="md:hidden ml-auto text-slate-400" onClick={closeMobile}><X /></button>
        </div>

        <nav className="flex-1 p-4 space-y-8 overflow-y-auto">
          <NavGroup label="Principal">
            <NavItem to="/app" icon={LayoutDashboard} label="Dashboard" active={isActive("/app")} theme={theme} onClick={closeMobile} />
            <NavItem to="/app/favorites" icon={Star} label="Favoritos" active={isActive("/app/favorites")} theme={theme} onClick={closeMobile} />
          </NavGroup>
          <NavGroup label="Cursos">
            {subjects.map((s) => (
              <NavItem key={s.id} to={`/app/subject/${s.id}`} icon={ICON_MAP[s.iconKey] || BookOpen} label={s.name} active={loc.pathname === `/app/subject/${s.id}`} theme={theme} onClick={closeMobile} />
            ))}
            {subjects.length === 0 && <div className="px-4 text-xs text-slate-600 italic">Sin cursos.</div>}
          </NavGroup>
          <NavGroup label="Gestión">
            <NavItem to="/app/archives" icon={Folder} label="Archivos" active={isActive("/app/archives")} theme={theme} onClick={closeMobile} />
            <NavItem to="/app/trash" icon={Trash2} label="Papelera" active={isActive("/app/trash")} theme={theme} onClick={closeMobile} />
            <NavItem to="/app/settings" icon={Settings} label="Ajustes" active={isActive("/app/settings")} theme={theme} onClick={closeMobile} />
          </NavGroup>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-4">
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
             <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
               <div className="flex items-center gap-1"><HardDrive size={12}/> Almacenamiento</div>
               <div>{Math.round(percentUsed)}%</div>
             </div>
             <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
               <div className={`h-full ${theme.bg}`} style={{ width: `${percentUsed}%` }}></div>
             </div>
             <div className="text-[10px] text-slate-500 mt-1 text-right">{formatBytes(usedBytes)} / 5 GB</div>
          </div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ query, setQuery, onLogout, theme, openMobileMenu }) {
  return (
    <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 md:px-6 py-4 flex items-center gap-4">
      <button onClick={openMobileMenu} className="md:hidden p-2 text-slate-400 hover:text-white"><Menu /></button>
      
      <div className="flex-1 max-w-xl relative group">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 transition group-focus-within:${theme.text}`} size={16} />
        <input 
          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:bg-slate-900 transition text-sm text-slate-200 placeholder:text-slate-600 focus:border-slate-700"
          placeholder="Buscar..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="hidden md:flex items-center gap-2 ml-auto">
        <button onClick={onLogout} className="h-10 px-4 rounded-xl border border-slate-800 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-300 transition flex items-center gap-2 text-sm font-bold text-slate-400">
          <LogOut size={16} /> Salir
        </button>
      </div>
    </div>
  );
}

function Dashboard({ cfg, meta, theme }) {
  const activeFiles = meta.filter(m => !m.deletedAt);
  const trashFiles = meta.filter(m => m.deletedAt);
  const favFiles = activeFiles.filter(m => m.isFavorite);

  return (
    <div className="space-y-8 animate-fade-in">
      <header><h1 className="text-3xl font-black tracking-tight">Panel de Control</h1></header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <DashCard label="Favoritos" value={favFiles.length} icon={Star} color="text-yellow-400" bg="bg-yellow-500/10" border="border-yellow-500/20" />
        <DashCard label="Activos" value={activeFiles.length} icon={Folder} color={theme.text} bg={theme.light} border={theme.border} />
        <DashCard label="Papelera" value={trashFiles.length} icon={Trash2} color="text-red-400" bg="bg-red-500/10" border="border-red-500/20" />
        <DashCard label="Reciente" value={activeFiles[0] ? new Date(activeFiles[0].uploadedAt).toLocaleDateString() : "—"} icon={Upload} color="text-slate-400" bg="bg-slate-800" border="border-slate-700" />
      </div>
    </div>
  );
}

function Subject({ user, cfg, meta, query, onDelete, onPreview, onEdit, onUpdate, theme, viewMode, toggleView }) {
  const { id } = useParams();
  const subject = (cfg.subjects || []).find((s) => s.id === id);
  const categories = cfg.categories && cfg.categories.length > 0 ? cfg.categories : DEFAULT_CATEGORIES;
  const [activeTab, setActiveTab] = useState(categories[0]?.key || "general");
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => { if (categories[0]) setActiveTab(categories[0].key); }, [id, categories]);

  if (!subject) return <div className="p-8 text-center text-slate-500">Materia no encontrada.</div>;

  const filtered = useMemo(() => {
    const q = normalize(query);
    return meta
      .filter(m => !m.deletedAt)
      .filter(m => m.subjectId === subject.id && m.category === activeTab)
      .filter(m => {
        if (!q) return true;
        return normalize(m.name).includes(q) || (m.tags && m.tags.some(t => normalize(t).includes(q)));
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }, [meta, subject.id, activeTab, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1"><Link to="/app" className="hover:text-white">Panel</Link> <ChevronRight size={14} /> <span>{subject.name}</span></div>
          <h1 className="text-2xl md:text-3xl font-black">{subject.name}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleView} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition">{viewMode === "grid" ? <ListIcon size={20}/> : <LayoutGrid size={20}/>}</button>
          <button onClick={() => setUploadOpen(true)} className={`px-5 py-3 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-lg ${theme.bg} ${theme.hover}`}><Plus size={20} /> <span className="hidden sm:inline">Subir</span></button>
        </div>
      </div>

      <div className="border-b border-slate-800 flex overflow-x-auto gap-1 hide-scrollbar">
        {categories.map((cat) => {
          const isActive = activeTab === cat.key;
          const Icon = ICON_MAP[cat.iconKey] || Folder;
          return (
            <button key={cat.key} onClick={() => setActiveTab(cat.key)} className={`flex items-center gap-2 px-4 py-3 border-b-2 transition whitespace-nowrap text-sm font-bold ${isActive ? `${theme.border} ${theme.text}` : "border-transparent text-slate-400 hover:text-slate-200"}`}>
              <Icon size={16} /> {cat.label}
            </button>
          );
        })}
      </div>

      <FileList files={filtered} viewMode={viewMode} onDelete={onDelete} onPreview={onPreview} onEdit={onEdit} onUpdate={onUpdate} theme={theme} />
      
      {uploadOpen && (
        <UploadModal
          subject={subject} category={activeTab} categoryLabel={categories.find(c => c.key === activeTab)?.label} onClose={() => setUploadOpen(false)} theme={theme}
          onSuccess={async (file, tags) => {
             await addUserFile(user.uid, {
                id: uid("file"), subjectId: subject.id, category: activeTab,
                name: file.name, size: file.size, mime: file.type, tags,
                uploadedAt: new Date().toISOString(), downloadURL: file.downloadURL, ownerUid: user.uid
             });
             setUploadOpen(false);
          }}
        />
      )}
    </div>
  );
}

// -------------------------
// VISTAS ADICIONALES
// -------------------------
function FavoritesPage({ meta, query, theme, onDelete, onPreview, onEdit, onUpdate }) {
  const filtered = useMemo(() => {
    const q = normalize(query);
    return meta.filter(m => !m.deletedAt && m.isFavorite && (normalize(m.name).includes(q)));
  }, [meta, query]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black text-yellow-500 flex items-center gap-3"><Star className="fill-yellow-500 text-yellow-500" /> Favoritos</h1>
      <FileList files={filtered} viewMode="list" onDelete={onDelete} onPreview={onPreview} onEdit={onEdit} onUpdate={onUpdate} theme={theme} />
    </div>
  );
}

function Archives({ cfg, meta, query, onDelete, onPreview, onEdit, onUpdate, theme, viewMode, toggleView }) {
  const filtered = useMemo(() => {
    const q = normalize(query);
    return meta.filter(m => !m.deletedAt && (normalize(m.name).includes(q))).sort((a,b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }, [meta, query]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">Todos los Archivos</h1>
        <button onClick={toggleView} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition">{viewMode === "grid" ? <ListIcon size={20}/> : <LayoutGrid size={20}/>}</button>
      </div>
      <FileList files={filtered} viewMode={viewMode} onDelete={onDelete} onPreview={onPreview} onEdit={onEdit} onUpdate={onUpdate} theme={theme} />
    </div>
  );
}

function TrashPage({ meta, query, onRestore, onPermanentDelete }) {
  const filtered = useMemo(() => {
    const q = normalize(query);
    return meta.filter(m => m.deletedAt && normalize(m.name).includes(q)).sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  }, [meta, query]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black text-red-400">Papelera</h1>
      <div className="space-y-3">
        {filtered.map(f => (
          <div key={f.id} className="group flex items-center justify-between p-4 bg-red-900/10 border border-red-900/30 rounded-2xl">
             <div className="flex items-center gap-4 min-w-0">
               <div className="h-12 w-12 rounded-xl bg-red-900/20 flex items-center justify-center shrink-0"><Trash2 size={20} className="text-red-400" /></div>
               <div className="min-w-0">
                 <div className="font-bold text-slate-200 truncate line-through opacity-70">{f.name}</div>
                 <div className="text-xs text-red-300/60">Eliminado: {new Date(f.deletedAt).toLocaleDateString()}</div>
               </div>
             </div>
             <div className="flex items-center gap-2">
               <button onClick={() => onRestore(f)} className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold text-xs hover:bg-emerald-500/20 flex gap-2"><RefreshCcw size={14}/> Restaurar</button>
               <button onClick={() => onPermanentDelete(f)} className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 font-bold text-xs hover:bg-red-500/20 flex gap-2"><X size={14}/> Borrar</button>
             </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-3xl">Papelera vacía.</div>}
      </div>
    </div>
  );
}

// -------------------------
// COMPONENTES REUTILIZABLES
// -------------------------
function FileList({ files, viewMode, onDelete, onPreview, onEdit, onUpdate, theme }) {
  if (files.length === 0) return <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-3xl bg-slate-900/20">Carpeta vacía</div>;
  
  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {files.map(f => <FileCard key={f.id} file={f} onDelete={() => onDelete(f)} onPreview={() => onPreview(f)} onEdit={() => onEdit(f)} onUpdate={onUpdate} theme={theme} />)}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {files.map(f => <FileRow key={f.id} file={f} onDelete={() => onDelete(f)} onPreview={() => onPreview(f)} onEdit={() => onEdit(f)} onUpdate={onUpdate} theme={theme} />)}
    </div>
  );
}

function getFileIcon(mime) {
  if (mime?.startsWith("image/")) return ImageIcon;
  if (mime?.includes("pdf")) return FileText;
  if (mime?.includes("spreadsheet") || mime?.includes("excel")) return FileSpreadsheet;
  if (mime?.includes("presentation") || mime?.includes("powerpoint")) return Presentation;
  return FileText;
}

function FileRow({ file, onDelete, onPreview, onEdit, onUpdate, theme }) {
  const [copied, setCopied] = useState(false);
  const Icon = getFileIcon(file.mime);

  const toggleFav = (e) => { e.stopPropagation(); onUpdate(file.id, { isFavorite: !file.isFavorite }); };
  const shareWhatsApp = () => { window.open(`https://wa.me/?text=${encodeURIComponent(`Archivo "${file.name}": ${file.downloadURL}`)}`, "_blank"); };
  const copyLink = async () => { try { await navigator.clipboard.writeText(file.downloadURL); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (err) {} };

  return (
    <div className="group flex items-center justify-between p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl hover:border-slate-700 hover:bg-slate-900/80 transition-all">
      <div className="flex items-center gap-4 min-w-0">
        <div onClick={onPreview} className="h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-700 transition">
          <Icon size={20} className={theme.text} />
        </div>
        <div className="min-w-0">
          <div onClick={onPreview} className={`font-bold text-slate-200 truncate cursor-pointer hover:${theme.text} transition`}>
            {file.name}
            {file.notes && <StickyNote size={12} className="inline ml-2 text-yellow-500" />}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span>{formatBytes(file.size)}</span> • <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button onClick={toggleFav} className={`p-2 rounded-lg hover:bg-slate-800 transition ${file.isFavorite ? "text-yellow-400" : "text-slate-600"}`}><Star size={18} fill={file.isFavorite ? "currentColor" : "none"} /></button>
        <button onClick={onEdit} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"><Edit size={18} /></button>
        <div className="hidden md:flex gap-2">
          <button onClick={copyLink} className={`p-2 rounded-lg ${theme.light} ${theme.text} hover:opacity-80`}>{copied ? <Check size={18} /> : <Link2 size={18} />}</button>
          <button onClick={shareWhatsApp} className="p-2 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20"><Share2 size={18} /></button>
          <button onClick={() => window.confirm("¿Mover a papelera?") && onDelete()} className="p-2 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400"><Trash2 size={18} /></button>
        </div>
      </div>
    </div>
  );
}

function FileCard({ file, onDelete, onPreview, onEdit, onUpdate, theme }) {
  const Icon = getFileIcon(file.mime);
  const isImg = file.mime?.startsWith("image/");
  const toggleFav = (e) => { e.stopPropagation(); onUpdate(file.id, { isFavorite: !file.isFavorite }); };

  return (
    <div className="group relative aspect-square bg-slate-900/40 border border-slate-800/50 rounded-3xl hover:border-slate-700 hover:bg-slate-900/80 transition-all flex flex-col items-center justify-center p-4 text-center cursor-pointer" onClick={onPreview}>
       {isImg ? (
         <img src={file.downloadURL} alt="" className="h-16 w-16 object-cover rounded-xl mb-3 opacity-80 group-hover:opacity-100 transition" />
       ) : (
         <Icon size={48} className={`${theme.text} mb-3 opacity-80 group-hover:opacity-100 transition`} />
       )}
       <div className="font-bold text-sm text-slate-200 line-clamp-2">{file.name}</div>
       {file.notes && <div className="absolute top-3 left-3 text-yellow-500"><StickyNote size={14} /></div>}
       
       <button onClick={toggleFav} className={`absolute top-3 right-3 p-1.5 rounded-full bg-slate-950 shadow-lg ${file.isFavorite ? "text-yellow-400" : "text-slate-600 opacity-0 group-hover:opacity-100"}`}>
         <Star size={14} fill={file.isFavorite ? "currentColor" : "none"} />
       </button>
       
       <div className="absolute bottom-3 flex gap-2 opacity-0 group-hover:opacity-100 transition">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 bg-slate-950 rounded-full text-slate-400 hover:text-white shadow-lg"><Edit size={14}/></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 bg-slate-950 rounded-full text-red-400 hover:text-red-500 shadow-lg"><Trash2 size={14}/></button>
       </div>
    </div>
  );
}

// -------------------------
// MODALES
// -------------------------
function EditFileModal({ file, cfg, onClose, onSave, theme }) {
  const [name, setName] = useState(file.name);
  const [category, setCategory] = useState(file.category);
  const [subjectId, setSubjectId] = useState(file.subjectId);
  const [notes, setNotes] = useState(file.notes || "");
  
  const subjects = cfg.subjects || [];
  const categories = cfg.categories || DEFAULT_CATEGORIES;

  const handleSave = () => {
    onSave({ name, category, subjectId, notes });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h3 className="text-xl font-bold">Editar Archivo</h3>
        
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Nombre</label>
          <input className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mt-1 outline-none focus:border-slate-600" value={name} onChange={e => setName(e.target.value)} />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
           <div>
             <label className="text-xs font-bold text-slate-500 uppercase">Materia</label>
             <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mt-1 outline-none" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
               {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
           </div>
           <div>
             <label className="text-xs font-bold text-slate-500 uppercase">Carpeta</label>
             <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mt-1 outline-none" value={category} onChange={e => setCategory(e.target.value)}>
               {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
             </select>
           </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Notas Privadas</label>
          <textarea className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mt-1 outline-none focus:border-slate-600 text-sm h-24 resize-none" placeholder="Escribe notas que solo tú verás..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-800 transition">Cancelar</button>
          <button onClick={handleSave} className={`flex-1 py-3 rounded-xl font-bold text-white ${theme.bg} ${theme.hover} transition`}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ file, onClose, theme }) {
  const isImg = file.mime?.startsWith("image/");
  const isPdf = file.mime?.includes("pdf");
  const name = file.name.toLowerCase();
  const isOffice = name.endsWith(".docx") || name.endsWith(".doc") || name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".pptx") || name.endsWith(".ppt");
  const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(file.downloadURL)}&embedded=true`;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-fade-in">
      <div className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shrink-0">
        <div className="font-bold text-white truncate max-w-lg">{file.name}</div>
        <div className="flex gap-4">
           <a href={file.downloadURL} target="_blank" rel="noreferrer" className={`flex items-center gap-2 text-sm font-bold ${theme.text} hover:underline`}><Download size={16}/> Descargar</a>
           <button onClick={onClose} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white"><X size={20}/></button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-slate-900 flex items-center justify-center relative">
        {isImg && <img src={file.downloadURL} alt="preview" className="max-h-full max-w-full object-contain" />}
        {isPdf && <iframe src={file.downloadURL} className="w-full h-full border-0" title="PDF"></iframe>}
        {isOffice && <iframe src={googleDocsUrl} className="w-full h-full border-0" title="Office"></iframe>}
        {!isImg && !isPdf && !isOffice && <div className="text-center"><FileText size={64} className="mx-auto text-slate-600 mb-4" /><p className="text-slate-400">Vista previa no disponible.</p></div>}
      </div>
    </div>
  );
}

function UploadModal({ subject, category, categoryLabel, onClose, onSuccess, theme }) {
  const [file, setFile] = useState(null);
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const startUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFileWithProgress(file, `users/${subject.id}/${category}`, (pct) => setProgress(Math.round(pct)));
      file.downloadURL = url;
      await onSuccess(file, tags.split(",").map(t => t.trim()).filter(Boolean));
    } catch (e) { alert("Error: " + e.message); setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
        <h3 className="font-bold text-white text-lg">Subir Archivo a {subject.name}</h3>
        <div className="relative border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center hover:border-slate-500 transition-colors">
            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setFile(e.target.files[0])} disabled={uploading} />
            {file ? <div className="text-blue-400 font-bold">{file.name}</div> : <div className="text-slate-400">Clic o arrastra archivo aquí</div>}
        </div>
        <input className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm" placeholder="Etiquetas..." value={tags} onChange={e => setTags(e.target.value)} disabled={uploading} />
        {uploading && <div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${theme.bg}`} style={{ width: `${progress}%` }}></div></div>}
        <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button>
            <button onClick={startUpload} disabled={!file || uploading} className={`flex-1 py-3 rounded-xl font-bold text-white ${theme.bg}`}>Subir</button>
        </div>
      </div>
    </div>
  );
}

// -------------------------
// SETTINGS PAGE (LOGICA COMPLETA)
// -------------------------
function SettingsPage({ user, cfg, setCfg, theme }) {
  const [activeTab, setActiveTab] = useState("general");
  const [academyName, setAcademyName] = useState(cfg.academyName || "");
  const [logoUrl, setLogoUrl] = useState(cfg.logoUrl || "");
  const [themeColor, setThemeColor] = useState(cfg.themeColor || "blue");
  
  const [subjects, setSubjects] = useState(cfg.subjects || []);
  const [categories, setCategories] = useState(cfg.categories || DEFAULT_CATEGORIES);
  const [newSubj, setNewSubj] = useState({ name: "", icon: "BookOpen" });
  const [newCat, setNewCat] = useState({ label: "", icon: "Folder" });
  const iconOptions = Object.keys(ICON_MAP);

  useEffect(() => {
    setAcademyName(cfg.academyName || "");
    setLogoUrl(cfg.logoUrl || "");
    setThemeColor(cfg.themeColor || "blue");
    setSubjects(cfg.subjects || []);
    setCategories(cfg.categories || DEFAULT_CATEGORIES);
  }, [cfg]);

  const saveAll = async () => {
    const next = { ...cfg, academyName, logoUrl, themeColor, subjects, categories };
    await saveUserConfig(user.uid, next);
    setCfg(next);
    alert("Configuración guardada");
  };

  const handleAddSubject = () => {
     if(!newSubj.name) return;
     setSubjects([...subjects, { id: uid("subj"), name: newSubj.name, iconKey: newSubj.icon }]);
     setNewSubj({ name: "", icon: "BookOpen" });
  };

  const handleAddCategory = () => {
    if(!newCat.label) return;
    setCategories([...categories, { key: uid("cat"), label: newCat.label, iconKey: newCat.icon }]);
    setNewCat({ label: "", icon: "Folder" });
  };

  const moveItem = (index, direction, list, setList) => {
    const newList = [...list];
    if (direction === "up") {
      if (index === 0) return;
      [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    } else {
      if (index === newList.length - 1) return;
      [newList[index + 1], newList[index]] = [newList[index], newList[index + 1]];
    }
    setList(newList);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">Configuración</h1>
        <button onClick={saveAll} className="bg-white text-slate-900 px-6 py-2 rounded-xl font-bold hover:bg-slate-200 transition">Guardar Cambios</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-2">
           {["general", "subjects", "categories"].map(k => (
             <button key={k} onClick={() => setActiveTab(k)} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition ${activeTab === k ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"}`}>{k.toUpperCase()}</button>
           ))}
        </div>
        <div className="md:col-span-3 space-y-8">
          
          {activeTab === "general" && (
            <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-6">
              <div>
                <h3 className="font-bold text-xl mb-4">Marca y Perfil</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Nombre Organización</label>
                    <input className="w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-slate-500" value={academyName} onChange={e => setAcademyName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">URL del Logo (Opcional)</label>
                    <input placeholder="https://..." className="w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-slate-500 text-sm" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
                    <p className="text-xs text-slate-600 mt-2">Pega el link de tu logo. Aparecerá en el menú lateral.</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-xl mb-4">Color de Tema</h3>
                <div className="flex gap-4">
                  {Object.keys(THEMES).map(k => (
                    <button 
                      key={k} 
                      onClick={() => setThemeColor(k)}
                      className={`h-10 w-10 rounded-full border-2 flex items-center justify-center transition ${THEMES[k].bg} ${themeColor === k ? "border-white scale-110" : "border-transparent opacity-50 hover:opacity-100"}`}
                      title={THEMES[k].name}
                    >
                      {themeColor === k && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === "subjects" && (
            <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
              <h3 className="font-bold text-xl mb-4">Materias (Menú Lateral)</h3>
              <div className="flex gap-2 mb-6 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <input placeholder="Nueva materia..." className="w-full bg-transparent outline-none text-sm" value={newSubj.name} onChange={e => setNewSubj({...newSubj, name: e.target.value})} />
                <select className="bg-slate-900 text-xs border border-slate-700 rounded-lg outline-none px-2" value={newSubj.icon} onChange={e => setNewSubj({...newSubj, icon: e.target.value})}>{iconOptions.map(i => <option key={i} value={i}>{i}</option>)}</select>
                <button onClick={handleAddSubject} className={`px-3 py-1 rounded-lg font-bold text-xs text-white ${theme.bg}`}>Agregar</button>
              </div>
              <div className="space-y-2">
                {subjects.map((s, idx) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="font-bold">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => moveItem(idx, "up", subjects, setSubjects)} disabled={idx === 0} className="p-1 text-slate-500 hover:text-white disabled:opacity-30"><ArrowUp size={16}/></button>
                      <button onClick={() => moveItem(idx, "down", subjects, setSubjects)} disabled={idx === subjects.length - 1} className="p-1 text-slate-500 hover:text-white disabled:opacity-30"><ArrowDown size={16}/></button>
                      <div className="w-px h-4 bg-slate-800 mx-1"></div>
                      <button onClick={() => setSubjects(subjects.filter(x => x.id !== s.id))} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "categories" && (
             <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
               <h3 className="font-bold text-xl mb-4">Carpetas (Pestañas)</h3>
               <div className="flex gap-2 mb-6 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <input placeholder="Nueva carpeta..." className="w-full bg-transparent outline-none text-sm" value={newCat.label} onChange={e => setNewCat({...newCat, label: e.target.value})} />
                <select className="bg-slate-900 text-xs border border-slate-700 rounded-lg outline-none px-2" value={newCat.icon} onChange={e => setNewCat({...newCat, icon: e.target.value})}>{iconOptions.map(i => <option key={i} value={i}>{i}</option>)}</select>
                <button onClick={handleAddCategory} className={`px-3 py-1 rounded-lg font-bold text-xs text-white ${theme.bg}`}>Agregar</button>
              </div>
              <div className="space-y-2">
                {categories.map((c, idx) => (
                  <div key={c.key} className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="font-medium">{c.label}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => moveItem(idx, "up", categories, setCategories)} disabled={idx === 0} className="p-1 text-slate-500 hover:text-white disabled:opacity-30"><ArrowUp size={16}/></button>
                      <button onClick={() => moveItem(idx, "down", categories, setCategories)} disabled={idx === categories.length - 1} className="p-1 text-slate-500 hover:text-white disabled:opacity-30"><ArrowDown size={16}/></button>
                      <div className="w-px h-4 bg-slate-800 mx-1"></div>
                      <button onClick={() => setCategories(categories.filter(x => x.key !== c.key))} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
             </section>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------
// COMPONENTES AUXILIARES
// -------------------------
function NavGroup({ label, children }) {
  return <div><div className="text-[10px] uppercase tracking-widest text-slate-500 px-4 mb-2 font-bold">{label}</div><div className="space-y-1">{children}</div></div>;
}
function NavItem({ to, icon: Icon, label, active, theme, onClick }) {
  return <Link to={to} onClick={onClick} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-medium ${active ? `${theme.light} ${theme.text}` : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"}`}><Icon size={18} className={active ? theme.text : "text-slate-500"} /><span className="truncate">{label}</span></Link>;
}
function DashCard({ label, value, icon: Icon, color, bg, border }) {
  return <div className={`p-6 rounded-2xl border flex items-center gap-4 ${border || "border-slate-800"}`}><div className={`h-12 w-12 rounded-xl flex items-center justify-center ${bg} ${color}`}><Icon size={24} /></div><div><div className="text-2xl font-black">{value}</div><div className="text-xs uppercase tracking-wider opacity-70 font-bold">{label}</div></div></div>;
}
