import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/components/ui/ThemeContext";

export default function UroskolenScreen() {
  const { colors: Colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={[styles.back, { color: Colors.text }]}>‹ Tilbake</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: Colors.text }]}>Uroskolen</Text>

      <Text style={[styles.text, { color: Colors.mutedText }]}>
        Et fordypningsløp i seks moduler for deg som vil fordype din egen praksis
        — og utforske muligheten for å bringe dette videre til andre.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 72 },
  back: { fontSize: 16, fontWeight: "600", marginBottom: 28 },
  title: { fontSize: 36, fontWeight: "700", marginBottom: 16 },
  text: { fontSize: 17, lineHeight: 26 },
});