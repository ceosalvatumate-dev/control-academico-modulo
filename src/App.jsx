import React, { useEffect, useMemo, useState } from "react";

import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
  useNavigate,
  useParams
} from "react-router-dom";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";

// IMPORTANTE: Asegúrate de tener storage importado para borrar archivos físicos si deseas
import { auth, googleProvider, storage } from "./firebase";
import { uploadFile } from "./services/storageService";
import { 
  getUserConfig, 
  saveUserConfig, 
  listenUserFiles, 
  addUserFile, 
  deleteUserFile 
} from "./services/firestoreService";

// Para borrar físicamente de Storage (opcional pero recomendado)
import { ref, deleteObject } from "firebase/storage";

import {
  Bell,
  BookOpen,
  ChevronRight,
  Upload,
  Folder,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Trash2,
  Download,
  Plus,
  X,
  FileText,
  Image as ImageIcon,
  Sigma,
  FlaskConical,
  Code2
} from "lucide-react";

// -------------------------
// Categorías “carpetas”
// -------------------------
const CATEGORIES = [
  { key: "tasks", label: "Lista de tareas", icon: Folder },
  { key: "solutions", label: "Soluciones de tareas", icon: FileText },
  { key: "controlExams", label: "Exámenes de control", icon: FileText },
  { key: "etsExams", label: "Exámenes ETS", icon: FileText },
  { key: "references", label: "Libros de referencia", icon: BookOpen },
  { key: "archives", label: "Archivos", icon: Folder }
];

function iconForSubjectName(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("álgebra") || n.includes("algebra")) return Sigma;
  if (n.includes("trigo") || n.includes("física") || n.includes("fisica")) return FlaskConical;
  if (n.includes("analítica") || n.includes("analitica")) return Code2;
  return BookOpen;
}

// -------------------------
// Auth Guard
// -------------------------
function RequireAuth({ children, user }) {
  const loc = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return children;
}

// -------------------------
// App Root
// -------------------------
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser || null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        Cargando sesión...
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/app/*"
          element={
            <RequireAuth user={user}>
              {/* Pasamos user como prop para que Shell tenga el UID inmediatamente */}
              <Shell user={user} />
            </RequireAuth>
          }
        />
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

  const loginWithEmail = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      nav("/app");
    } catch (err) {
      setError(err?.message || "Error al iniciar sesión");
    }
  };

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      nav("/app");
    } catch (err) {
      setError(err?.message || "Error al iniciar sesión con Google");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <form
        onSubmit={loginWithEmail}
        className="bg-slate-800 p-6 rounded w-80 space-y-4"
      >
        <h2 className="text-xl font-bold text-center">Iniciar sesión</h2>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 rounded bg-slate-700"
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 rounded bg-slate-700"
        />

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded"
        >
          Entrar con correo
        </button>

        <button
          type="button"
          onClick={loginWithGoogle}
          className="w-full bg-red-600 hover:bg-red-700 p-2 rounded"
        >
          Entrar con Google
        </button>
      </form>
    </div>
  );
}

// -------------------------
// Shell (layout + Data Fetching)
// -------------------------
function Shell({ user }) {
  // Estado inicial vacío, se llena desde Firestore
  const [cfg, setCfg] = useState({ subjects: [], academyName: "Cargando..." });
  const [meta, setMeta] = useState([]);
  
  const [query, setQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);

  // 1. Cargar Configuración inicial
  useEffect(() => {
    if (!user?.uid) return;
    getUserConfig(user.uid).then((config) => {
      setCfg(config);
    });
  }, [user]);

  // 2. Suscripción en tiempo real a Archivos (Firestore)
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = listenUserFiles(user.uid, (files) => {
      setMeta(files);
    });
    return () => unsubscribe();
  }, [user]);

  const subjects = cfg.subjects || [];

  const onLogout = async () => {
    await signOut(auth);
    window.location.hash = "#/login";
  };

  const notifCount = useMemo(() => {
    const tasks = meta.filter((m) => m.category === "tasks");
    return tasks.length;
  }, [meta]);

  // Handler centralizado para borrar archivos (Firestore + Storage opcional)
  const handleDeleteFile = async (fileMeta) => {
    if (!user?.uid) return;
    try {
      // 1. Borrar metadata de Firestore
      await deleteUserFile(user.uid, fileMeta.id);

      // 2. Intentar borrar de Storage (si existe la referencia)
      // Si usaste la ruta default en storageService, intenta reconstruirla o 
      // guarda la ruta completa en metadata. Aquí asumimos un intento 'best effort'.
      // Si tienes la ruta en fileMeta.storagePath es ideal. Si no, solo borramos el doc.
      if (fileMeta.downloadURL) {
         try {
            const fileRef = ref(storage, fileMeta.downloadURL);
            await deleteObject(fileRef);
         } catch (e) {
            console.warn("No se pudo borrar físico (posiblemente ya no existe o permisos):", e);
         }
      }
    } catch (error) {
      console.error("Error eliminando archivo:", error);
      alert("Error eliminando archivo.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <Sidebar cfg={cfg} />

        <div className="flex-1 flex flex-col">
          <Topbar
            academyName={cfg.academyName}
            query={query}
            setQuery={setQuery}
            notifCount={notifCount}
            notifOpen={notifOpen}
            setNotifOpen={setNotifOpen}
            onLogout={onLogout}
          />

          <div className="p-6 md:p-8">
            <Routes>
              <Route index element={<Dashboard cfg={cfg} meta={meta} />} />

              <Route
                path="subject/:id"
                element={
                  <Subject
                    user={user}
                    cfg={cfg}
                    meta={meta}
                    query={query}
                    onDeleteFile={handleDeleteFile}
                  />
                }
              />

              <Route
                path="archives"
                element={
                  <Archives 
                    cfg={cfg} 
                    meta={meta} 
                    query={query} 
                    onDeleteFile={handleDeleteFile}
                  />
                }
              />

              <Route
                path="settings"
                element={
                  <SettingsPage 
                    user={user}
                    cfg={cfg} 
                    setCfg={setCfg} 
                  />
                }
              />

              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </div>
        </div>
      </div>
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
    <aside className="w-[285px] hidden md:flex flex-col border-r border-slate-800 bg-slate-950/60">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <BookOpen className="text-blue-300" size={20} />
          </div>
          <div>
            <div className="font-bold leading-tight truncate w-32">{cfg.academyName}</div>
            <div className="text-xs text-slate-400">Repositorio Cloud</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-500 px-3 mb-2">
            Principal
          </div>
          <Link
            to="/app"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${
              isActive("/app")
                ? "bg-slate-900 border-slate-700"
                : "border-transparent hover:bg-slate-900/40"
            }`}
          >
            <LayoutDashboard size={18} className="text-slate-300" />
            <span className="font-semibold">Dashboard</span>
          </Link>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-500 px-3 mb-2">
            Materias
          </div>

          <div className="space-y-2">
            {subjects.map((s) => {
              const Icon = iconForSubjectName(s.name);
              const path = `/app/subject/${s.id}`;
              const active = loc.pathname === path;
              return (
                <Link
                  key={s.id}
                  to={path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${
                    active
                      ? "bg-blue-600/15 border-blue-500/30"
                      : "border-transparent hover:bg-slate-900/40"
                  }`}
                >
                  <Icon size={18} className={active ? "text-blue-300" : "text-slate-300"} />
                  <span className="font-semibold truncate">{s.name}</span>
                </Link>
              );
            })}
            {subjects.length === 0 && (
              <div className="px-4 py-2 text-xs text-slate-500">Sin materias configuradas.</div>
            )}
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-500 px-3 mb-2">
            Herramientas
          </div>

          <Link
            to="/app/archives"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${
              isActive("/app/archives")
                ? "bg-slate-900 border-slate-700"
                : "border-transparent hover:bg-slate-900/40"
            }`}
          >
            <Folder size={18} className="text-slate-300" />
            <span className="font-semibold">Archivos</span>
          </Link>

          <Link
            to="/app/settings"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${
              isActive("/app/settings")
                ? "bg-slate-900 border-slate-700"
                : "border-transparent hover:bg-slate-900/40"
            }`}
          >
            <Settings size={18} className="text-slate-300" />
            <span className="font-semibold">Configuración</span>
          </Link>
        </div>
      </nav>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
        Sincronizado con Firebase Firestore
      </div>
    </aside>
  );
}

// -------------------------
// Topbar
// -------------------------
function Topbar({ query, setQuery, notifCount, notifOpen, setNotifOpen, onLogout }) {
  return (
    <div className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/70 backdrop-blur">
      <div className="p-4 md:p-5 flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 bg-slate-900/40 border border-slate-800 rounded-2xl px-4 py-2.5">
          <Search size={16} className="text-slate-400" />
          <input
            className="w-full bg-transparent outline-none text-sm placeholder:text-slate-500"
            placeholder="Buscar… (por nombre de archivo)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="h-11 w-11 rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 transition flex items-center justify-center"
            title="Notificaciones"
          >
            <Bell size={18} className="text-slate-200" />
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 text-[11px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                {notifCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-800 bg-slate-950 shadow-soft overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="font-bold">Notificaciones</div>
                <button onClick={() => setNotifOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <div className="p-4 text-sm text-slate-300">
                {notifCount > 0 ? (
                  <div>Hay <b>{notifCount}</b> archivo(s) en “Lista de tareas”.</div>
                ) : (
                  <div className="text-slate-400">Sin notificaciones.</div>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onLogout}
          className="h-11 px-4 rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 transition flex items-center gap-2"
          title="Cerrar sesión"
        >
          <LogOut size={16} className="text-slate-200" />
          <span className="hidden md:block text-sm font-semibold">Salir</span>
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
  const first = subjects[0];

  return (
    <div className="space-y-6">
      <div className="text-slate-400 text-sm">
        Principal <ChevronRight className="inline" size={14} /> Dashboard
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6 md:p-8 shadow-soft">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">
              ● Cloud Activo
            </div>
            <div className="mt-3 text-3xl md:text-4xl font-black">
              Panel principal
            </div>
            <p className="mt-2 text-slate-300 max-w-2xl">
              Organiza tus archivos por materia y carpeta. Todos tus datos se guardan
              seguros en Firebase y están disponibles en todos tus dispositivos.
            </p>
          </div>

          <Link
            to={first ? `/app/subject/${first.id}` : "/app/settings"}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-slate-900 font-bold hover:opacity-90 transition"
          >
            <LayoutDashboard size={18} />
            Ir a materias
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Materias" value={`${subjects.length}`} />
          <StatCard label="Archivos totales" value={`${meta.length}`} />
          <StatCard
            label="Última subida"
            value={meta[0]?.uploadedAt ? new Date(meta[0].uploadedAt).toLocaleString() : "—"}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
      <div className="text-xs uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}

// -------------------------
// Subject Page
// -------------------------
function Subject({ user, cfg, meta, query, onDeleteFile }) {
  const { id } = useParams();
  const subject = (cfg.subjects || []).find((s) => s.id === id);
  const [tab, setTab] = useState("tasks");
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    setTab("tasks");
  }, [id]);

  if (!subject) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
        Materia no encontrada. Ve a configuración para agregarla.
      </div>
    );
  }

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    return meta
      .filter((m) => m.subjectId === subject.id && m.category === tab)
      .filter((m) => !q || (m.name || "").toLowerCase().includes(q))
      // Ordenar por fecha desc (las fechas de firestore a veces son timestamps, aquí usamos ISO string o Time)
      .sort((a, b) => {
        const dA = new Date(a.uploadedAt || 0);
        const dB = new Date(b.uploadedAt || 0);
        return dB - dA;
      });
  }, [meta, subject.id, tab, query]);

  return (
    <div className="space-y-6">
      <div className="text-slate-400 text-sm">
        Materias <ChevronRight className="inline" size={14} /> {subject.name}
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6 md:p-8 shadow-soft">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-200">
              ● Sincronizado
            </div>
            <div className="mt-3 text-4xl font-black">{subject.name}</div>
            <p className="mt-2 text-slate-300 max-w-2xl">
              Sube archivos a la nube y organízalos por categorías.
            </p>
          </div>

          <button
            onClick={() => setUploadOpen(true)}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-slate-900 font-bold hover:opacity-90 transition"
          >
            <Upload size={18} />
            Subir nuevo archivo
          </button>
        </div>

        <div className="mt-6">
          <Tabs tab={tab} setTab={setTab} />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/20 p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="font-black text-lg">Archivos</div>
          <div className="text-sm text-slate-400">{filtered.length} elemento(s)</div>
        </div>

        <div className="space-y-3">
          {filtered.map((f) => (
            <FileRow
              key={f.id}
              fileMeta={f}
              onDelete={() => onDeleteFile(f)}
            />
          ))}

          {filtered.length === 0 && (
            <div className="text-slate-400 text-sm p-6 text-center border border-dashed border-slate-800 rounded-2xl">
              No hay archivos aquí todavía. Usa “Subir nuevo archivo”.
            </div>
          )}
        </div>
      </div>

      {uploadOpen && (
        <UploadModal
          subject={subject}
          tab={tab}
          onClose={() => setUploadOpen(false)}
          onUpload={async (file) => {
            const fid = uid("file");
            
            // 1. Subir a Firebase Storage
            const downloadURL = await uploadFile(file, subject.id, tab);

            // 2. Guardar Metadata en Firestore
            const metaItem = {
              id: fid,
              subjectId: subject.id,
              category: tab,
              name: file.name,
              size: file.size,
              mime: file.type || "application/octet-stream",
              uploadedAt: new Date().toISOString(),
              downloadURL,
              ownerUid: user.uid
            };
            
            await addUserFile(user.uid, metaItem);
            
            // UI actualiza automáticamente por onSnapshot en Shell
            setUploadOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Tabs({ tab, setTab }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.filter((c) => c.key !== "archives").map((t) => {
        const active = tab === t.key;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border transition text-sm font-bold ${
              active
                ? "bg-blue-600/15 border-blue-500/30 text-blue-200"
                : "bg-slate-950/10 border-slate-800 text-slate-300 hover:bg-slate-900/40"
            }`}
          >
            <Icon size={16} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function FileRow({ fileMeta, onDelete }) {
  const [downloading, setDownloading] = useState(false);

  const isImage = (fileMeta.mime || "").startsWith("image/");
  const Icon = isImage ? ImageIcon : FileText;

  // Descargar usando fetch para evitar problemas de CORS o abrir en pestaña
  const onDownload = async () => {
    setDownloading(true);
    try {
      if (!fileMeta.downloadURL) {
        alert("URL de archivo no disponible");
        return;
      }
      
      // Opción A: Intentar fetch para forzar descarga (mejor UX)
      const response = await fetch(fileMeta.downloadURL);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileMeta.name || "archivo";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Fetch download falló, abriendo en nueva pestaña...", err);
      // Opción B: Fallback (abrir en pestaña nueva)
      window.open(fileMeta.downloadURL, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-center">
          <Icon size={18} className="text-slate-200" />
        </div>

        <div className="min-w-0">
          <div className="font-bold truncate">{fileMeta.name}</div>
          <div className="text-xs text-slate-400">
            {formatBytes(fileMeta.size)} •{" "}
            {fileMeta.uploadedAt ? new Date(fileMeta.uploadedAt).toLocaleString() : "—"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onDownload}
          className="h-10 px-3 rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 transition inline-flex items-center gap-2 text-sm font-bold"
          title="Descargar"
          disabled={downloading}
        >
          <Download size={16} />
          {downloading ? "…" : "Descargar"}
        </button>

        <button
          onClick={() => {
             if(window.confirm("¿Estás seguro de eliminar este archivo permanentemente?")) {
               onDelete();
             }
          }}
          className="h-10 w-10 rounded-2xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition flex items-center justify-center"
          title="Eliminar"
        >
          <Trash2 size={16} className="text-red-200" />
        </button>
      </div>
    </div>
  );
}

// -------------------------
// Upload Modal
// -------------------------
function UploadModal({ subject, tab, onClose, onUpload }) {
  const catLabel = CATEGORIES.find((c) => c.key === tab)?.label || "Carpeta";
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } catch (e) {
      console.error(e);
      alert("Error subiendo archivo");
      setUploading(false); // solo resetear si hay error, si no el padre cierra el modal
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 shadow-soft overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="font-black text-lg">Subir archivo</div>
            <div className="text-sm text-slate-400">
              {subject.name} • {catLabel}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-2xl border border-dashed border-slate-800 p-5 bg-slate-900/20">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-bold file:bg-white file:text-slate-900 hover:file:opacity-90"
            />
            <div className="text-xs text-slate-400 mt-2">
              Se subirá a Firebase Storage y la referencia a Firestore.
            </div>
          </div>

          <button
            disabled={!file || uploading}
            onClick={handleUpload}
            className={`w-full rounded-2xl px-4 py-3 font-black transition inline-flex items-center justify-center gap-2 ${
              file && !uploading
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-slate-800 text-slate-400 cursor-not-allowed"
            }`}
          >
            <Plus size={18} />
            {uploading ? "Subiendo..." : "Guardar en la nube"}
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------
// Archives (vista global)
// -------------------------
function Archives({ cfg, meta, query, onDeleteFile }) {
  const subjects = cfg.subjects || [];
  const [cat, setCat] = useState("archives");

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    return meta
      .filter((m) => m.category === cat)
      .filter((m) => !q || (m.name || "").toLowerCase().includes(q))
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }, [meta, cat, query]);

  const subjectName = (id) => subjects.find((s) => s.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <div className="text-slate-400 text-sm">
        Herramientas <ChevronRight className="inline" size={14} /> Archivos
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6 shadow-soft">
        <div className="font-black text-3xl">Archivos Globales</div>
        <p className="text-slate-300 mt-2">
          Vista global de todos tus archivos en la nube.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = cat === c.key;
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border transition text-sm font-bold ${
                  active
                    ? "bg-blue-600/15 border-blue-500/30 text-blue-200"
                    : "bg-slate-950/10 border-slate-800 text-slate-300 hover:bg-slate-900/40"
                }`}
              >
                <Icon size={16} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/20 p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="font-black text-lg">Listado</div>
          <div className="text-sm text-slate-400">{filtered.length} elemento(s)</div>
        </div>

        <div className="space-y-3">
          {filtered.map((f) => (
            <FileRow
              key={f.id}
              fileMeta={f}
              onDelete={() => onDeleteFile(f)}
            />
          ))}

          {filtered.length === 0 && (
            <div className="text-slate-400 text-sm p-6 text-center border border-dashed border-slate-800 rounded-2xl">
              No hay archivos en esta carpeta.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------
// Settings Page
// -------------------------
function SettingsPage({ user, cfg, setCfg }) {
  const [academyName, setAcademyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  // Estado local para subjects (para edición)
  const [subjects, setSubjects] = useState([]);
  const [newSubjectName, setNewSubjectName] = useState("");

  // Sincronizar form con props al cargar
  useEffect(() => {
    setAcademyName(cfg.academyName || "");
    setLogoUrl(cfg.logoUrl || "");
    setSubjects(cfg.subjects || []);
  }, [cfg]);

  const onSave = async () => {
    const next = {
      ...cfg,
      academyName: academyName.trim() || "Academia",
      logoUrl: logoUrl.trim(),
      subjects
    };
    
    // Guardar en Firestore
    await saveUserConfig(user.uid, next);
    // Actualizar estado local (optimista o esperar a reload, aquí actualizamos directo)
    setCfg(next);
    alert("✅ Configuración guardada en la nube.");
  };

  const addSubject = () => {
    const name = newSubjectName.trim();
    if (!name) return;
    const id = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const finalId = id || uid("subject");
    if (subjects.some((s) => s.id === finalId)) {
      alert("Ese ID ya existe. Cambia el nombre.");
      return;
    }
    setSubjects((prev) => [...prev, { id: finalId, name }]);
    setNewSubjectName("");
  };

  const removeSubject = (id) => {
    if (!window.confirm("¿Eliminar materia?")) return;
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="text-slate-400 text-sm">
        Herramientas <ChevronRight className="inline" size={14} /> Configuración
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6 shadow-soft">
        <div className="font-black text-3xl">Configuración</div>
        <p className="text-slate-300 mt-2">
          Define el nombre de la academia y las materias. Se sincroniza con tu cuenta.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/20 p-6">
          <div className="font-black text-lg mb-4">Academia</div>

          <div className="space-y-4">
            <Field label="Nombre de la Academia">
              <input
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/30 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                value={academyName}
                onChange={(e) => setAcademyName(e.target.value)}
              />
            </Field>

            <Field label="Logo URL (opcional)">
              <input
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/30 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
              />
            </Field>

            <button
              onClick={onSave}
              className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 transition px-4 py-3 font-black mt-4"
            >
              Guardar configuración en la Nube
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/20 p-6">
          <div className="font-black text-lg mb-4">Materias</div>

          <div className="flex gap-2">
            <input
              className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/30 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Ej. Cálculo Integral"
            />
            <button
              onClick={addSubject}
              className="rounded-2xl px-4 py-3 bg-white text-slate-900 font-black hover:opacity-90 transition inline-flex items-center gap-2"
            >
              <Plus size={18} />
              Agregar
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {subjects.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/20 p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-bold truncate">{s.name}</div>
                  <div className="text-xs text-slate-400">ID: {s.id}</div>
                </div>
                <button
                  onClick={() => removeSubject(s.id)}
                  className="h-10 w-10 rounded-2xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition flex items-center justify-center"
                  title="Eliminar materia"
                >
                  <Trash2 size={16} className="text-red-200" />
                </button>
              </div>
            ))}

            {subjects.length === 0 && (
              <div className="text-slate-400 text-sm p-6 text-center border border-dashed border-slate-800 rounded-2xl">
                No hay materias. Agrega una.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-sm font-bold text-slate-300 mb-2">{label}</div>
      {children}
    </div>
  );
}

// -------------------------
// Helpers
// -------------------------
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}
