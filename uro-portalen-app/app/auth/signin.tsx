import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/components/ui/ThemeContext";

export default function SignInScreen() {
  const { colors: Colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleContinue = () => {
    router.replace("/(tabs)/hjem");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: Colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: Colors.text }]}>Logg inn</Text>
        <Text style={[styles.subtitle, { color: Colors.mutedText }]}>
          Fortsett reisen din og få tilgang til Uro-portalen.
        </Text>

        <View style={styles.socials}>
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.socialButton,
              {
                borderColor: Colors.border,
                backgroundColor: Colors.card,
              },
              pressed && styles.socialButtonPressed,
            ]}
          >
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={[styles.socialText, { color: Colors.text }]}>
              Fortsett med Google
            </Text>
          </Pressable>

          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.socialButton,
              styles.appleButton,
              pressed && styles.appleButtonPressed,
            ]}
          >
            <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
            <Text style={styles.appleText}>Fortsett med Apple</Text>
          </Pressable>
        </View>

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: Colors.border }]} />
          <Text style={[styles.dividerText, { color: Colors.mutedText }]}>
            eller
          </Text>
          <View style={[styles.line, { backgroundColor: Colors.border }]} />
        </View>

        <View style={styles.form}>
          <View>
            <Text style={[styles.label, { color: Colors.text }]}>E-post</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: Colors.border,
                  backgroundColor: Colors.card,
                  color: Colors.text,
                },
              ]}
              placeholder="navn@epost.no"
              placeholderTextColor={Colors.mutedText}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View>
            <Text style={[styles.label, { color: Colors.text }]}>Passord</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: Colors.border,
                  backgroundColor: Colors.card,
                  color: Colors.text,
                },
              ]}
              placeholder="Skriv passord"
              placeholderTextColor={Colors.mutedText}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
        </View>

        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: Colors.primary },
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.buttonText, { color: Colors.white }]}>
            Fortsett
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {}}
          style={({ pressed }) => pressed && { opacity: 0.7 }}
        >
          <Text style={[styles.link, { color: Colors.mutedText }]}>
            Har du ikke konto? Opprett bruker
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 110,
    paddingBottom: 32,
  },

  title: {
    fontSize: 40,
    fontWeight: "700",
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 28,
  },

  socials: {
    gap: 14,
    marginBottom: 24,
  },

  socialButton: {
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  socialButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },

  socialText: {
    fontSize: 16,
    fontWeight: "600",
  },

  appleButton: {
    backgroundColor: "#000000",
    borderColor: "#000000",
  },

  appleButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },

  appleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 10,
  },

  line: {
    flex: 1,
    height: 1,
  },

  dividerText: {
    fontSize: 14,
  },

  form: {
    gap: 18,
    marginBottom: 28,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },

  input: {
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },

  button: {
    minHeight: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },

  buttonText: {
    fontSize: 17,
    fontWeight: "700",
  },

  link: {
    textAlign: "center",
    fontSize: 15,
  },
});