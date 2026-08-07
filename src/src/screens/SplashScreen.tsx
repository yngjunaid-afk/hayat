import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";

import ScreenContainer from "../components/ScreenContainer";
import { COLORS } from "../constants/colors";

export default function SplashScreen() {
  const navigation = useNavigation<any>();

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View style={styles.logoSection}>
          <Image
            source={require("../../assets/images/hayat-logo.png")}
            style={styles.logoImage}
            contentFit="contain"
          />

          <Text style={styles.tagline}>
            Music for your life.
          </Text>

          <Text style={styles.subTagline}>
            Play what you feel.
          </Text>
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("Register")}
          >
            <Text style={styles.buttonText}>
              Let's Begin
            </Text>
          </TouchableOpacity>

          <View style={styles.signInRow}>
            <Text style={styles.loginText}>
              Already have an account?
            </Text>

            <TouchableOpacity
              onPress={() => navigation.navigate("Login")}
            >
              <Text style={styles.loginLink}>
                Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 60,
  },

  logoSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  logoImage: {
    width: 320,
    height: 140,
  },

  tagline: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.primary,
  },

  subTagline: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.secondaryText,
  },

  bottomSection: {
    width: "100%",
    marginBottom: 20,
  },

  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  signInRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },

  loginText: {
    color: COLORS.secondaryText,
    marginRight: 5,
  },

  loginLink: {
    color: COLORS.primary,
    fontWeight: "700",
  },
});