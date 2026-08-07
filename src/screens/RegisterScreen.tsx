import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";

import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import ScreenContainer from "../components/ScreenContainer";
import { COLORS } from "../constants/colors";

import {
  registerUser,
  googleLogin,
} from "../services/authService";

export default function RegisterScreen() {
  const navigation = useNavigation<any>();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);

  const handleRegister = async () => {
    if (
      !username.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      Alert.alert(
        "Missing Information",
        "Please fill all fields."
      );
      return;
    }

    try {
      await registerUser(
        email.trim(),
        password,
        username.trim()
      );

      navigation.replace(
        "VerifyEmail",
        {
          email: email.trim(),
        }
      );
    } catch (error: any) {
      console.log(error);

      switch (error.code) {
        case "auth/email-already-in-use":
          Alert.alert(
            "Email Already Used",
            "An account already exists with this email."
          );
          break;

        case "auth/invalid-email":
          Alert.alert(
            "Invalid Email",
            "Please enter a valid email address."
          );
          break;

        case "auth/weak-password":
          Alert.alert(
            "Weak Password",
            "Password must be at least 6 characters."
          );
          break;

        default:
          Alert.alert(
            "Registration Failed",
            error.message
          );
      }
    }
  };

  const handleGoogleSignup = async () => {
    try {
      await googleLogin();

      Alert.alert(
        "Success",
        "Google account connected successfully!"
      );
    } catch (error: any) {
      console.log(error);

      Alert.alert(
        "Google Sign Up Failed",
        error.message
      );
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title}>
          Create Account
        </Text>

        <View style={styles.socialContainer}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogleSignup}
          >
            <Image
              source={require("../../assets/images/google.png")}
              style={styles.googleLogo}
              contentFit="contain"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={() =>
              navigation.navigate("PhoneLogin")
            }
          >
            <Ionicons
              name="call"
              size={28}
              color="#000"
            />
          </TouchableOpacity>
        </View>

        <TextInput
          placeholder="Username"
          autoCapitalize="none"
          style={styles.input}
          value={username}
          onChangeText={setUsername}
        />

        <TextInput
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />

        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Password"
            secureTextEntry={!showPassword}
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            onPress={() =>
              setShowPassword(!showPassword)
            }
          >
            <Ionicons
              name={
                showPassword
                  ? "eye-off"
                  : "eye"
              }
              size={22}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleRegister}
        >
          <Text style={styles.buttonText}>
            Register
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            navigation.navigate("Login")
          }
        >
          <Text style={styles.loginText}>
            Already have an account? Login
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 25,
    color: COLORS.text,
  },

  socialContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 25,
  },

  socialButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  googleLogo: {
    width: 35,
    height: 35,
  },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 15,
    backgroundColor: COLORS.white,
  },

  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 15,
    backgroundColor: COLORS.white,
  },

  passwordInput: {
    flex: 1,
    paddingVertical: 16,
  },

  button: {
    backgroundColor: COLORS.primary,
    padding: 18,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 10,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  loginText: {
    marginTop: 25,
    textAlign: "center",
    color: COLORS.primary,
    fontWeight: "600",
  },
});