import React, {
  useEffect,
} from "react";

import {
  View,
  Text,
  StyleSheet,
} from "react-native";

import {
  auth,
} from "../services/firebase";

import ScreenContainer from "../components/ScreenContainer";

import {
  COLORS,
} from "../constants/colors";

import {
  useNavigation,
} from "@react-navigation/native";

export default function VerifyEmailScreen() {
  const navigation =
    useNavigation<any>();

  useEffect(() => {
    const interval =
      setInterval(
        async () => {
          const user =
            auth.currentUser;

          if (!user) return;

          await user.reload();

          if (
            user.emailVerified
          ) {
            clearInterval(
              interval
            );

            navigation.replace(
              "Login"
            );
          }
        },
        3000
      );

    return () =>
      clearInterval(
        interval
      );
  }, []);

  return (
    <ScreenContainer>
      <View
        style={styles.container}
      >
        <Text
          style={styles.title}
        >
          Verification Email Sent
        </Text>

        <Text
          style={styles.text}
        >
          Please verify your email.
        </Text>

        <Text
          style={styles.text}
        >
          This screen will
          automatically continue
          after verification.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent:
        "center",
      alignItems:
        "center",
      padding: 24,
    },

    title: {
      fontSize: 24,
      fontWeight: "700",
      marginBottom: 20,
      color:
        COLORS.primary,
    },

    text: {
      textAlign:
        "center",
      marginBottom: 10,
      color:
        COLORS.secondaryText,
    },
  });