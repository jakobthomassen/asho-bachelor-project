import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../components/ThemeContext";
import { loginWithEmailPassword } from "../api/auth";
import { useAuth } from "../context/AuthContext";

function normalizeHex(hex: string): string {
  let value = hex.trim().replace("#", "");

  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }

  if (value.length !== 6) return "#0f172a";
  return `#${value.toLowerCase()}`;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex).replace("#", "");
  const num = parseInt(normalized, 16);

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mix(hex1: string, hex2: string, weight: number) {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);

  return rgbToHex(
    a.r * (1 - weight) + b.r * weight,
    a.g * (1 - weight) + b.g * weight,
    a.b * (1 - weight) + b.b * weight
  );
}

function lighten(hex: string, amount: number) {
  return mix(hex, "#ffffff", amount);
}

function darken(hex: string, amount: number) {
  return mix(hex, "#000000", amount);
}

function getLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);

  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  const R = channel(r);
  const G = channel(g);
  const B = channel(b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function getReadableTextColor(hex: string) {
  return getLuminance(hex) > 0.45 ? "#111827" : "#ffffff";
}

function getSignInPalette(backgroundColor: string) {
  const background = normalizeHex(backgroundColor);
  const surface = darken(background, 0.12);
  const inputBackground = darken(background, 0.08);
  const border = lighten(background, 0.22);
  const primaryButton = lighten(background, 0.3);

  return {
    background,
    surface,
    inputBackground,
    border,
    title: getReadableTextColor(background),
    subtitle:
      getReadableTextColor(background) === "#ffffff"
        ? "rgba(255,255,255,0.72)"
        : "rgba(17,24,39,0.72)",
    inputText: getReadableTextColor(inputBackground),
    placeholder:
      getReadableTextColor(inputBackground) === "#ffffff"
        ? "rgba(255,255,255,0.6)"
        : "rgba(17,24,39,0.55)",
    primaryButton,
    primaryButtonText: getReadableTextColor(primaryButton),
    socialButtonBackground: surface,
    socialButtonText: getReadableTextColor(surface),
    divider: border,
  };
}

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { backgroundColor } = useTheme();
  const { signIn } = useAuth();

  const theme = useMemo(
    () => getSignInPalette(backgroundColor),
    [backgroundColor]
  );

  const handleSignIn = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert("Feil", "Skriv inn e-post og passord.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginWithEmailPassword(normalizedEmail, password);
      await signIn(result.sessionToken, result.userId, result.isAdmin);

      if (result.isAdmin) {
        router.replace("/admin");
      } else {
        router.replace("/name");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Innlogging feilet";
      Alert.alert("Feil", message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {};

  const handleAppleSignIn = () => {};

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.title }]}>ASHO</Text>
          <Text style={[styles.subtitle, { color: theme.subtitle }]}>
            Velkommen til ASHO
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                color: theme.inputText,
                borderColor: theme.border,
              },
            ]}
            placeholder="Email"
            placeholderTextColor={theme.placeholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                color: theme.inputText,
                borderColor: theme.border,
              },
            ]}
            placeholder="Password"
            placeholderTextColor={theme.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primaryButton }, isLoading && { opacity: 0.6 }]}
            onPress={handleSignIn}
            disabled={isLoading}
          >
            <Text
              style={[styles.primaryButtonText, { color: theme.primaryButtonText }]}
            >
              {isLoading ? "Logger inn..." : "Signer Inn"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <Text style={[styles.dividerText, { color: theme.subtitle }]}>
            eller fortsett med
          </Text>
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
        </View>

        <View style={styles.socialButtons}>
          <TouchableOpacity
            style={[
              styles.socialButton,
              {
                backgroundColor: theme.socialButtonBackground,
                borderColor: theme.border,
              },
            ]}
            onPress={handleGoogleSignIn}
          >
            <Text
              style={[styles.socialButtonText, { color: theme.socialButtonText }]}
            >
              Fortsett med Google
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.socialButton,
              {
                backgroundColor: theme.socialButtonBackground,
                borderColor: theme.border,
              },
            ]}
            onPress={handleAppleSignIn}
          >
            <Text
              style={[styles.socialButtonText, { color: theme.socialButtonText }]}
            >
              Fortsett med Apple
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 32,
    alignItems: "center",
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
  },
  form: {
    gap: 14,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  primaryButton: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 28,
    gap: 10,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
  },
  socialButtons: {
    gap: 12,
  },
  socialButton: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
});