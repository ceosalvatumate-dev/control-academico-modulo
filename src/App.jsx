import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  HashRouter, Routes, Route, Navigate, Link, useLocation, useNavigate, useParams
} from "react-router-dom";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { uploadFileWithProgress, deleteFileFromStorage } from "./services/storageService";
import {
  getUserConfig, saveUserConfig, listenUserFiles, addUserFile, deleteUserFile
} from "./services/firestoreService";

// Iconos
import {
  Bell, BookOpen, ChevronRight, Upload, Folder, LayoutDashboard, LogOut,
  Search, Settings, Trash2, Download, Plus, X, FileText, Image as ImageIcon,
  Sigma, FlaskConical, Code2, Calculator, Braces, BrainCircuit, Share2,
  Eye, ListChecks, FileSpreadsheet, Paperclip
} from "lucide-react";

// -------------------------
// Mapas de Iconos Disponibles
// -------------------------
const ICON_MAP = {
  Folder: Folder,
  FileText: FileText,
  BookOpen: BookOpen,
  Sigma: Sigma,
  FlaskConical: FlaskConical,
  Code2: Code2,
  Calculator: Calculator,
  Braces: Braces,
  BrainCircuit: BrainCircuit,
  ListChecks: ListChecks,
  FileSpreadsheet: FileSpreadsheet,
  Paperclip: Paperclip
};

// Defaults si el usuario no tiene config
const DEFAULT_CATEGORIES = [
  { key: "tasks", label: "Lista de tareas", iconKey: "Folder" },
  { key: "solutions", label: "Soluciones", iconKey: "FileText" },
  { key: "exams", label: "Exámenes", iconKey: "FileText" },
  { key: "books", label: "Libros", iconKey: "BookOpen" }
];

// -------------------------
// Auth Guard
// -------------------------
function RequireAuth({ children, user }) {
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

// -------------------------
// App Root
// -------------------------
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

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Cargando...</div>;

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

// -------------------------
// Login
// -------------------------
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
          <h2 className="text-2xl font-black mb-1">Bienvenido</h2>
          <p className="text-slate-400 text-sm">Repositorio Académico Personal</p>
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
// Shell
// -------------------------
function Shell({ user }) {
  const [cfg, setCfg] = useState({ subjects: [], categories: DEFAULT_CATEGORIES, academyName: "Cargando..." });
  const [meta, setMeta] = useState([]);
  const [query, setQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);

  // Preview Modal State
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    if (user?.uid) getUserConfig(user.uid).then(c => setCfg({ ...c, categories: c.categories || DEFAULT_CATEGORIES }));
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

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-blue-500/30">
      <div className="flex min-h-screen">
        <Sidebar cfg={cfg} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar academyName={cfg.academyName} query={query} setQuery={setQuery} notifOpen={notifOpen} setNotifOpen={setNotifOpen} onLogout={onLogout} meta={meta} />
          <div className="p-6 md:p-8 flex-1 overflow-y-auto">
            <Routes>
              <Route index element={<Dashboard cfg={cfg} meta={meta} />} />
              <Route path="subject/:id" element={<Subject user={user} cfg={cfg} meta={meta} query={query} onDeleteFile={handleDeleteFile} onPreview={setPreviewFile} />} />
              <Route path="archives" element={<Archives cfg={cfg} meta={meta} query={query} onDeleteFile={handleDeleteFile} onPreview={setPreviewFile} />} />
              <Route path="settings" element={<SettingsPage user={user} cfg={cfg} setCfg={setCfg} />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </div>
        </div>
      </div>
      
      {/* Modal de Previsualización */}
      {previewFile && (
        <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}

// -------------------------
// Sidebar
// -------------------------
function Sidebar({ cfg }) {
  const subjects = cfg.subjects || [];
  const loc = useLocation();
  const isActive = (path) => loc.pathname === path;

  return (
    <aside className="w-[280px] hidden md:flex flex-col border-r border-slate-800 bg-slate-950 sticky top-0 h-screen">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
            <BookOpen className="text-white" size={20} />
          </div>
          <div className="min-w-0">
            <div className="font-bold truncate">{cfg.academyName}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Admin Panel</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-8 overflow-y-auto">
        <NavGroup label="Principal">
          <NavItem to="/app" icon={LayoutDashboard} label="Dashboard" active={isActive("/app")} />
        </NavGroup>

        <NavGroup label="Mis Cursos">
          {subjects.map((s) => {
            const Icon = ICON_MAP[s.iconKey] || BookOpen;
            const path = `/app/subject/${s.id}`;
            return <NavItem key={s.id} to={path} icon={Icon} label={s.name} active={loc.pathname === path} />;
          })}
          {subjects.length === 0 && <div className="px-4 text-xs text-slate-600 italic">No hay cursos aún.</div>}
        </NavGroup>

        <NavGroup label="Gestión">
          <NavItem to="/app/archives" icon={Folder} label="Todos los archivos" active={isActive("/app/archives")} />
          <NavItem to="/app/settings" icon={Settings} label="Configuración" active={isActive("/app/settings")} />
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

function NavItem({ to, icon: Icon, label, active }) {
  return (
    <Link to={to} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-medium ${active ? "bg-blue-600/10 text-blue-300" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"}`}>
      <Icon size={18} className={active ? "text-blue-400" : "text-slate-500"} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

// -------------------------
// Topbar
// -------------------------
function Topbar({ query, setQuery, onLogout, notifOpen, setNotifOpen }) {
  return (
    <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center gap-4">
      <div className="flex-1 max-w-xl relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition" size={16} />
        <input 
          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-blue-500/50 focus:bg-slate-900 transition text-sm text-slate-200 placeholder:text-slate-600"
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

// -------------------------
// Dashboard
// -------------------------
function Dashboard({ cfg, meta }) {
  const subjects = cfg.subjects || [];
  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Panel de Control</h1>
        <p className="text-slate-400 mt-2">Bienvenido a tu repositorio centralizado.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashCard label="Cursos Activos" value={subjects.length} icon={BookOpen} color="blue" />
        <DashCard label="Archivos Totales" value={meta.length} icon={Folder} color="emerald" />
        <DashCard label="Última Subida" value={meta[0] ? new Date(meta[0].uploadedAt).toLocaleDateString() : "—"} icon={Upload} color="purple" />
      </div>

      <div className="bg-slate-900/30 rounded-3xl border border-slate-800 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-bold text-white">Configuración Rápida</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-md">Personaliza categorías, iconos de materias y preferencias del sistema.</p>
        </div>
        <Link to="/app/settings" className="px-6 py-3 bg-white text-slate-950 rounded-xl font-bold hover:bg-slate-200 transition flex items-center gap-2">
          <Settings size={18} /> Ir a Ajustes
        </Link>
      </div>
    </div>
  );
}

function DashCard({ label, value, icon: Icon, color }) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return (
    <div className={`p-6 rounded-2xl border ${colors[color]} flex items-center gap-4`}>
      <div className={`h-12 w-12 rounded-xl ${colors[color]} flex items-center justify-center`}>
        <Icon size={24} />
      </div>
      <div>
        <div className="text-2xl font-black">{value}</div>
        <div className="text-xs uppercase tracking-wider opacity-70 font-bold">{label}</div>
      </div>
    </div>
  );
}

// -------------------------
// Subject (Materia)
// -------------------------
function Subject({ user, cfg, meta, query, onDeleteFile, onPreview }) {
  const { id } = useParams();
  const subject = (cfg.subjects || []).find((s) => s.id === id);
  // Si no hay categorías en cfg, usar default
  const categories = cfg.categories && cfg.categories.length > 0 ? cfg.categories : DEFAULT_CATEGORIES;
  const [activeTab, setActiveTab] = useState(categories[0]?.key || "general");
  const [uploadOpen, setUploadOpen] = useState(false);

  // Cuando cambie el ID de la url, resetear tab al primero disponible
  useEffect(() => { if (categories[0]) setActiveTab(categories[0].key); }, [id, categories]);

  if (!subject) return <div className="p-8 text-center text-slate-500">Materia no encontrada.</div>;

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    return meta
      .filter(m => m.subjectId === subject.id && m.category === activeTab)
      .filter(m => !q || m.name.toLowerCase().includes(q) || (m.tags && m.tags.some(t => t.toLowerCase().includes(q))))
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
        <button onClick={() => setUploadOpen(true)} className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-blue-900/20">
          <Plus size={20} /> <span className="hidden sm:inline">Subir Archivo</span>
        </button>
      </div>

      {/* Tabs Dinámicos */}
      <div className="border-b border-slate-800 flex overflow-x-auto gap-1 hide-scrollbar">
        {categories.map((cat) => {
          const isActive = activeTab === cat.key;
          const Icon = ICON_MAP[cat.iconKey] || Folder;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveTab(cat.key)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition whitespace-nowrap text-sm font-bold ${isActive ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
            >
              <Icon size={16} /> {cat.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filtered.map(f => (
          <FileRow key={f.id} file={f} onDelete={() => onDeleteFile(f)} onPreview={() => onPreview(f)} />
        ))}
        {filtered.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-3xl bg-slate-900/20">
            <Folder size={48} className="opacity-20 mb-4" />
            <p>Carpeta vacía</p>
            <button onClick={() => setUploadOpen(true)} className="mt-4 text-blue-400 text-sm font-bold hover:underline">Subir primer archivo</button>
          </div>
        )}
      </div>

      {uploadOpen && (
        <UploadModal
          subject={subject}
          category={activeTab}
          categoryLabel={categories.find(c => c.key === activeTab)?.label}
          onClose={() => setUploadOpen(false)}
          onSuccess={async (file, tags) => {
             // Subida con progreso
             await addUserFile(user.uid, {
                id: uid("file"),
                subjectId: subject.id,
                category: activeTab,
                name: file.name,
                size: file.size,
                mime: file.type,
                tags,
                uploadedAt: new Date().toISOString(),
                downloadURL: file.downloadURL, // Viene del modal
                ownerUid: user.uid
             });
             setUploadOpen(false);
          }}
        />
      )}
    </div>
  );
}

// -------------------------
// Upload Modal (Drag & Drop + Progress)
// -------------------------
function UploadModal({ subject, category, categoryLabel, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const startUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      // Usamos el servicio con progreso
      const path = `users/${subject.id}/${category}`;
      const url = await uploadFileWithProgress(file, path, (pct) => setProgress(Math.round(pct)));
      
      // Inyectamos la URL al file object para pasarlo al padre
      file.downloadURL = url;
      
      // Parsear tags
      const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);
      await onSuccess(file, tagList);
    } catch (e) {
      console.error(e);
      alert("Error subiendo archivo");
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
          {/* Drag Zone */}
          <div
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all ${
              dragActive ? "border-blue-500 bg-blue-500/10" : "border-slate-700 bg-slate-950/50 hover:border-slate-600"
            }`}
          >
            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setFile(e.target.files[0])} disabled={uploading} />
            {file ? (
               <div className="flex flex-col items-center">
                 <FileText size={40} className="text-blue-400 mb-2" />
                 <div className="font-bold text-white max-w-[200px] truncate">{file.name}</div>
                 <div className="text-xs text-slate-400 mt-1">{formatBytes(file.size)}</div>
               </div>
            ) : (
               <>
                 <Upload size={40} className="text-slate-500 mb-3" />
                 <div className="font-medium text-slate-300">Arrastra tu archivo aquí</div>
                 <div className="text-xs text-slate-500 mt-1">o haz clic para explorar</div>
               </>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Etiquetas (Opcional)</label>
            <input 
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-sm"
              placeholder="Ej: examen, 2024, difícil (separado por comas)"
              value={tags}
              onChange={e => setTags(e.target.value)}
              disabled={uploading}
            />
          </div>

          {/* Progress Bar */}
          {uploading && (
             <div className="space-y-1">
               <div className="flex justify-between text-xs font-bold text-slate-400">
                 <span>Subiendo...</span>
                 <span>{progress}%</span>
               </div>
               <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                 <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
               </div>
             </div>
          )}

          <button
            onClick={startUpload}
            disabled={!file || uploading}
            className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition ${
              !file || uploading ? "bg-slate-800 text-slate-500" : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            {uploading ? "Procesando..." : "Subir a la Nube"}
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------
// File Row (WhatsApp & Actions)
// -------------------------
function FileRow({ file, onDelete, onPreview }) {
  const isImage = file.mime?.startsWith("image/");
  const Icon = isImage ? ImageIcon : FileText;

  const shareWhatsApp = () => {
    const text = `Hola! Te comparto este archivo de ${file.name}: ${file.downloadURL}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="group flex items-center justify-between p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl hover:border-slate-700 hover:bg-slate-900/80 transition-all">
      <div className="flex items-center gap-4 min-w-0">
        <div onClick={onPreview} className="h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer hover:bg-blue-600/20 hover:text-blue-400 transition">
          <Icon size={20} className="text-slate-400" />
        </div>
        <div className="min-w-0">
          <div onClick={onPreview} className="font-bold text-slate-200 truncate cursor-pointer hover:text-blue-400 transition">{file.name}</div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span>{formatBytes(file.size)}</span>
            <span>•</span>
            <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
            {file.tags && file.tags.length > 0 && (
              <>
                 <span>•</span>
                 <div className="flex gap-1">
                   {file.tags.map((t,i) => <span key={i} className="bg-slate-800 px-1.5 rounded text-[10px] text-slate-400">#{t}</span>)}
                 </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={shareWhatsApp} className="p-2 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition" title="Enviar por WhatsApp">
          <Share2 size={18} />
        </button>
        
        <button onClick={onPreview} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition" title="Vista Previa">
          <Eye size={18} />
        </button>

        <button onClick={() => window.open(file.downloadURL, "_blank")} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition" title="Descargar">
          <Download size={18} />
        </button>

        <button onClick={() => window.confirm("¿Borrar archivo?") && onDelete()} className="p-2 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

// -------------------------
// Preview Modal
// -------------------------
function PreviewModal({ file, onClose }) {
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
             <p className="text-slate-400">Vista previa no disponible para este formato.</p>
             <a href={file.downloadURL} target="_blank" rel="noreferrer" className="mt-4 inline-block text-blue-400 hover:underline">Descargar archivo</a>
           </div>
        )}
      </div>
    </div>
  );
}

// -------------------------
// Settings Page (Personalización Total)
// -------------------------
function SettingsPage({ user, cfg, setCfg }) {
  const [activeTab, setActiveTab] = useState("general");
  const [academyName, setAcademyName] = useState(cfg.academyName || "");
  const [subjects, setSubjects] = useState(cfg.subjects || []);
  const [categories, setCategories] = useState(cfg.categories || DEFAULT_CATEGORIES);
  
  // Inputs temporales
  const [newSubj, setNewSubj] = useState({ name: "", icon: "BookOpen" });
  const [newCat, setNewCat] = useState({ label: "", icon: "Folder" });

  const iconOptions = Object.keys(ICON_MAP);

  const saveAll = async () => {
    const next = { ...cfg, academyName, subjects, categories };
    await saveUserConfig(user.uid, next);
    setCfg(next);
    alert("Configuración guardada");
  };

  const handleAddSubject = () => {
     if(!newSubj.name) return;
     const id = uid("subj");
     setSubjects([...subjects, { id, name: newSubj.name, iconKey: newSubj.icon }]);
     setNewSubj({ name: "", icon: "BookOpen" });
  };

  const handleAddCategory = () => {
    if(!newCat.label) return;
    const key = uid("cat");
    setCategories([...categories, { key, label: newCat.label, iconKey: newCat.icon }]);
    setNewCat({ label: "", icon: "Folder" });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">Configuración</h1>
        <button onClick={saveAll} className="bg-white text-slate-900 px-6 py-2 rounded-xl font-bold hover:bg-slate-200 transition">Guardar Cambios</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Menu Lateral Ajustes */}
        <div className="space-y-2">
           {["general", "subjects", "categories"].map(k => (
             <button key={k} onClick={() => setActiveTab(k)} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition ${activeTab === k ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"}`}>
               {k === "general" && "General"}
               {k === "subjects" && "Materias"}
               {k === "categories" && "Carpetas"}
             </button>
           ))}
        </div>

        {/* Contenido */}
        <div className="md:col-span-3 space-y-8">
          
          {activeTab === "general" && (
            <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
              <h3 className="font-bold text-xl mb-4">Perfil de la Academia</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre</label>
                  <input className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500" value={academyName} onChange={e => setAcademyName(e.target.value)} />
                </div>
              </div>
            </section>
          )}

          {activeTab === "subjects" && (
            <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
              <h3 className="font-bold text-xl mb-4">Gestión de Materias</h3>
              <div className="flex gap-2 mb-6 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <div className="flex-1">
                  <input placeholder="Nombre de la materia..." className="w-full bg-transparent outline-none text-sm" value={newSubj.name} onChange={e => setNewSubj({...newSubj, name: e.target.value})} />
                </div>
                <select 
                  className="bg-slate-900 text-xs border border-slate-700 rounded-lg outline-none px-2"
                  value={newSubj.icon}
                  onChange={e => setNewSubj({...newSubj, icon: e.target.value})}
                >
                  {iconOptions.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <button onClick={handleAddSubject} className="bg-blue-600 px-3 py-1 rounded-lg font-bold text-xs hover:bg-blue-500">Agregar</button>
              </div>

              <div className="space-y-2">
                {subjects.map(s => {
                  const Icon = ICON_MAP[s.iconKey] || BookOpen;
                  return (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-3">
                        <Icon size={18} className="text-slate-400" />
                        <span className="font-bold">{s.name}</span>
                      </div>
                      <button onClick={() => setSubjects(subjects.filter(x => x.id !== s.id))} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === "categories" && (
             <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
               <h3 className="font-bold text-xl mb-1">Tipos de Archivo (Carpetas)</h3>
               <p className="text-slate-400 text-sm mb-6">Define qué pestañas aparecen dentro de cada materia.</p>
               
               <div className="flex gap-2 mb-6 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <div className="flex-1">
                  <input placeholder="Nueva categoría (ej: Formularios)..." className="w-full bg-transparent outline-none text-sm" value={newCat.label} onChange={e => setNewCat({...newCat, label: e.target.value})} />
                </div>
                <select 
                  className="bg-slate-900 text-xs border border-slate-700 rounded-lg outline-none px-2"
                  value={newCat.icon}
                  onChange={e => setNewCat({...newCat, icon: e.target.value})}
                >
                  {iconOptions.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <button onClick={handleAddCategory} className="bg-emerald-600 px-3 py-1 rounded-lg font-bold text-xs hover:bg-emerald-500">Agregar</button>
              </div>

              <div className="space-y-2">
                 {categories.map(c => {
                   const Icon = ICON_MAP[c.iconKey] || Folder;
                   return (
                     <div key={c.key} className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                       <div className="flex items-center gap-3">
                         <Icon size={18} className="text-slate-400" />
                         <span className="font-medium">{c.label}</span>
                       </div>
                       <button onClick={() => setCategories(categories.filter(x => x.key !== c.key))} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button>
                     </div>
                   );
                 })}
              </div>
             </section>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------
// Helpers
// -------------------------
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
