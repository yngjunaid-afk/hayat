import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "./firebase";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone: string;
  avatar: string;
  bio: string;
  premium: boolean;
  createdAt?: any;
}

async function createUserDocument(user: User) {
  const userRef = doc(db, "users", user.uid);

  const existingUser = await getDoc(userRef);

  if (existingUser.exists()) {
    return;
  }

  const profile: UserProfile = {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    phone: user.phoneNumber ?? "",
    avatar: "",
    bio: "",
    premium: false,
    createdAt: serverTimestamp(),
  };

  await setDoc(userRef, profile);
}

export const registerUser = async (
  email: string,
  password: string,
  displayName: string
) => {
  const result = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  if (displayName.trim()) {
    await updateProfile(result.user, {
      displayName,
    });
  }

  await createUserDocument(result.user);

  if (displayName.trim()) {
    await updateDoc(doc(db, "users", result.user.uid), {
      displayName,
    });
  }

  return result.user;
};

export const loginUser = async (
  email: string,
  password: string
) => {
  const result = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  await createUserDocument(result.user);

  return result.user;
};

export const googleLogin = async () => {
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  const result = await signInWithPopup(
    auth,
    provider
  );

  await createUserDocument(result.user);

  return result.user;
};

export const logoutUser = async () => {
  await signOut(auth);
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

export const updateUserProfile = async (data: {
  displayName?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
}) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("No authenticated user.");
  }

  if (data.displayName !== undefined) {
    await updateProfile(user, {
      displayName: data.displayName,
    });
  }

  const updateData: any = {};

  if (data.displayName !== undefined)
    updateData.displayName = data.displayName;

  if (data.phone !== undefined)
    updateData.phone = data.phone;

  if (data.avatar !== undefined)
    updateData.avatar = data.avatar;

  if (data.bio !== undefined)
    updateData.bio = data.bio;

  if (Object.keys(updateData).length > 0) {
    await updateDoc(
      doc(db, "users", user.uid),
      updateData
    );
  }
};

export const ensureUserDocument = async () => {
  const user = auth.currentUser;

  if (!user) return;

  await createUserDocument(user);
};