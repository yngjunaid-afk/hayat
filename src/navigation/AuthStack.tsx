import React from "react";

import {
  createNativeStackNavigator,
} from "@react-navigation/native-stack";

import SplashScreen from "../screens/SplashScreen";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import PhoneLoginScreen from "../screens/PhoneLoginScreen";
import VerifyEmailScreen from "../screens/VerifyEmailScreen";
import SectionSongsScreen from "../screens/SectionSongsScreen";

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
      />

      <Stack.Screen
        name="Login"
        component={LoginScreen}
      />

      <Stack.Screen
        name="Register"
        component={RegisterScreen}
      />

      <Stack.Screen
        name="PhoneLogin"
        component={PhoneLoginScreen}
      />

      <Stack.Screen
        name="VerifyEmail"
        component={VerifyEmailScreen}
      />

      <Stack.Screen
        name="SectionSongs"
        component={SectionSongsScreen}
/>
    </Stack.Navigator>
  );
}