import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";

import { supabase } from "./supabase";

import { auth, db } from "./firebase";

import { doc, updateDoc } from "firebase/firestore";

export async function pickAndUploadAvatar() {
  const permission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Gallery permission denied.");
  }

  const result =
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

  if (result.canceled) return null;

  const image = result.assets[0];

  const manipulated =
    await ImageManipulator.manipulateAsync(
      image.uri,
      [
        {
          resize: {
            width: 512,
            height: 512,
          },
        },
      ],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

  const base64 =
    await FileSystem.readAsStringAsync(
      manipulated.uri,
      {
        encoding: FileSystem.EncodingType.Base64,
      }
    );

  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not logged in.");
  }

  const filePath = `${user.uid}.jpg`;

  const bytes = Uint8Array.from(
    atob(base64),
    c => c.charCodeAt(0)
  );

  const { error } =
    await supabase.storage
      .from("avatars")
      .upload(filePath, bytes, {
        upsert: true,
        contentType: "image/jpeg",
      });

  if (error) throw error;

  const { data } =
    supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

  const avatarUrl = data.publicUrl;

  await updateDoc(
    doc(db, "users", user.uid),
    {
      avatar: avatarUrl,
    }
  );

  return avatarUrl;
}