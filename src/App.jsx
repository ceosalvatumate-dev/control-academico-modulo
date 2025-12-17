import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutGrid,
  BookOpen,
  FlaskConical,
  Code2,
  ClipboardList,
  Archive,
  Settings,
  Bell,
  Search,
  UploadCloud,
  Filter,
  ArrowUpDown,
  ChevronRight,
  Download,
  PlusCircle,
  CalendarDays,
  Sigma,
  BadgeCheck,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  LogOut,
  Lock,
  Save,
  Trash2,
  Plus,
} from "lucide-react";

/**
 * ✅ Importante sobre seguridad:
 * - Este proyecto es un SPA (Vite/React). Un “login” solo en frontend NO es 100% seguro
 *   (cualquier contraseña embebida en el build puede llegar a verse).
 * - Para seguridad real, te recomiendo activar “Password Protection / Deployment Protection”
 *   en Vercel (si tu plan lo permite), o migrar el login a backend/Next.js/Firebase Auth.
 *
 * Aun así, incluimos un “acceso” simple para evitar que cualquier persona entre por accidente.
 * Puedes definir un código en Vercel con la variable: VITE_ACCESS_CODE
 */

const cx = (...c) => c.filter(Boolean).join(" ");

const DEFAULT_CONFIG = {
  academyName: "Academic Hub",
  subtitle: "Repositorio v2.0",
  logoUrl: "", // pega una URL (png/jpg/svg) o déjalo vacío
  subjects: [
    { key: "algebra", label: "Álgebra", icon: "Sigma" },
    { key: "physics", label: "Física 202", icon: "FlaskConical" },
    { key: "cs301", label: "CS 301", icon: "Code2" },
  ],
};

const ICONS = {
  Sigma,
  FlaskConical,
  Code2,
  BookOpen,
  ClipboardList,
  Archive,
  FileText,
  FileSpreadsheet,
  BadgeCheck,
};

const STORAGE_KEYS = {
  config: "ahub_config_v1",
  session: "ahub_session_ok",
};

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.config);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      subjects: Array.isArray(parsed.subjects) && parsed.subjects.length ? parsed.subjects : DEFAULT_CONFIG.subjects,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(cfg));
}

function getIconByName(name) {
  return ICONS[name] || BookOpen;
}

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-500/10 text-slate-200 border-slate-400/10",
    green: "bg-emerald-500/10 text-emerald-200 border-emerald-400/10",
    red: "bg-rose-500/10 text-rose-200 border-rose-400/10",
    blue: "bg-blue-500/10 text-blue-200 border-blue-400/10",
  };
  return (
    <span className={cx("inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs", tones[tone])}>
      {children}
    </span>
  );
}

function SoftButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-400/10 bg-white/5 hover:bg-white/10 transition text-sm text-slate-200",
        className
      )}
    >
      {children}
    </button>
  );
}

function Card({ className = "", children }) {
  return <div className={cx("glass rounded-2xl shadow-soft", className)}>{children}</div>;
}

function Logo({ config }) {
  if (config.logoUrl?.trim()) {
    return (
      <img
        src={config.logoUrl.trim()}
        alt="Logo"
        className="h-11 w-11 rounded-2xl object-cover border border-slate-400/10"
      />
    );
  }
  return (
    <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-soft">
      <BookOpen className="opacity-90" size={20} />
    </div>
  );
}

function AccessGate({ config, onOk }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const required = (import.meta.env.VITE_ACCESS_CODE || "").trim();
  const hasRequired = required.length > 0;

  const handle = () => {
    setErr("");
    // Si no hay VITE_ACCESS_CODE, dejamos entrar (pero avisamos).
    if (!hasRequired) {
      onOk();
      return;
    }
    if (code.trim() === required) {
      sessionStorage.setItem(STORAGE_KEYS.session, "1");
      onOk();
    } else {
      setErr("Código incorrecto.");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="glass rounded-3xl shadow-card w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-slate-400/10 flex items-center gap-3">
          <Logo config={config} />
          <div>
            <div className="font-bold text-lg">{config.academyName}</div>
            <div className="text-xs text-slate-400">Acceso seguro</div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm text-slate-300">
            {hasRequired
              ? "Ingresa tu código de acceso para entrar."
              : "⚠️ No hay código configurado aún. En Vercel agrega la variable VITE_ACCESS_CODE para proteger este sitio."}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Código</label>
            <div className="flex items-center gap-2">
              <div className="h-11 w-11 rounded-xl bg-white/5 border border-slate-400/10 flex items-center justify-center">
                <Lock size={18} className="text-slate-300" />
              </div>
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="••••••••"
                className="flex-1 glass rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-200 placeholder:text-slate-500"
              />
            </div>
            {err && <div className="text-rose-300 text-sm">{err}</div>}
          </div>

          <button
            onClick={handle}
            className="w-full bg-white text-slate-900 rounded-xl px-5 py-3 font-bold hover:bg-slate-100 transition shadow-soft"
          >
            Entrar
          </button>

          <div className="text-xs text-slate-500">
            Tip: Para seguridad real (no solo “gate”), activa Password Protection en Vercel o usa Auth con backend.
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ config, setConfig }) {
  const [draft, setDraft] = useState(config);
  const [msg, setMsg] = useState("");

  useEffect(() => setDraft(config), [config]);

  const addSubject = () => {
    const key = `materia_${Date.now()}`;
    setDraft((d) => ({
      ...d,
      subjects: [...d.subjects, { key, label: "Nueva materia", icon: "BookOpen" }],
    }));
  };

  const updateSubject = (idx, patch) => {
    setDraft((d) => {
      const next = [...d.subjects];
      next[idx] = { ...next[idx], ...patch };
      return { ...d, subjects: next };
    });
  };

  const removeSubject = (idx) => {
    setDraft((d) => {
      const next = d.subjects.filter((_, i) => i !== idx);
      return { ...d, subjects: next.length ? next : DEFAULT_CONFIG.subjects };
    });
  };

  const handleSave = () => {
    setMsg("");
    const cleaned = {
      ...draft,
      academyName: (draft.academyName || "").trim() || DEFAULT_CONFIG.academyName,
      subtitle: (draft.subtitle || "").trim() || DEFAULT_CONFIG.subtitle,
      logoUrl: (draft.logoUrl || "").trim(),
      subjects: (draft.subjects || []).map((s) => ({
        key: (s.key || "").trim() || `materia_${Math.random().toString(16).slice(2)}`,
        label: (s.label || "").trim() || "Materia",
        icon: s.icon || "BookOpen",
      })),
    };
    saveConfig(cleaned);
    setConfig(cleaned);
    setMsg("✅ Configuración guardada.");
    setTimeout(() => setMsg(""), 2500);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-bold">Configuración</div>
            <div className="text-slate-400 text-sm">
              Personaliza el nombre de la academia, logo y materias. (Se guarda en este navegador.)
            </div>
          </div>
          <button
            onClick={handleSave}
            className="bg-white text-slate-900 rounded-full px-5 py-3 font-bold flex items-center gap-2 hover:bg-slate-100 transition shadow-soft"
          >
            <Save size={18} /> Guardar
          </button>
        </div>

        {msg && <div className="mt-4 text-emerald-200 bg-emerald-500/10 border border-emerald-400/10 rounded-xl p-3">{msg}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Nombre de la academia</label>
            <input
              value={draft.academyName}
              onChange={(e) => setDraft({ ...draft, academyName: e.target.value })}
              className="w-full glass rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="Ej. Academia Salvatumate"
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Subtítulo</label>
            <input
              value={draft.subtitle}
              onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
              className="w-full glass rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="Ej. Repositorio v1.0"
            />
          </div>

          <div className="space-y-3 lg:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">URL del logo</label>
            <input
              value={draft.logoUrl}
              onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })}
              className="w-full glass rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="https://.../logo.png"
            />
            <div className="text-xs text-slate-500">
              Tip: pega una URL pública (por ejemplo desde tu hosting o una imagen en tu dominio).
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xl font-bold">Materias</div>
            <div className="text-slate-400 text-sm">Agrega, renombra o elimina materias del sidebar.</div>
          </div>
          <button
            onClick={addSubject}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-400/10 bg-white/5 hover:bg-white/10 transition"
          >
            <Plus size={18} /> Agregar materia
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {draft.subjects.map((s, idx) => (
            <div key={s.key} className="p-4 rounded-2xl border border-slate-400/10 bg-white/5">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px_52px] gap-3 items-end">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Nombre</label>
                  <input
                    value={s.label}
                    onChange={(e) => updateSubject(idx, { label: e.target.value })}
                    className="w-full glass rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="Ej. Álgebra"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Icono</label>
                  <select
                    value={s.icon}
                    onChange={(e) => updateSubject(idx, { icon: e.target.value })}
                    className="w-full glass rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    {Object.keys(ICONS).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => removeSubject(idx)}
                  className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-400/10 hover:bg-rose-500/20 transition flex items-center justify-center"
                  title="Eliminar"
                >
                  <Trash2 size={18} className="text-rose-200" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Nota: Esta configuración se guarda en localStorage (por navegador). Luego podemos migrarlo a base de datos/Auth.
        </div>
      </Card>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState(() => loadConfig());

  const [view, setView] = useState("dashboard"); // dashboard | subject | settings
  const [activeSubject, setActiveSubject] = useState(config.subjects?.[0]?.key || "algebra");
  const [activeTab, setActiveTab] = useState("tasks");
  const [query, setQuery] = useState("");

  const [accessOk, setAccessOk] = useState(() => sessionStorage.getItem(STORAGE_KEYS.session) === "1");

  useEffect(() => {
    // si cambian las materias, ajusta selección
    if (!config.subjects.find((s) => s.key === activeSubject)) {
      setActiveSubject(config.subjects?.[0]?.key || "algebra");
    }
  }, [config.subjects, activeSubject]);

  const currentSubject = useMemo(
    () => config.subjects.find((s) => s.key === activeSubject) ?? config.subjects[0],
    [config.subjects, activeSubject]
  );

  const tabs = [
    { key: "tasks", label: "Lista de tareas", icon: ClipboardList },
    { key: "solutions", label: "Soluciones de tareas", icon: BadgeCheck },
    { key: "control", label: "Exámenes de control", icon: FileSpreadsheet },
    { key: "ets", label: "Exámenes ETS", icon: BookOpen },
    { key: "books", label: "Libros de referencia", icon: FileText },
  ];

  const tasks = [
    {
      id: "t1",
      title: "Operaciones con matrices — Set #3",
      subtitle: "Capítulo 4: Eigenvalores y Eigenvectores • 12 problemas",
      due: "Vence mañana",
      status: "pending",
      icon: Sigma,
    },
    {
      id: "t2",
      title: "Repaso: Espacios vectoriales (quiz)",
      subtitle: "Subespacios y base • Opcional",
      due: "Completada",
      status: "done",
      icon: BadgeCheck,
    },
    {
      id: "t3",
      title: "Hoja de trabajo: Determinantes",
      subtitle: "Propiedades • 20 problemas",
      due: "28 Oct",
      status: "scheduled",
      icon: BookOpen,
    },
  ];

  const uploads = [
    { id: "u1", title: "Control_Examen_2_Solución.pdf", meta: "hace 2 horas • 2.4 MB", icon: FileText, badge: "PDF" },
    { id: "u2", title: "Notas_Pizarrón_Nov2.png", meta: "ayer • 1.1 MB", icon: ImageIcon, badge: "IMG" },
    { id: "u3", title: "Guía_Estudio_Final.docx", meta: "28 Oct • 450 KB", icon: FileText, badge: "DOC" },
  ];

  // Gate (opcional) — si quieres quitarlo, cambia a true siempre.
  const USE_ACCESS_GATE = true;

  if (USE_ACCESS_GATE && !accessOk) {
    return <AccessGate config={config} onOk={() => setAccessOk(true)} />;
  }

  return (
    <div className="min-h-screen">
      {/* Fondo */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B1020] via-[#0B0F16] to-[#070A10]" />
        <div className="absolute -top-24 left-1/3 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute top-40 -left-24 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-slate-500/10 blur-3xl" />
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6 p-6">
        {/* SIDEBAR */}
        <aside className="glass rounded-2xl shadow-card overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-400/10">
            <div className="flex items-center gap-3">
              <Logo config={config} />
              <div className="leading-tight">
                <div className="font-bold text-lg">{config.academyName}</div>
                <div className="text-xs text-slate-400">{config.subtitle}</div>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-6 flex-1 overflow-auto">
            <div>
              <div className="text-[11px] tracking-widest text-slate-400/80 font-semibold mb-3">PRINCIPAL</div>
              <button
                onClick={() => setView("dashboard")}
                className={cx(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition",
                  view === "dashboard"
                    ? "bg-blue-500/10 border-blue-400/20 text-blue-200"
                    : "bg-transparent border-slate-400/10 hover:bg-white/5 text-slate-300"
                )}
              >
                <LayoutGrid size={18} className={view === "dashboard" ? "text-blue-300" : "text-slate-400"} />
                <span className="font-medium">Dashboard</span>
              </button>
            </div>

            <div>
              <div className="text-[11px] tracking-widest text-slate-400/80 font-semibold mb-3">MATERIAS</div>
              <div className="space-y-2">
                {config.subjects.map((s) => {
                  const active = s.key === activeSubject && view === "subject";
                  const Icon = getIconByName(s.icon);
                  return (
                    <button
                      key={s.key}
                      onClick={() => {
                        setActiveSubject(s.key);
                        setView("subject");
                      }}
                      className={cx(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition",
                        active
                          ? "bg-blue-500/10 border-blue-400/20 text-blue-200"
                          : "bg-transparent border-slate-400/10 hover:bg-white/5 text-slate-300"
                      )}
                    >
                      <Icon size={18} className={active ? "text-blue-300" : "text-slate-400"} />
                      <span className="font-medium">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[11px] tracking-widest text-slate-400/80 font-semibold mb-3">HERRAMIENTAS</div>
              <div className="space-y-2">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-400/10 hover:bg-white/5 transition text-slate-300">
                  <ClipboardList size={18} className="text-slate-400" />
                  ETS Prep
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-400/10 hover:bg-white/5 transition text-slate-300">
                  <Archive size={18} className="text-slate-400" />
                  Archivos
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-400/10">
              <button
                onClick={() => setView("settings")}
                className={cx(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition",
                  view === "settings"
                    ? "bg-blue-500/10 border-blue-400/20 text-blue-200"
                    : "bg-transparent border-slate-400/10 hover:bg-white/5 text-slate-300"
                )}
              >
                <Settings size={18} className={view === "settings" ? "text-blue-300" : "text-slate-400"} />
                Configuración
              </button>
            </div>
          </div>

          <div className="p-4 border-t border-slate-400/10">
            <button
              onClick={() => {
                sessionStorage.removeItem(STORAGE_KEYS.session);
                setAccessOk(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-400/10 hover:bg-white/5 transition text-slate-300"
              title="Cerrar acceso (solo este navegador)"
            >
              <LogOut size={18} className="text-slate-400" />
              Salir
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="space-y-6">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-400">
                {view === "settings" ? (
                  <>
                    Principal <span className="mx-2">›</span> <span className="text-blue-200">Configuración</span>
                  </>
                ) : view === "dashboard" ? (
                  <>
                    Principal <span className="mx-2">›</span> <span className="text-blue-200">Dashboard</span>
                  </>
                ) : (
                  <>
                    Materias <span className="mx-2">›</span> <span className="text-blue-200">{currentSubject?.label}</span>
                  </>
                )}
              </div>

              <div className="text-3xl font-bold">
                {view === "settings" ? "Configuración" : view === "dashboard" ? "Panel principal" : "Álgebra Lineal & Cálculo"}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative w-[420px] hidden md:block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={view === "subject" ? `Buscar en ${currentSubject?.label || "materia"}...` : "Buscar..."}
                  className="w-full glass rounded-full px-12 py-3 outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-200 placeholder:text-slate-500"
                />
              </div>

              <button className="glass rounded-full h-11 w-11 flex items-center justify-center hover:bg-white/10 transition">
                <Bell size={18} className="text-slate-300" />
              </button>
            </div>
          </div>

          {view === "settings" ? (
            <SettingsView config={config} setConfig={setConfig} />
          ) : (
            <>
              {/* Hero card */}
              <Card className="p-7">
                <div className="flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <Pill tone="green">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Curso activo
                    </Pill>

                    <div className="text-4xl font-extrabold">Álgebra Avanzada</div>
                    <div className="text-slate-400 max-w-2xl">
                      Repositorio integral para Álgebra Lineal I & II. Administra tus tareas, soluciones y preparación de exámenes desde aquí.
                    </div>

                    <div className="flex flex-wrap items-center gap-10 pt-3">
                      <div>
                        <div className="text-[11px] tracking-widest text-slate-500 font-semibold">PROGRESO</div>
                        <div className="text-xl font-bold">78%</div>
                      </div>
                      <div>
                        <div className="text-[11px] tracking-widest text-slate-500 font-semibold">PRÓXIMO EXAMEN</div>
                        <div className="text-xl font-bold text-rose-300">15 Nov</div>
                      </div>
                      <div>
                        <div className="text-[11px] tracking-widest text-slate-500 font-semibold">CRÉDITOS</div>
                        <div className="text-xl font-bold">4.0</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-start lg:justify-end">
                    <button className="bg-white text-slate-900 rounded-full px-6 py-3 font-bold flex items-center gap-3 hover:bg-slate-100 transition shadow-soft">
                      <UploadCloud size={18} />
                      Subir nuevo archivo
                    </button>
                  </div>
                </div>
              </Card>

              {/* Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {tabs.map((t) => {
                  const active = t.key === activeTab;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      className={cx(
                        "flex items-center gap-2 px-4 py-2 rounded-full border whitespace-nowrap transition",
                        active
                          ? "bg-blue-500/10 border-blue-400/20 text-blue-200"
                          : "bg-transparent border-slate-400/10 text-slate-300 hover:bg-white/5"
                      )}
                    >
                      <Icon size={16} className={active ? "text-blue-300" : "text-slate-400"} />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Content area */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
                {/* Left: tasks list */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-lg font-bold">Tareas pendientes</div>
                    <div className="flex items-center gap-2">
                      <SoftButton>
                        <Filter size={16} /> Filtrar
                      </SoftButton>
                      <SoftButton>
                        <ArrowUpDown size={16} /> Ordenar
                      </SoftButton>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {tasks.map((t) => {
                      const Icon = t.icon;
                      const statusPill =
                        t.status === "pending" ? (
                          <Pill tone="red">{t.due}</Pill>
                        ) : t.status === "done" ? (
                          <Pill tone="green">{t.due}</Pill>
                        ) : (
                          <Pill tone="slate">{t.due}</Pill>
                        );

                      return (
                        <div
                          key={t.id}
                          className="flex items-center gap-4 p-4 rounded-2xl border border-slate-400/10 bg-white/5 hover:bg-white/10 transition"
                        >
                          <div className="h-12 w-12 rounded-xl bg-white/5 border border-slate-400/10 flex items-center justify-center">
                            <Icon size={18} className="text-blue-300" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{t.title}</div>
                            <div className="text-sm text-slate-400 truncate">{t.subtitle}</div>
                          </div>

                          <div className="hidden md:flex items-center gap-3">
                            {statusPill}
                            <button className="h-9 w-9 rounded-full bg-white/5 border border-slate-400/10 hover:bg-white/10 flex items-center justify-center">
                              <Download size={16} className="text-slate-300" />
                            </button>
                            <button className="h-9 w-9 rounded-full bg-white/5 border border-slate-400/10 hover:bg-white/10 flex items-center justify-center">
                              <ChevronRight size={16} className="text-slate-300" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button className="w-full mt-5 py-3 rounded-2xl border border-slate-400/10 bg-white/5 hover:bg-white/10 transition text-slate-200 font-medium">
                    Ver todas las tareas
                  </button>
                </Card>

                {/* Right column */}
                <div className="space-y-6">
                  {/* Subject overview */}
                  <Card className="p-6">
                    <div className="font-bold mb-4">Resumen de la materia</div>

                    <div className="space-y-5">
                      <div>
                        <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
                          <span>Avance de tareas</span>
                          <span className="text-slate-200 font-semibold">12/15</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 border border-slate-400/10 overflow-hidden">
                          <div className="h-full w-[80%] bg-blue-500/70" />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
                          <span>Promedio de exámenes</span>
                          <span className="text-slate-200 font-semibold">8.5/10</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 border border-slate-400/10 overflow-hidden">
                          <div className="h-full w-[85%] bg-indigo-500/70" />
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Recent uploads */}
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="font-bold">Subidas recientes</div>
                      <button className="text-blue-200 hover:text-blue-100 text-sm font-semibold">Ver todo</button>
                    </div>

                    <div className="space-y-3">
                      {uploads.map((u) => {
                        const Icon = u.icon;
                        return (
                          <div
                            key={u.id}
                            className="flex items-center gap-3 p-3 rounded-2xl border border-slate-400/10 bg-white/5 hover:bg-white/10 transition"
                          >
                            <div className="h-11 w-11 rounded-xl bg-white/5 border border-slate-400/10 flex items-center justify-center">
                              <Icon size={18} className="text-slate-200" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">{u.title}</div>
                              <div className="text-xs text-slate-400 truncate">{u.meta}</div>
                            </div>
                            <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-slate-400/10 text-slate-300">
                              {u.badge}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <button className="glass rounded-2xl p-5 hover:bg-white/10 transition border border-slate-400/10 text-left">
                      <div className="h-10 w-10 rounded-xl bg-white/5 border border-slate-400/10 flex items-center justify-center mb-3">
                        <PlusCircle size={18} className="text-blue-300" />
                      </div>
                      <div className="font-bold">Nueva tarea</div>
                      <div className="text-xs text-slate-400">Crea una tarea y asígnala.</div>
                    </button>

                    <button className="glass rounded-2xl p-5 hover:bg-white/10 transition border border-slate-400/10 text-left">
                      <div className="h-10 w-10 rounded-xl bg-white/5 border border-slate-400/10 flex items-center justify-center mb-3">
                        <CalendarDays size={18} className="text-indigo-300" />
                      </div>
                      <div className="font-bold">Agenda</div>
                      <div className="text-xs text-slate-400">Organiza fechas y exámenes.</div>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
