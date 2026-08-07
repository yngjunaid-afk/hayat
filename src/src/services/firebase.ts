import { initializeApp } from "firebase/app";

import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAzG5z2w9qL2Kd9bdZumrU-2jK8SKVISBs",
  authDomain: "hayat-3c192.firebaseapp.com",
  projectId: "hayat-3c192",
  storageBucket: "hayat-3c192.firebasestorage.app",
  messagingSenderId: "176223151745",
  appId: "1:176223151745:web:4c47f147231bd16842cf80",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);

export const storage = getStorage(app);

export default app;