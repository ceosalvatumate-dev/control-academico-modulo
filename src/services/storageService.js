import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

/**
 * Sube un archivo a Firebase Storage y devuelve su URL pública
 * @param {File} file
 * @param {string} subjectId
 * @param {string} category
 * @returns {Promise<string>}
 */
export async function uploadFile(file, subjectId, category) {
  try {
    const path = `subjects/${subjectId}/${category}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading file to Firebase Storage:", error);
    throw error;
  }
}
