import { Stack } from "expo-router";
import { ThemeProvider } from "@/components/ui/ThemeContext";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}