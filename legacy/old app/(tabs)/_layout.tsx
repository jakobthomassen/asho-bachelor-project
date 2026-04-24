import "react-native-gesture-handler";
import React, { useMemo } from "react";
import { Drawer } from "expo-router/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTheme } from "../../components/ThemeContext";

/* ---------- COLOR HELPERS (same as before) ---------- */
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
  const channel = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * channel(r / 255) +
         0.7152 * channel(g / 255) +
         0.0722 * channel(b / 255);
}

function getReadableTextColor(hex: string) {
  return getLuminance(hex) > 0.45 ? "#111827" : "#ffffff";
}

/* ---------- THEME ---------- */
function getDrawerPalette(backgroundColor: string) {
  const background = normalizeHex(backgroundColor);
  const surface = darken(background, 0.12);

  return {
    background,
    surface,
    border: lighten(background, 0.22),
    text: getReadableTextColor(background),
    inactive:
      getReadableTextColor(background) === "#ffffff"
        ? "rgba(255,255,255,0.7)"
        : "rgba(17,24,39,0.7)",
    header: surface,
    headerText: getReadableTextColor(surface),
    activeBg: lighten(background, 0.1),
  };
}

/* ---------- CUSTOM DRAWER ---------- */
function CustomDrawerContent(props: any) {
  const { backgroundColor } = useTheme();
  const theme = getDrawerPalette(backgroundColor);

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <DrawerContentScrollView {...props}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      {/* LOGOUT BUTTON */}
      <View style={[styles.logoutContainer, { borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.activeBg }]}
          onPress={() => router.replace("/signin")}
        >
          <Text style={[styles.logoutText, { color: theme.text }]}>
            Logg ut
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------- MAIN LAYOUT ---------- */
export default function RootLayout() {
  const { backgroundColor } = useTheme();
  const theme = useMemo(
    () => getDrawerPalette(backgroundColor),
    [backgroundColor]
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.header,
          },
          headerTintColor: theme.headerText,
          sceneStyle: {
            backgroundColor: theme.background,
          },
          drawerStyle: {
            width: 260,
            backgroundColor: theme.surface,
          },
          drawerActiveTintColor: theme.text,
          drawerInactiveTintColor: theme.inactive,
          drawerActiveBackgroundColor: theme.activeBg,
          drawerLabelStyle: {
            marginLeft: -10,
            fontSize: 16,
          },
        }}
      >
        <Drawer.Screen name="index" options={{ title: "Chat" }} />
        <Drawer.Screen name="history" options={{ title: "Historikk" }} />
        <Drawer.Screen name="settings" options={{ title: "Innstillinger" }} />
        <Drawer.Screen name="about" options={{ title: "Om ASHO" }} />
        <Drawer.Screen name="lydfiler" options={{ title: "Lydfiler" }} />
      </Drawer>
    </GestureHandlerRootView>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  logoutContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  logoutButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
  },
});