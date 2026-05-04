import { useEffect, useRef } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useTheme } from "@/components/ui/ThemeContext";

const sections = [
  {
    title: "Urofordypning",
    cards: [
      {
        title: "Én-til-én veiledning",
        text: "Personlig veiledning online eller fysisk.",
        icon: "person-outline",
      },
      {
        title: "Kurs",
        text: "Fordyp praksisen gjennom kurs og retreats.",
        icon: "calendar-outline",
      },
      {
        title: "Uroskolen",
        text: "Et fordypningsløp i seks moduler.",
        icon: "school-outline",
      },
    ],
  },
  {
    title: "Kurs",
    cards: [
      {
        title: "Kommende kurs",
        text: "Se datoer og påmelding.",
        icon: "time-outline",
      },
      {
        title: "Fysiske kurs",
        text: "Møt opp og praktiser sammen.",
        icon: "location-outline",
      },
      {
        title: "Online kurs",
        text: "Delta hjemmefra i eget tempo.",
        icon: "laptop-outline",
      },
    ],
  },
  {
    title: "Uro-skolen",
    cards: [
      {
        title: "Om Uroskolen",
        text: "Les om fordypningsløpet.",
        icon: "information-circle-outline",
      },
      {
        title: "Moduler",
        text: "Utforsk seks moduler.",
        icon: "layers-outline",
      },
      {
        title: "Neste oppstart",
        text: "Meld interesse for neste runde.",
        icon: "sparkles-outline",
      },
    ],
  },
] as const;

function FadeUpSection({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 450,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 450,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export default function KursScreen() {
  const { colors: Colors } = useTheme();

  const handleCardPress = (sectionTitle: string, cardTitle: string) => {
    // 🔥 UROFORDYPNING
    if (sectionTitle === "Urofordypning") {
      if (cardTitle === "Én-til-én veiledning") {
        router.push("/veiledning");
        return;
      }

      if (cardTitle === "Kurs") {
        router.push("/kurs-detaljer");
        return;
      }

      if (cardTitle === "Uroskolen") {
        router.push("/uroskolen");
        return;
      }
    }

    // 🔥 ALL KURS → SAME PAGE
    if (sectionTitle === "Kurs") {
      router.push("/kurs-liste");
      return;
    }

    // (optional later) Uro-skolen section deeper nav
    console.log("Pressed:", sectionTitle, "-", cardTitle);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <FadeUpSection>
        <Text style={[styles.title, { color: Colors.text }]}>Kurs</Text>
        <Text style={[styles.subtitle, { color: Colors.mutedText }]}>
          Veiledning, fordypning og Uro-skolen.
        </Text>
      </FadeUpSection>

      {sections.map((section, sectionIndex) => (
        <FadeUpSection key={section.title} delay={100 + sectionIndex * 120}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>
              {section.title}
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardRow}
            >
              {section.cards.map((card) => (
                <TouchableOpacity
                  key={card.title}
                  activeOpacity={0.9}
                  onPress={() =>
                    handleCardPress(section.title, card.title)
                  }
                  style={[
                    styles.card,
                    {
                      backgroundColor: Colors.card,
                      borderColor: Colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: Colors.background },
                    ]}
                  >
                    <Ionicons
                      name={card.icon}
                      size={26}
                      color={Colors.primary}
                    />
                  </View>

                  <Text style={[styles.cardTitle, { color: Colors.text }]}>
                    {card.title}
                  </Text>

                  <Text
                    style={[styles.cardText, { color: Colors.mutedText }]}
                    numberOfLines={3}
                  >
                    {card.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {sectionIndex < sections.length - 1 && (
              <View
                style={[styles.divider, { backgroundColor: Colors.border }]}
              />
            )}
          </View>
        </FadeUpSection>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingTop: 72,
    paddingBottom: 120,
  },

  title: {
    fontSize: 40,
    fontWeight: "700",
    marginBottom: 6,
    paddingHorizontal: 24,
  },

  subtitle: {
    fontSize: 17,
    marginBottom: 26,
    paddingHorizontal: 24,
  },

  section: {
    marginBottom: 28,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 14,
    paddingHorizontal: 24,
  },

  cardRow: {
    paddingHorizontal: 24,
    gap: 14,
  },

  card: {
    width: 210,
    minHeight: 180,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },

  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },

  cardText: {
    fontSize: 14,
    lineHeight: 21,
  },

  divider: {
    height: 1,
    marginTop: 28,
    marginHorizontal: 24,
  },
});