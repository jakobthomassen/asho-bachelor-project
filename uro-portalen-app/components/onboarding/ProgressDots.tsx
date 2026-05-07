import { View, StyleSheet } from "react-native";
import { useTheme } from "@/components/ui/ThemeContext";

export default function ProgressDots({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const { colors: Colors } = useTheme();

  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: Colors.border },
            i === current && { backgroundColor: Colors.primary },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  dot: {
    width: 30,
    height: 6,
    borderRadius: 999,
  },
});