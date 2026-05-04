import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/components/ui/ThemeContext";

export default function KursListeScreen() {
  const { colors: Colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      {/* Back */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={Colors.text} />
        <Text style={[styles.backText, { color: Colors.text }]}>Tilbake</Text>
      </TouchableOpacity>

      {/* Title */}
      <Text style={[styles.title, { color: Colors.text }]}>Kurs</Text>

      <Text style={[styles.subtitle, { color: Colors.mutedText }]}>
        Her vil kommende kurs vises når de er tilgjengelige.
      </Text>

      {/* Empty State */}
      <View
        style={[
          styles.emptyCard,
          {
            backgroundColor: Colors.card,
            borderColor: Colors.border,
          },
        ]}
      >
        <Ionicons name="calendar-outline" size={40} color={Colors.primary} />

        <Text style={[styles.emptyTitle, { color: Colors.text }]}>
          Ingen kurs enda
        </Text>

        <Text style={[styles.emptyText, { color: Colors.mutedText }]}>
          Nye kurs vil dukke opp her når de blir publisert.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },

  backText: {
    fontSize: 16,
    fontWeight: "600",
  },

  title: {
    fontSize: 36,
    fontWeight: "700",
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 28,
  },

  emptyCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 14,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});