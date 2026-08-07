import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";

import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import ScreenContainer from "../components/ScreenContainer";
import { COLORS } from "../constants/colors";
import { loginUser, googleLogin } from "../services/authService";

export default function LoginScreen() {
  const navigation = useNavigation<any>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingEmailLogin, setLoadingEmailLogin] =
    useState(false);
  const [loadingGoogleLogin, setLoadingGoogleLogin] =
    useState(false);

  const handleLogin = async () => {
    const cleanEmail = email.trim();
    const cleanPassword = password;

    if (!cleanEmail || !cleanPassword) {
      Alert.alert(
        "Missing details",
        "Please enter both email and password."
      );
      return;
    }

    try {
      setLoadingEmailLogin(true);

      await loginUser(cleanEmail, cleanPassword);

      Alert.alert(
        "Success",
        "Logged in successfully!"
      );
    } catch (error: any) {
      let message = "Login failed.";

      if (error?.code === "auth/user-not-found") {
        message = "No account found with this email.";
      } else if (error?.code === "auth/wrong-password") {
        message = "Incorrect password.";
      } else if (error?.code === "auth/invalid-email") {
        message = "Invalid email address.";
      } else if (error?.code === "auth/invalid-credential") {
        message = "Incorrect email or password.";
      } else if (error?.code === "auth/too-many-requests") {
        message = "Too many attempts. Try again later.";
      }

      Alert.alert("Login Failed", message);
    } finally {
      setLoadingEmailLogin(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoadingGoogleLogin(true);

      await googleLogin();

      Alert.alert(
        "Success",
        "Google login successful!"
      );
    } catch (error: any) {
      let message = "Google login failed.";

      if (error?.code === "auth/popup-closed-by-user") {
        message = "Google popup was closed.";
      } else if (error?.code === "auth/cancelled-popup-request") {
        message = "Google login was cancelled.";
      } else if (error?.message) {
        message = error.message;
      }

      Alert.alert("Google Login Failed", message);
    } finally {
      setLoadingGoogleLogin(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      "Forgot Password",
      "Password reset screen will be added next."
    );
  };

  const handlePhoneLogin = () => {
    navigation.navigate("PhoneLogin");
  };

  const handleRegister = () => {
    navigation.navigate("Register");
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <Image
              source={require("../../assets/images/hayat-logo.png")}
              style={styles.logo}
              contentFit="contain"
            />

            <Text style={styles.title}>
              Welcome Back
            </Text>

            <Text style={styles.subtitle}>
              Sign in to continue to Hayat.
            </Text>

            <View style={styles.card}>
              <View style={styles.inputWrap}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={COLORS.secondaryText}
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="Email"
                  placeholderTextColor={COLORS.secondaryText}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={COLORS.secondaryText}
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="Password"
                  placeholderTextColor={COLORS.secondaryText}
                  secureTextEntry
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleLogin}
                disabled={loadingEmailLogin}
                activeOpacity={0.85}
              >
                {loadingEmailLogin ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Login
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.forgotButton}
                onPress={handleForgotPassword}
              >
                <Text style={styles.forgotText}>
                  Forgot password?
                </Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {loadingGoogleLogin ? (
                <ActivityIndicator color={COLORS.text} style={{ marginBottom: 12 }} />
              ) : (
                <TouchableOpacity
                  style={styles.googleIconButton}
                  onPress={handleGoogleLogin}
                  disabled={loadingGoogleLogin}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="logo-google"
                    size={24}
                    color={COLORS.text}
                  />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.phoneIconButton}
                onPress={handlePhoneLogin}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="call-outline"
                  size={24}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.bottomLinks}>
              <TouchableOpacity onPress={handleRegister}>
                <Text style={styles.registerText}>
                  Don't have an account? Register
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },

  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },

  logo: {
    width: 280,
    height: 120,
    alignSelf: "center",
    marginBottom: 8,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    color: COLORS.text,
    marginTop: 8,
  },

  subtitle: {
    textAlign: "center",
    color: COLORS.secondaryText,
    marginTop: 8,
    marginBottom: 22,
    lineHeight: 21,
  },

  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 18,
  },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 14,
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    minHeight: 52,
    color: COLORS.text,
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    minHeight: 54,
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  forgotButton: {
    alignSelf: "center",
    marginTop: 14,
    paddingVertical: 6,
  },

  forgotText: {
    color: COLORS.primary,
    fontWeight: "700",
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },

  dividerText: {
    marginHorizontal: 12,
    color: COLORS.secondaryText,
    fontWeight: "700",
  },

  googleIconButton: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 999,
    marginBottom: 12,
  },

  phoneIconButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4E6E0",
    padding: 14,
    borderRadius: 999,
  },

  bottomLinks: {
    marginTop: 18,
    alignItems: "center",
  },

  registerText: {
    color: COLORS.primary,
    fontWeight: "700",
  },
});