import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// IMPORTANTE: Agregar esta línea de importación
import { getStorage } from "firebase/storage"; 

// Tu configuración de Firebase (NO LA BORRES, deja la que ya tenías con tus apiKeys)
// Si no tienes tu config a la mano, copiala de tu archivo anterior.
// const firebaseConfig = { ... }; 

// Si ya tienes la variable app inicializada:
// export const app = initializeApp(firebaseConfig);

// --- ESTO ES LO QUE TE FALTA SEGURO ---
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// ¡¡ESTA ES LA LÍNEA CLAVE QUE FALTA!!
// Sin esto, la app se rompe porque storageService la busca y no la encuentra.
export const storage = getStorage(app);
