import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  deleteDoc,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../firebase"; // Ajusta ruta si es necesario

// -------------------------
// Configuración (Perfil/Materias)
// -------------------------

/**
 * Carga la configuración del usuario. Si no existe, devuelve defaults.
 */
export async function getUserConfig(uid) {
  const ref = doc(db, "users", uid, "app", "config");
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data();
  } else {
    // Configuración por defecto
    return {
      academyName: "Academia",
      logoUrl: "",
      admin: { email: "", password: "" },
      subjects: []
    };
  }
}

/**
 * Guarda o actualiza la configuración (merge).
 */
export async function saveUserConfig(uid, cfg) {
  const ref = doc(db, "users", uid, "app", "config");
  // Eliminamos campos undefined para evitar errores de Firestore
  const cleanCfg = JSON.parse(JSON.stringify(cfg)); 
  await setDoc(ref, cleanCfg, { merge: true });
}

// -------------------------
// Archivos (Metadata)
// -------------------------

/**
 * Escucha en tiempo real la colección de archivos del usuario.
 * Retorna la función unsubscribe.
 */
export function listenUserFiles(uid, callback) {
  const colRef = collection(db, "users", uid, "files");
  
  // onSnapshot se encarga de mantener la UI sincronizada entre dispositivos
  return onSnapshot(colRef, (snapshot) => {
    const files = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id // Aseguramos que el ID del doc sea parte del objeto
    }));
    callback(files);
  });
}

/**
 * Guarda la metadata de un archivo nuevo.
 * Usamos el mismo ID que generamos en el front (o el del archivo) como ID del documento.
 */
export async function addUserFile(uid, fileMeta) {
  const ref = doc(db, "users", uid, "files", fileMeta.id);
  await setDoc(ref, {
    ...fileMeta,
    createdAt: serverTimestamp() // Para ordenamiento consistente si se requiere
  });
}

/**
 * Elimina la metadata de un archivo.
 */
export async function deleteUserFile(uid, fileId) {
  const ref = doc(db, "users", uid, "files", fileId);
  await deleteDoc(ref);
}