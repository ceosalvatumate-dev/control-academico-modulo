import React, { useEffect, useMemo, useState } from "react";
import {
  HashRouter, Routes, Route, Navigate, Link, useLocation, useNavigate, useParams
} from "react-router-dom";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut
} from "firebase/auth";
import { 
  doc, getDoc, setDoc, collection, onSnapshot, deleteDoc, serverTimestamp 
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
  Eye, Paperclip, Link2, Copy, ArrowUp, ArrowDown, Check, Palette
} from "lucide-react";

// -------------------------
// TEMAS DE COLOR (PERSONALIZACIÓN)
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

// -------------------------
// HELPERS GLOBALES
// -------------------------
// Normaliza texto para búsqueda (quita acentos y mayúsculas)
const normalize = (text) => {
  return text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
};

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
// LOGICA DE SERVICIOS
// -------------------------

// --- FIRESTORE ---
async function getUserConfig(uid) {
  try {
    const refDoc = doc(db, "users", uid, "app", "config");
    const snap = await getDoc(refDoc);
    if (snap.exists()) return snap.data();
    return { academyName: "Mi Repositorio", logoUrl: "", themeColor: "blue", subjects: [], categories: [] };
  } catch (e) {
    console.error("Error config:", e);
    return { academyName: "Error Carga", subjects: [] };
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
  }, (error) => {
    console.error("Error listening files:", error);
  });
}

async function addUserFile(uid, fileMeta) {
  const refDoc = doc(db, "users", uid, "files", fileMeta.id);
  await setDoc(refDoc, { ...fileMeta, createdAt: serverTimestamp() });
}

async function deleteUserFile(uid, fileId) {
  const refDoc = doc(db, "users", uid, "files", fileId);
  await deleteDoc(refDoc);
}

// --- STORAGE ---
function uploadFileWithProgress(file, folderPath, onProgress) {
  return new Promise((resolve, reject) => {
    if (!storage) {
      reject(new Error("Firebase Storage no está inicializado."));
      return;
    }
    const storageRef = ref(storage, `${folderPath}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
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
// COMPONENTES DE UI
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
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="bg-slate-800 p-8 rounded-2xl w-96 space-y-6 shadow-2xl border border-slate-700">
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

function Shell({ user }) {
  const [cfg, setCfg] = useState({ subjects: [], categories: DEFAULT_CATEGORIES, academyName: "Cargando...", themeColor: "blue", logoUrl: "" });
  const [meta, setMeta] = useState([]);
  const [query, setQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    if (user?.uid) getUserConfig(user.uid).then(c => setCfg({ 
      ...c, 
      categories: c.categories || DEFAULT_CATEGORIES,
      themeColor: c.themeColor || "blue" 
    }));
  }, [user]);

  useEffect(() => {
    if (user?.uid) return listenUserFiles(user.uid, setMeta);
  }, [user]);

  const onLogout = async () => { await signOut(auth); window.location.hash = "#/login"; };

  const handleDeleteFile = async (fileMeta) => {
    if (!user?.uid) return;
    try {
      await deleteUserFile(user.uid, fileMeta.id);
      if (fileMeta.downloadURL) await deleteFileFromStorage(fileMeta.downloadURL);
    } catch (e) { console.error(e); alert("Error al eliminar"); }
  };

  const theme = THEMES[cfg.themeColor] || THEMES.blue;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-blue-500/30">
      <div className="flex min-h-screen">
        <Sidebar cfg={cfg} theme={theme} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar academyName={cfg.academyName} query={query} setQuery={setQuery} notifOpen={notifOpen} setNotifOpen={setNotifOpen} onLogout={onLogout} theme={theme} />
          <div className="p-6 md:p-8 flex-1 overflow-y-auto">
            <Routes>
              <Route index element={<Dashboard cfg={cfg} meta={meta} theme={theme} />} />
              <Route path="subject/:id" element={<Subject user={user} cfg={cfg} meta={meta} query={query} onDeleteFile={handleDeleteFile} onPreview={setPreviewFile} theme={theme} />} />
              <Route path="archives" element={<Archives cfg={cfg} meta={meta} query={query} onDeleteFile={handleDeleteFile} onPreview={setPreviewFile} theme={theme} />} />
              <Route path="settings" element={<SettingsPage user={user} cfg={cfg} setCfg={setCfg} theme={theme} />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </div>
        </div>
      </div>
      {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} theme={theme} />}
    </div>
  );
}

function Sidebar({ cfg, theme }) {
  const subjects = cfg.subjects || [];
  const loc = useLocation();
  const isActive = (path) => loc.pathname === path;

  return (
    <aside className="w-[280px] hidden md:flex flex-col border-r border-slate-800 bg-slate-950 sticky top-0 h-screen">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {cfg.logoUrl ? (
            <img src={cfg.logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded-xl bg-white/10" />
          ) : (
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-slate-800 to-slate-700`}>
              <BookOpen className="text-white" size={20} />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-bold truncate">{cfg.academyName}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Admin Panel</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-8 overflow-y-auto">
        <NavGroup label="Principal">
          <NavItem to="/app" icon={LayoutDashboard} label="Dashboard" active={isActive("/app")} theme={theme} />
        </NavGroup>
        <NavGroup label="Mis Cursos">
          {subjects.map((s) => {
            const Icon = ICON_MAP[s.iconKey] || BookOpen;
            const path = `/app/subject/${s.id}`;
            return <NavItem key={s.id} to={path} icon={Icon} label={s.name} active={loc.pathname === path} theme={theme} />;
          })}
          {subjects.length === 0 && <div className="px-4 text-xs text-slate-600 italic">Sin cursos.</div>}
        </NavGroup>
        <NavGroup label="Gestión">
          <NavItem to="/app/archives" icon={Folder} label="Todos los archivos" active={isActive("/app/archives")} theme={theme} />
          <NavItem to="/app/settings" icon={Settings} label="Configuración" active={isActive("/app/settings")} theme={theme} />
        </NavGroup>
      </nav>
    </aside>
  );
}

function NavGroup({ label, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 px-4 mb-2 font-bold">{label}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, active, theme }) {
  // Aplicamos el color del tema si está activo
  const activeClass = active ? `${theme.light} ${theme.text}` : "text-slate-400 hover:bg-slate-900 hover:text-slate-200";
  const iconClass = active ? theme.text : "text-slate-500";

  return (
    <Link to={to} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-medium ${activeClass}`}>
      <Icon size={18} className={iconClass} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function Topbar({ query, setQuery, onLogout, theme }) {
  return (
    <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center gap-4">
      <div className="flex-1 max-w-xl relative group">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 transition group-focus-within:${theme.text}`} size={16} />
        <input 
          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:bg-slate-900 transition text-sm text-slate-200 placeholder:text-slate-600 focus:border-slate-700"
          placeholder="Buscar archivo por nombre..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <button onClick={onLogout} className="h-10 px-4 rounded-xl border border-slate-800 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-300 transition flex items-center gap-2 text-sm font-bold text-slate-400">
          <LogOut size={16} /> <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </div>
  );
}

function Dashboard({ cfg, meta, theme }) {
  const subjects = cfg.subjects || [];
  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Panel de Control</h1>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashCard label="Cursos Activos" value={subjects.length} icon={BookOpen} color={theme.text} bg={theme.light} border={theme.border} />
        <DashCard label="Archivos Totales" value={meta.length} icon={Folder} color={theme.text} bg={theme.light} border={theme.border} />
        <DashCard label="Última Subida" value={meta[0] ? new Date(meta[0].uploadedAt).toLocaleDateString() : "—"} icon={Upload} color={theme.text} bg={theme.light} border={theme.border} />
      </div>
      <div className="bg-slate-900/30 rounded-3xl border border-slate-800 p-8 flex items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-bold text-white">Configuración Rápida</h3>
          <p className="text-slate-400 text-sm mt-1">Personaliza tu logo y colores.</p>
        </div>
        <Link to="/app/settings" className="px-6 py-3 bg-white text-slate-950 rounded-xl font-bold hover:bg-slate-200 transition flex items-center gap-2">
          <Settings size={18} /> Ir a Ajustes
        </Link>
      </div>
    </div>
  );
}

function DashCard({ label, value, icon: Icon, color, bg, border }) {
  // Nota: Usamos styles inline para colores dinámicos si tailwind JIT falla con strings concatenados, 
  // pero aquí usamos las clases pasadas desde el theme object que son strings completos.
  return (
    <div className={`p-6 rounded-2xl border flex items-center gap-4 border-slate-800`}>
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${bg} ${color}`}>
        <Icon size={24} />
      </div>
      <div>
        <div className="text-2xl font-black">{value}</div>
        <div className="text-xs uppercase tracking-wider opacity-70 font-bold">{label}</div>
      </div>
    </div>
  );
}

function Subject({ user, cfg, meta, query, onDeleteFile, onPreview, theme }) {
  const { id } = useParams();
  const subject = (cfg.subjects || []).find((s) => s.id === id);
  const categories = cfg.categories && cfg.categories.length > 0 ? cfg.categories : DEFAULT_CATEGORIES;
  const [activeTab, setActiveTab] = useState(categories[0]?.key || "general");
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => { if (categories[0]) setActiveTab(categories[0].key); }, [id, categories]);

  if (!subject) return <div className="p-8 text-center text-slate-500">Materia no encontrada.</div>;

  // FILTRO ARREGLADO (BUSQUEDA INSENSIBLE)
  const filtered = useMemo(() => {
    const q = normalize(query);
    return meta
      .filter(m => m.subjectId === subject.id && m.category === activeTab)
      .filter(m => {
        if (!q) return true;
        const name = normalize(m.name);
        const tags = m.tags ? m.tags.map(t => normalize(t)) : [];
        return name.includes(q) || tags.some(t => t.includes(q));
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }, [meta, subject.id, activeTab, query]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Link to="/app" className="hover:text-white">Panel</Link> <ChevronRight size={14} /> <span>{subject.name}</span>
          </div>
          <h1 className="text-3xl font-black">{subject.name}</h1>
        </div>
        <button onClick={() => setUploadOpen(true)} className={`px-5 py-3 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-lg ${theme.bg} ${theme.hover}`}>
          <Plus size={20} /> <span className="hidden sm:inline">Subir Archivo</span>
        </button>
      </div>

      <div className="border-b border-slate-800 flex overflow-x-auto gap-1 hide-scrollbar">
        {categories.map((cat) => {
          const isActive = activeTab === cat.key;
          const Icon = ICON_MAP[cat.iconKey] || Folder;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveTab(cat.key)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition whitespace-nowrap text-sm font-bold ${isActive ? `${theme.border} ${theme.text}` : "border-transparent text-slate-400 hover:text-slate-200"}`}
            >
              <Icon size={16} /> {cat.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filtered.map(f => (
          <FileRow key={f.id} file={f} onDelete={() => onDeleteFile(f)} onPreview={() => onPreview(f)} theme={theme} />
        ))}
        {filtered.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-3xl bg-slate-900/20">
            <Folder size={48} className="opacity-20 mb-4" />
            <p>Carpeta vacía</p>
            <button onClick={() => setUploadOpen(true)} className={`mt-4 text-sm font-bold hover:underline ${theme.text}`}>Subir primer archivo</button>
          </div>
        )}
      </div>

      {uploadOpen && (
        <UploadModal
          subject={subject}
          category={activeTab}
          categoryLabel={categories.find(c => c.key === activeTab)?.label}
          onClose={() => setUploadOpen(false)}
          theme={theme}
          onSuccess={async (file, tags) => {
             await addUserFile(user.uid, {
                id: uid("file"),
                subjectId: subject.id,
                category: activeTab,
                name: file.name,
                size: file.size,
                mime: file.type,
                tags,
                uploadedAt: new Date().toISOString(),
                downloadURL: file.downloadURL,
                ownerUid: user.uid
             });
             setUploadOpen(false);
          }}
        />
      )}
    </div>
  );
}

function UploadModal({ subject, category, categoryLabel, onClose, onSuccess, theme }) {
  const [file, setFile] = useState(null);
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  };

  const startUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const path = `users/${subject.id}/${category}`;
      const url = await uploadFileWithProgress(file, path, (pct) => setProgress(Math.round(pct)));
      file.downloadURL = url;
      const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);
      await onSuccess(file, tagList);
    } catch (e) {
      console.error(e);
      alert("Error subiendo: " + e.message);
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <div>
            <h3 className="font-bold text-white text-lg">Subir Archivo</h3>
            <div className="text-slate-400 text-xs mt-0.5">{subject.name} • {categoryLabel}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all ${
              dragActive ? `${theme.border} ${theme.light}` : "border-slate-700 bg-slate-950/50 hover:border-slate-600"
            }`}
          >
            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setFile(e.target.files[0])} disabled={uploading} />
            {file ? (
               <div className="flex flex-col items-center">
                 <FileText size={40} className={`${theme.text} mb-2`} />
                 <div className="font-bold text-white max-w-[200px] truncate">{file.name}</div>
                 <div className="text-xs text-slate-400 mt-1">{formatBytes(file.size)}</div>
               </div>
            ) : (
               <>
                 <Upload size={40} className="text-slate-500 mb-3" />
                 <div className="font-medium text-slate-300">Arrastra tu archivo aquí</div>
               </>
            )}
          </div>
          <input className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-slate-500 text-sm" placeholder="Etiquetas (opcional)" value={tags} onChange={e => setTags(e.target.value)} disabled={uploading} />
          {uploading && (
             <div className="space-y-1">
               <div className="flex justify-between text-xs font-bold text-slate-400"><span>Subiendo...</span><span>{progress}%</span></div>
               <div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${theme.bg} transition-all duration-300`} style={{ width: `${progress}%` }}></div></div>
             </div>
          )}
          <button onClick={startUpload} disabled={!file || uploading} className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition ${!file || uploading ? "bg-slate-800 text-slate-500" : `${theme.bg} ${theme.hover} text-white`}`}>{uploading ? "Procesando..." : "Subir a la Nube"}</button>
        </div>
      </div>
    </div>
  );
}

function FileRow({ file, onDelete, onPreview, theme }) {
  const [copied, setCopied] = useState(false);
  const isImage = file.mime?.startsWith("image/");
  const Icon = isImage ? ImageIcon : FileText;

  const shareWhatsApp = () => {
    const text = `Hola! Aquí tienes el archivo "${file.name}": ${file.downloadURL}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(file.downloadURL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error copiando", err);
    }
  };

  return (
    <div className="group flex items-center justify-between p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl hover:border-slate-700 hover:bg-slate-900/80 transition-all">
      <div className="flex items-center gap-4 min-w-0">
        <div onClick={onPreview} className="h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-700 transition">
          <Icon size={20} className={theme.text} />
        </div>
        <div className="min-w-0">
          <div onClick={onPreview} className={`font-bold text-slate-200 truncate cursor-pointer hover:${theme.text} transition`}>{file.name}</div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span>{formatBytes(file.size)}</span>
            <span>•</span>
            <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
            {file.tags && file.tags.length > 0 && <div className="flex gap-1">{file.tags.map((t,i) => <span key={i} className="bg-slate-800 px-1.5 rounded text-[10px] text-slate-400">#{t}</span>)}</div>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={copyLink} className={`p-2 rounded-lg ${theme.light} ${theme.text} hover:opacity-80 transition`} title="Copiar Enlace Público">
          {copied ? <Check size={18} /> : <Link2 size={18} />}
        </button>
        <button onClick={shareWhatsApp} className="p-2 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition" title="Enviar enlace por WhatsApp">
          <Share2 size={18} />
        </button>
        <button onClick={onPreview} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"><Eye size={18} /></button>
        <button onClick={() => window.open(file.downloadURL, "_blank")} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"><Download size={18} /></button>
        <button onClick={() => window.confirm("¿Borrar archivo?") && onDelete()} className="p-2 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition"><Trash2 size={18} /></button>
      </div>
    </div>
  );
}

function PreviewModal({ file, onClose, theme }) {
  const isImg = file.mime?.startsWith("image/");
  const isPdf = file.mime?.includes("pdf");

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col animate-fade-in">
      <div className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shrink-0">
        <div className="font-bold text-white truncate">{file.name}</div>
        <button onClick={onClose} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white"><X size={20}/></button>
      </div>
      <div className="flex-1 overflow-hidden bg-slate-900 flex items-center justify-center relative">
        {isImg && <img src={file.downloadURL} alt="preview" className="max-h-full max-w-full object-contain" />}
        {isPdf && <iframe src={file.downloadURL} className="w-full h-full border-0" title="PDF Preview"></iframe>}
        {!isImg && !isPdf && (
           <div className="text-center">
             <FileText size={64} className="mx-auto text-slate-600 mb-4" />
             <p className="text-slate-400">Vista previa no disponible.</p>
             <a href={file.downloadURL} target="_blank" rel="noreferrer" className={`mt-4 inline-block ${theme.text} hover:underline`}>Descargar archivo</a>
           </div>
        )}
      </div>
    </div>
  );
}

function Archives({ cfg, meta, query, onDeleteFile, onPreview, theme }) {
  const subjects = cfg.subjects || [];
  const [cat, setCat] = useState("all");
  const filtered = useMemo(() => {
    const q = normalize(query);
    return meta
      .filter(m => cat === "all" || m.category === cat)
      .filter(m => {
        if (!q) return true;
        const name = normalize(m.name);
        const tags = m.tags ? m.tags.map(t => normalize(t)) : [];
        return name.includes(q) || tags.some(t => t.includes(q));
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }, [meta, cat, query]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Todos los Archivos</h1>
      <div className="space-y-3">
        {filtered.map(f => <FileRow key={f.id} file={f} onDelete={() => onDeleteFile(f)} onPreview={() => onPreview(f)} theme={theme} />)}
      </div>
    </div>
  );
}

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
