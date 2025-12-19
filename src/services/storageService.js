import { ref, getDownloadURL, uploadBytesResumable, deleteObject } from "firebase/storage";
import { storage } from "../firebase";

/**
 * Sube un archivo con monitoreo de progreso.
 * @param {File} file - El archivo a subir
 * @param {string} path - Ruta en storage (ej: 'materias/calculo/tareas')
 * @param {function} onProgress - Callback que recibe el % (0-100)
 * @returns {Promise<string>} - URL de descarga
 */
export function uploadFileWithProgress(file, folderPath, onProgress) {
  return new Promise((resolve, reject) => {
    // Referencia única: folderPath / timestamp_nombre
    const storageRef = ref(storage, `${folderPath}/${Date.now()}_${file.name}`);
    
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => {
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
}

export async function deleteFileFromStorage(url) {
  if (!url) return;
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch (error) {
    console.warn("Error borrando de Storage (puede que no exista):", error);
  }
}
