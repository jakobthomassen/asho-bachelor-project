import { Stack } from "expo-router";
import { ThemeProvider } from "../components/ThemeContext";
import { AuthProvider } from "../context/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="intro" />
        <Stack.Screen name="signin" />
        <Stack.Screen name="name" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="preview" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
    </AuthProvider>
  );
}