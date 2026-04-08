import React from "react";
import { StyleSheet, View } from "react-native";

type Props = {
  count: number;
  currentIndex: number;
};

export default function IntroDots({ count, currentIndex }: Props) {
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[styles.dot, currentIndex === index && styles.activeDot]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#475569",
  },
  activeDot: {
    backgroundColor: "#2563eb",
    width: 18,
  },
});