import { useEffect, useRef } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useTheme } from "@/components/ui/ThemeContext";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 11) return "God morgen";
  if (hour >= 11 && hour < 17) return "God dag";
  if (hour >= 17 && hour < 22) return "God kveld";
  return "God kveld";
}

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

export default function HjemScreen() {
  const { colors: Colors } = useTheme();
  const greeting = getGreeting();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <FadeUpSection delay={0}>
        <Text style={[styles.greeting, { color: Colors.text }]}>{greeting}</Text>
        <Text style={[styles.subtitle, { color: Colors.mutedText }]}>
          Hva trenger du i dag?
        </Text>
      </FadeUpSection>

      <FadeUpSection delay={100}>
        <TouchableOpacity
          style={[
            styles.journeyCard,
            { backgroundColor: Colors.primary, borderColor: Colors.primarySoft },
          ]}
          activeOpacity={0.9}
          onPress={() => router.push("/(tabs)/reise")}
        >
          <View style={styles.cardTopRow}>
            <Text style={[styles.eyebrow, { color: Colors.white }]}>
              Uropraksis
            </Text>

            <View style={styles.circleButton}>
              <Ionicons name="arrow-forward" size={22} color={Colors.white} />
            </View>
          </View>

          <Text style={[styles.cardTitle, { color: Colors.white }]}>
            Uke 1 - Møt uroen
          </Text>

          <Text style={[styles.cardDescription, { color: Colors.white }]}>
            Du er klar til å starte reisen i ditt eget tempo.
          </Text>

          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: "rgba(255,255,255,0.16)" },
            ]}
            activeOpacity={0.9}
            onPress={() => router.push("/(tabs)/reise")}
          >
            <Text style={[styles.startButtonText, { color: Colors.white }]}>
              Start reisen
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </FadeUpSection>

      <FadeUpSection delay={180}>
        <View
          style={[
            styles.thoughtCard,
            {
              backgroundColor: Colors.card,
              borderColor: Colors.border,
            },
          ]}
        >
          <Text style={[styles.thoughtEyebrow, { color: Colors.primary }]}>
            DAGENS TANKE
          </Text>

          <Text style={[styles.thoughtText, { color: Colors.mutedText }]}>
            Sinnet lager historier. Kroppen kjenner sannheten. Begge har noe å si.
          </Text>
        </View>
      </FadeUpSection>

      <FadeUpSection delay={240}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>
            Snarveier
          </Text>
        </View>
      </FadeUpSection>

      <FadeUpSection delay={300}>
        <TouchableOpacity
          style={[
            styles.linkCard,
            { backgroundColor: Colors.card, borderColor: Colors.border },
          ]}
          activeOpacity={0.9}
          onPress={() => router.push("/(tabs)/lydbibliotek")}
        >
          <View style={styles.linkLeft}>
            <View
              style={[styles.linkIconBox, { backgroundColor: Colors.background }]}
            >
              <Ionicons name="headset-outline" size={24} color={Colors.primary} />
            </View>

            <View>
              <Text style={[styles.linkTitle, { color: Colors.text }]}>
                Lydbibliotek
              </Text>
              <Text style={[styles.linkSubtitle, { color: Colors.mutedText }]}>
                Utforsk lydøkter i eget tempo
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={24} color={Colors.mutedText} />
        </TouchableOpacity>
      </FadeUpSection>

      <FadeUpSection delay={360}>
        <TouchableOpacity
          style={[
            styles.linkCard,
            { backgroundColor: Colors.card, borderColor: Colors.border },
          ]}
          activeOpacity={0.9}
          onPress={() => router.push("/reflections")}
        >
          <View style={styles.linkLeft}>
            <View
              style={[styles.linkIconBox, { backgroundColor: Colors.background }]}
            >
              <Ionicons name="create-outline" size={24} color={Colors.primary} />
            </View>

            <View>
              <Text style={[styles.linkTitle, { color: Colors.text }]}>
                Refleksjon
              </Text>
              <Text style={[styles.linkSubtitle, { color: Colors.mutedText }]}>
                Skriv ned det du legger merke til
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={24} color={Colors.mutedText} />
        </TouchableOpacity>
      </FadeUpSection>

      <FadeUpSection delay={420}>
        <TouchableOpacity
          style={[
            styles.linkCard,
            { backgroundColor: Colors.card, borderColor: Colors.border },
          ]}
          activeOpacity={0.9}
          onPress={() => router.push("/(tabs)/kurs")}
        >
          <View style={styles.linkLeft}>
            <View
              style={[styles.linkIconBox, { backgroundColor: Colors.background }]}
            >
              <Ionicons name="school-outline" size={24} color={Colors.primary} />
            </View>

            <View>
              <Text style={[styles.linkTitle, { color: Colors.text }]}>
                Uro-skolen
              </Text>
              <Text style={[styles.linkSubtitle, { color: Colors.mutedText }]}>
                Kunnskap og historier
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={24} color={Colors.mutedText} />
        </TouchableOpacity>
      </FadeUpSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 120,
  },

  greeting: {
    fontSize: 36,
    fontWeight: "700",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 17,
    marginBottom: 24,
  },

  journeyCard: {
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
  },

  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },

  circleButton: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 10,
    maxWidth: "85%",
  },

  cardDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 18,
    maxWidth: "90%",
  },

  startButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },

  startButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },

  thoughtCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 24,
  },

  thoughtEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 10,
  },

  thoughtText: {
    fontSize: 16,
    lineHeight: 25,
    fontStyle: "italic",
  },

  sectionHeader: {
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  linkCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  linkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },

  linkIconBox: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  linkTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },

  linkSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});