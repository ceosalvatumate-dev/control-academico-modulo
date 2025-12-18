// src/services/storageService.js

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "../firebase/firebase";

const storage = getStorage(app);

export const uploadFile = async (file, materia, tipo) => {
  if (!file) throw new Error("No se envió ningún archivo");

  const filePath = `materias/${materia}/${tipo}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, filePath);

  await uploadBytes(storageRef, file);

  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
};