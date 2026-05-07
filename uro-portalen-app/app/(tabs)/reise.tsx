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
import { useTheme } from "@/components/ui/ThemeContext";

const weeks = [
  {
    week: 1,
    title: "Møt uroen",
    description:
      "Bli kjent med din indre uro. Forstå hva den er, og hvorfor den ikke er farlig.",
    status: "current",
  },
  {
    week: 2,
    title: "Reaktivitet",
    description:
      "Lær å gjenkjenne dine automatiske reaksjonsmønstre og hva som trigger dem.",
    status: "locked",
  },
  {
    week: 3,
    title: "Pust og ro",
    description:
      "Pusten er ditt raskeste verktøy for å regulere nervesystemet. Her lærer du å bruke den.",
    status: "locked",
  },
  {
    week: 4,
    title: "Kroppen vet",
    description:
      "Kroppen registrerer uro lenge før tankene gjør det. Lær å lytte til disse signalene.",
    status: "locked",
  },
  {
    week: 5,
    title: "Mønstre",
    description:
      "Se de dypere mønstrene bak uroen din – og begynn å løsne dem forsiktig.",
    status: "locked",
  },
  {
    week: 6,
    title: "Ressursen",
    description:
      "Uro inneholder energi. Denne uken lærer du å bruke den konstruktivt.",
    status: "locked",
  },
  {
    week: 7,
    title: "Integrasjon",
    description:
      "Sett sammen det du har lært til en personlig praksis du faktisk kan holde.",
    status: "locked",
  },
  {
    week: 8,
    title: "Veien videre",
    description:
      "Avslutt reisen med et blikk tilbake og et tydelig steg videre.",
    status: "locked",
  },
] as const;

type WeekStatus = (typeof weeks)[number]["status"];

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
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function WeekMarker({
  status,
  isLast,
}: {
  status: WeekStatus;
  isLast: boolean;
}) {
  const { colors: Colors } = useTheme();

  return (
    <View style={styles.timelineWrap}>
      <View
        style={[
          styles.marker,
          {
            borderColor: status === "current" ? Colors.primary : Colors.border,
            backgroundColor:
              status === "current" ? Colors.card : Colors.background,
          },
        ]}
      >
        {status === "current" ? (
          <Text style={[styles.markerText, { color: Colors.primary }]}>1</Text>
        ) : (
          <Ionicons
            name="lock-closed-outline"
            size={14}
            color={Colors.mutedText}
          />
        )}
      </View>

      {!isLast && (
        <View
          style={[
            styles.timelineLine,
            { backgroundColor: Colors.border },
          ]}
        />
      )}
    </View>
  );
}

export default function ReiseScreen() {
  const { colors: Colors } = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <FadeUpSection delay={0}>
        <Text style={[styles.title, { color: Colors.text }]}>Uropraksis</Text>
        <Text style={[styles.subtitle, { color: Colors.mutedText }]}>
          8 uker mot mer ro
        </Text>
      </FadeUpSection>

      <FadeUpSection delay={80}>
        <View style={styles.progressHeader}>
          <View style={[styles.progressLine, { backgroundColor: Colors.border }]} />
          <Text style={[styles.progressText, { color: Colors.mutedText }]}>
            0 av 8 uker fullført
          </Text>
        </View>
      </FadeUpSection>

      <View style={styles.timelineList}>
        {weeks.map((item, index) => {
          const isCurrent = item.status === "current";
          const isLocked = item.status === "locked";

          return (
            <FadeUpSection key={item.week} delay={140 + index * 60}>
              <TouchableOpacity activeOpacity={0.88} style={styles.weekRow}>
                <WeekMarker
                  status={item.status}
                  isLast={index === weeks.length - 1}
                />

                <View style={styles.weekContent}>
                  <Text
                    style={[
                      styles.weekEyebrow,
                      { color: isCurrent ? Colors.primary : Colors.mutedText },
                    ]}
                  >
                    UKE {item.week}
                  </Text>

                  <Text
                    style={[
                      styles.weekTitle,
                      {
                        color: isCurrent
                          ? Colors.text
                          : isLocked
                          ? Colors.mutedText
                          : Colors.text,
                      },
                    ]}
                  >
                    {item.title}
                  </Text>

                  <Text
                    style={[
                      styles.weekDescription,
                      {
                        color: isCurrent
                          ? Colors.mutedText
                          : isLocked
                          ? Colors.mutedText
                          : Colors.mutedText,
                      },
                    ]}
                  >
                    {item.description}
                  </Text>
                </View>
              </TouchableOpacity>
            </FadeUpSection>
          );
        })}
      </View>
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

  title: {
    fontSize: 40,
    fontWeight: "700",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 17,
    marginBottom: 22,
  },

  progressHeader: {
    marginBottom: 26,
  },

  progressLine: {
    height: 2,
    borderRadius: 999,
    width: "100%",
    marginBottom: 10,
  },

  progressText: {
    fontSize: 13,
    textAlign: "right",
  },

  timelineList: {
    gap: 0,
  },

  weekRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 92,
  },

  timelineWrap: {
    width: 30,
    alignItems: "center",
    marginRight: 14,
  },

  marker: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  markerText: {
    fontSize: 14,
    fontWeight: "700",
  },

  timelineLine: {
    width: 1.5,
    flex: 1,
    marginTop: 4,
    minHeight: 34,
  },

  weekContent: {
    flex: 1,
    paddingBottom: 26,
  },

  weekEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },

  weekTitle: {
    fontSize: 17,
    fontWeight: "500",
    marginBottom: 6,
  },

  weekDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
});