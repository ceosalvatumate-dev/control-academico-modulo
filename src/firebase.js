import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; 

// Tu configuración exacta (NO MODIFICAR)
const firebaseConfig = {
  apiKey: "AIzaSyAiDO7WlA_42qNlTMOWaQL5t3yN41pPwHI",
  authDomain: "repositorio-salva-tu-mate-am.firebaseapp.com",
  projectId: "repositorio-salva-tu-mate-am",
  storageBucket: "repositorio-salva-tu-mate-am.firebasestorage.app",
  messagingSenderId: "838491712528",
  appId: "1:838491712528:web:e4e7b01e5073dc17266e95"
};

// Inicializar la app
const app = initializeApp(firebaseConfig);

// Inicializar y EXPORTAR los servicios (Esto es lo que faltaba)
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app); // Indispensable para subir archivos

export default app;
