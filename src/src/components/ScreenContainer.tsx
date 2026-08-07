import React from "react";
import { View, StyleSheet } from "react-native";

type Props = {
  children: React.ReactNode;
};

export default function ScreenContainer({
  children,
}: Props) {
  return (
    <View style={styles.container}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
});