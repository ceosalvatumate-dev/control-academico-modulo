// src/services/storageService.js
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/firebase";

/**
 * Sube un archivo a Firebase Storage y regresa su downloadURL
 * @param {File} file
 * @param {string} subjectId
 * @param {string} category
 */
export async function uploadFile(file, subjectId = "general", category = "general") {
  if (!file) throw new Error("No file provided");

  const safeSubject = String(subjectId || "general").trim();
  const safeCategory = String(category || "general").trim();
  const safeName = String(file.name || "file").replace(/[^\w.\-]+/g, "_");

  const path = `academicHub/${safeSubject}/${safeCategory}/${Date.now()}_${safeName}`;
  const fileRef = ref(storage, path);

  await uploadBytes(fileRef, file);
  const downloadURL = await getDownloadURL(fileRef);

  return downloadURL;
}
