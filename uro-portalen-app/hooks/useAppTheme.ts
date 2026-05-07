import { useColorScheme } from "react-native";
import { DarkColors, LightColors } from "@/constants/colors";

export function useAppTheme() {
  const scheme = useColorScheme();
  return scheme === "dark" ? DarkColors : LightColors;
}