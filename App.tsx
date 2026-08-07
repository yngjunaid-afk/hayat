import React, { useEffect, useState } from "react";

import { NavigationContainer } from "@react-navigation/native";

import { onAuthStateChanged } from "firebase/auth";

import { auth } from "./src/services/firebase";

import AuthStack from "./src/navigation/AuthStack";
import { PlayerProvider } from "./src/context/PlayerContext";
import { setAudioModeAsync } from "expo-audio";
import MainStack from "./src/navigation/MainStack";
export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      }
    );
    
    setAudioModeAsync({
      shouldPlayInBackground: true,
      playsInSilentMode: true,
    }).catch(console.error);
    return unsubscribe;
  }, []);

  if (loading) {
    return null;
  }

  return (
    <PlayerProvider>

       <NavigationContainer>

        {user ? <MainStack /> : <AuthStack />}

       </NavigationContainer>

    </PlayerProvider>
  );
}