import { auth, db } from "./firebase";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

export async function getCurrentUserProfile() {
  const user = auth.currentUser;

  if (!user) return null;

  const snap = await getDoc(
    doc(db, "users", user.uid)
  );

  if (!snap.exists()) return null;

  return snap.data();
}

export async function updateAvatar(avatar: string) {
  const user = auth.currentUser;

  if (!user) return;

  await updateDoc(doc(db, "users", user.uid), {
    avatar
  });
}