import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function NameScreen() {
  const [name, setName] = useState("");

  const canContinue = useMemo(() => name.trim().length > 0, [name]);

  const handleContinue = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    router.replace({
      pathname: "/(tabs)",
      params: { name: trimmedName },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Hva skal vi kalle deg?</Text>
          <Text style={styles.subtitle}>
            Du kan bruke fornavnet ditt, et kallenavn eller noe helt anonymt.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Skriv navnet ditt her"
            placeholderTextColor="#94a3b8"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={styles.subtitle}>
            Dette kan endres senere.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, !canContinue && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={styles.buttonText}>Fortsett</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: "#0f172a",
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 28,
  },
  input: {
    backgroundColor: "#1e293b",
    color: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});