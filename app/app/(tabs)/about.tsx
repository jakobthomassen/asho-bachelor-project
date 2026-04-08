import { StyleSheet, Text, View } from "react-native";

export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>About ASHO</Text>
      <Text style={styles.subtitle}>Information about the chatbot app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
  },
});