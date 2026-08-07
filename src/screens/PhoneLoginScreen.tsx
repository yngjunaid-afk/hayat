import React, { useEffect, useState } from "react";
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
} from "react-native";

import { useNavigation } from "@react-navigation/native";
import type { ConfirmationResult } from "firebase/auth";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import ScreenContainer from "../components/ScreenContainer";
import { COLORS } from "../constants/colors";
import { initRecaptcha, sendPhoneOtp } from "../services/phoneAuthService";

export default function PhoneLoginScreen() {
  const navigation = useNavigation<any>();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    initRecaptcha("recaptcha-container");
  }, []);

  const handleSendCode = async () => {
    const cleanedPhone = phoneNumber.trim();

    if (!cleanedPhone) {
      Alert.alert("Missing phone number", "Enter your phone number.");
      return;
    }

    if (!cleanedPhone.startsWith("+")) {
      Alert.alert(
        "Invalid format",
        "Use international format like +919876543210."
      );
      return;
    }

    try {
      setLoading(true);

      const result = await sendPhoneOtp(cleanedPhone);
      setConfirmationResult(result);
      setCodeSent(true);

      Alert.alert(
        "OTP Sent",
        "Check your phone and enter the code here."
      );
    } catch (error: any) {
      Alert.alert(
        "Phone Login Failed",
        error?.message ?? "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const code = otp.trim();

    if (!confirmationResult) {
      Alert.alert("Missing OTP", "Please send the OTP first.");
      return;
    }

    if (!code) {
      Alert.alert("Missing OTP", "Enter the code you received.");
      return;
    }

    try {
      setLoading(true);

      await confirmationResult.confirm(code);

      Alert.alert("Success", "Logged in successfully!");
    } catch (error: any) {
      Alert.alert(
        "Verification Failed",
        error?.message ?? "Invalid code."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setOtp("");
    setConfirmationResult(null);
    setCodeSent(false);
    await handleSendCode();
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
              Phone Login
            </Text>

            <Text style={styles.subtitle}>
              Enter your phone number in international format and verify with OTP.
            </Text>

            <View style={styles.card}>
              <View style={styles.inputWrap}>
                <Ionicons
                  name="call-outline"
                  size={18}
                  color={COLORS.secondaryText}
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="+919876543210"
                  placeholderTextColor={COLORS.secondaryText}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSendCode}
                disabled={loading}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? "Sending..." : "Send OTP"}
                </Text>
              </TouchableOpacity>

              {codeSent ? (
                <>
                  <View style={styles.divider} />

                  <Text style={styles.sectionLabel}>
                    Enter the 6-digit code
                  </Text>

                  <View style={styles.inputWrap}>
                    <Ionicons
                      name="keypad-outline"
                      size={18}
                      color={COLORS.secondaryText}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder="OTP"
                      placeholderTextColor={COLORS.secondaryText}
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                      style={styles.input}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleVerifyCode}
                    disabled={loading}
                  >
                    <Text style={styles.primaryButtonText}>
                      {loading ? "Verifying..." : "Verify OTP"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleResend}
                    disabled={loading}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Resend code
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.backLink}
              onPress={() => navigation.navigate("Login")}
            >
              <Text style={styles.backLinkText}>
                Back to email login
              </Text>
            </TouchableOpacity>

            <View
              nativeID="recaptcha-container"
              style={styles.recaptchaContainer}
            />
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
    marginBottom: 10,
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
    marginTop: 2,
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 18,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
  },

  secondaryButton: {
    paddingVertical: 14,
    alignItems: "center",
  },

  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: "700",
  },

  backLink: {
    alignItems: "center",
    marginTop: 18,
  },

  backLinkText: {
    color: COLORS.primary,
    fontWeight: "700",
  },

  recaptchaContainer: {
    width: 1,
    height: 1,
    opacity: 0,
    marginTop: 1,
  },
});