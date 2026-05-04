import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/components/ui/ThemeContext";
import { router } from "expo-router";

export default function ReflectionsScreen() {
  const { colors: Colors } = useTheme();

  const [reflection, setReflection] = useState("");
  const [reflections, setReflections] = useState<string[]>([]);

  const handleSave = () => {
    const trimmed = reflection.trim();
    if (!trimmed) return;

    // Add to list (newest first)
    setReflections((prev) => [trimmed, ...prev]);

    // Clear input
    setReflection("");
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={Colors.text} />
        <Text style={[styles.backText, { color: Colors.text }]}>Tilbake</Text>
        </TouchableOpacity>
      <View style={styles.header}>
        <Ionicons name="create-outline" size={26} color={Colors.primary} />
        <Text style={[styles.title, { color: Colors.text }]}>
          Refleksjoner
        </Text>
      </View>

      <Text style={[styles.subtitle, { color: Colors.mutedText }]}>
        Skriv ned tanker, følelser eller noe du la merke til i dag.
      </Text>

      {/* Input */}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: Colors.card,
            borderColor: Colors.border,
            color: Colors.text,
          },
        ]}
        placeholder="Hva legger du merke til?"
        placeholderTextColor={Colors.mutedText}
        value={reflection}
        onChangeText={setReflection}
        multiline
        textAlignVertical="top"
      />

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: Colors.primary }]}
        activeOpacity={0.9}
        onPress={handleSave}
      >
        <Text style={[styles.buttonText, { color: Colors.white }]}>
          Lagre refleksjon
        </Text>
      </TouchableOpacity>

      {/* Reflection List */}
      <View style={styles.list}>
        {reflections.length === 0 ? (
          <Text style={[styles.emptyText, { color: Colors.mutedText }]}>
            Ingen refleksjoner enda.
          </Text>
        ) : (
          reflections.map((item, index) => (
            <View
              key={`${item}-${index}`}
              style={[
                styles.reflectionCard,
                {
                  backgroundColor: Colors.card,
                  borderColor: Colors.border,
                },
              ]}
            >
              <Text style={[styles.reflectionTitle, { color: Colors.text }]}>
                Refleksjon {reflections.length - index}
              </Text>

              <Text
                style={[styles.reflectionText, { color: Colors.mutedText }]}
              >
                {item}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 120,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },

  title: {
    fontSize: 32,
    fontWeight: "700",
  },

  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },

  input: {
    minHeight: 180,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },

  button: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },

  list: {
    gap: 12,
  },

  emptyText: {
    textAlign: "center",
    marginTop: 10,
    fontSize: 15,
  },

  reflectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },

  reflectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },

  reflectionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  backButton: {
  flexDirection: "row",
  alignItems: "center",
  alignSelf: "flex-start",
  marginBottom: 24,
},
backText: {
  fontSize: 16,
  fontWeight: "600",
},
});