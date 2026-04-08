import { Stack } from "expo-router";
import { ThemeProvider } from "../components/ThemeContext";

export default function RootLayout() {
  return (
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
  );
}