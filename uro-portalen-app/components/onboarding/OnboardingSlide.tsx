import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import ProgressDots from "./ProgressDots";
import { useTheme } from "@/components/ui/ThemeContext";

export default function OnboardingSlide({
  children,
  currentStep,
  totalSteps,
  onNext,
  buttonText,
  onSkip,
}: {
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  buttonText: string;
  onSkip?: () => void;
}) {
  const { colors: Colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors.background }]}>
      <View style={[styles.container, { backgroundColor: Colors.background }]}>
        <View style={styles.header}>
          <ProgressDots current={currentStep} total={totalSteps} />

          {onSkip && (
            <TouchableOpacity onPress={onSkip} activeOpacity={0.8}>
              <Text style={[styles.skip, { color: Colors.mutedText }]}>
                Hopp over
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: Colors.primary }]}
          onPress={onNext}
          activeOpacity={0.9}
        >
          <Text style={[styles.buttonText, { color: Colors.white }]}>
            {buttonText} ›
          </Text>
        </TouchableOpacity>
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
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 24,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },

  skip: {
    fontSize: 16,
    fontWeight: "500",
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },

  button: {
    minHeight: 74,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },

  buttonText: {
    fontSize: 18,
    fontWeight: "700",
  },
});