import React from "react";
import { router } from "expo-router";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ColorPicker from "react-native-wheel-color-picker";
import { useTheme } from "../components/ThemeContext";

export default function AdminScreen() {
  const { backgroundColor, setBackgroundColor } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>ASHO Admin Panel</Text>
        <Text style={styles.subtitle}>Administrer appen her</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Statistikk</Text>
          <Text style={styles.cardText}>Antall brukere: 124</Text>
          <Text style={styles.cardText}>Antall samtaler: 892</Text>
          <Text style={styles.cardText}>Daglige aktive brukere: 37</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bakgrunnsfarge</Text>

          <View style={styles.pickerWrapper}>
            <ColorPicker
              color={backgroundColor}
              onColorChangeComplete={(color: string) => setBackgroundColor(color)}
              thumbSize={30}
              sliderSize={30}
              noSnap
              row={false}
            />
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.cardText}>Valgt farge:</Text>
            <View
              style={[styles.colorPreview, { backgroundColor }]}
            />
            <Text style={styles.hexText}>{backgroundColor}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Chatbot Prompts</Text>
          <Text style={styles.cardText}>- system prompt</Text>
          <Text style={styles.cardText}>- velkomstmelding</Text>
          <Text style={styles.cardText}>- trygghetsregler</Text>
          <Text style={styles.cardText}>- forslag til oppfølgingsspørsmål</Text>
        </View>

        <TouchableOpacity
          style={styles.previewButton}
          onPress={() => router.push("/(tabs)")}
        >
          <Text style={styles.previewButtonText}>Forhåndsvis hovedside</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#fff",
  },
  subtitle: {
    fontSize: 16,
    color: "#cbd5e1",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 18,
    padding: 18,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 10,
  },
  cardText: {
    color: "#cbd5e1",
    fontSize: 15,
    marginBottom: 6,
  },
  pickerWrapper: {
    height: 260,
    marginTop: 8,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  colorPreview: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fff",
  },
  hexText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  previewButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  previewButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});