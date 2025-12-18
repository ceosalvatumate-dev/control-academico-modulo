// src/services/storageService.js
// Firebase Storage uploader (producción)

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "../firebase"; // ✅ RUTA CORRECTA

const storage = getStorage(app);

/**
 * Sube un archivo a Firebase Storage y regresa su downloadURL
 * @param {File} file
 * @param {string} subjectId
 * @param {string} category
 */
export async function uploadFile(file, subjectId, category) {
  if (!file) throw new Error("No file provided");

  const path = `academicHub/${subjectId}/${category}/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, path);

  await uploadBytes(fileRef, file);
  const downloadURL = await getDownloadURL(fileRef);

  return downloadURL;
}
