import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/components/ui/ThemeContext";

export default function AudioPreviewCard({
  title,
  duration,
}: {
  title: string;
  duration: string;
}) {
  const { colors: Colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: Colors.card,
          borderColor: Colors.border,
        },
      ]}
      activeOpacity={0.85}
    >
      <View style={[styles.play, { backgroundColor: Colors.primary }]}>
        <Text style={[styles.playIcon, { color: Colors.white }]}>›</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: Colors.text }]}>{title}</Text>
        <View style={[styles.progress, { backgroundColor: Colors.border }]} />
        <Text style={[styles.duration, { color: Colors.mutedText }]}>
          {duration}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },

  play: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  playIcon: {
    fontSize: 28,
    fontWeight: "700",
  },

  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },

  progress: {
    height: 6,
    borderRadius: 999,
    marginBottom: 6,
  },

  duration: {
    fontSize: 14,
  },
});