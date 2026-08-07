import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MainTabs from "./MainTabs";

import PlayerScreen from "../screens/PlayerScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SectionSongsScreen from "../screens/SectionSongsScreen";

const Stack = createNativeStackNavigator();

export default function MainStack() {
  return (
    <Stack.Navigator
      initialRouteName="Tabs"
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Bottom Tabs */}
      <Stack.Screen
        name="Tabs"
        component={MainTabs}
      />

      {/* Full Music Player */}
      <Stack.Screen
        name="Player"
        component={PlayerScreen}
        options={{
          animation: "slide_from_bottom",
        }}
      />

      {/* Profile Screen */}
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          animation: "slide_from_right",
        }}
      />

      {/* Section Songs Screen */}
      <Stack.Screen
        name="SectionSongs"
        component={SectionSongsScreen}
        options={{
          animation: "slide_from_right",
        }}
      />
    </Stack.Navigator>
  );
}