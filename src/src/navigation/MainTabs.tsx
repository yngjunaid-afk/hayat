import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "../screens/HomeScreen";
import SearchScreen from "../screens/SearchScreen";
import LibraryScreen from "../screens/LibraryScreen";
import RoomsScreen from "../screens/RoomScreen";
import MiniPlayer from "../components/MiniPlayer";
import { COLORS } from "../constants/colors";

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            height: 70,
            backgroundColor: "#FFFFFF",
            borderTopWidth: 0,
            elevation: 10,
            shadowOpacity: 0.08,
            shadowRadius: 10,
            shadowOffset: {
              width: 0,
              height: -3,
            },
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: "#9A9A9A",
          tabBarIcon: ({ focused, color }) => {
            let iconName: keyof typeof Ionicons.glyphMap = "ellipse";

            switch (route.name) {
              case "Home":
                iconName = focused ? "home" : "home-outline";
                break;

              case "Search":
                iconName = focused ? "search" : "search-outline";
                break;

              case "Library":
                iconName = focused ? "musical-notes" : "musical-notes-outline";
                break;

              case "Rooms":
                iconName = focused ? "people" : "people-outline";
                break;
            }

            return <Ionicons name={iconName} size={26} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Search" component={SearchScreen} />
        <Tab.Screen name="Library" component={LibraryScreen} />
        <Tab.Screen name="Rooms" component={RoomsScreen} />
      </Tab.Navigator>

      <MiniPlayer />
    </>
  );
}