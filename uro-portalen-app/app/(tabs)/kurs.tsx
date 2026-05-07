import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useTheme } from "@/components/ui/ThemeContext";

const courses = [
  {
    title: "Fredagsmøte",
    type: "Online",
    date: "8. mai 2026 · 13:30",
    location: "Google Meets",
    text: "Ordinært fredagsmøte for internt team.",
  },
  {
    title: "Møte med kongen",
    type: "Fysisk",
    date: "9. mai 2026 · 13:30",
    location: "Slottsplassen 1, Oslo",
    text: "Test-møte, ignorer.",
  },
  {
    title: "Avsluttende møte",
    type: "Online",
    date: "13. mai 2026 · 13:30",
    location: "Google Meets",
    text: "Avsluttende møte for internt team.",
  },
];

const fordypningCards = [
  {
    title: "Én-til-én veiledning",
    text: "Personlig veiledning online eller fysisk.",
    action: "Gå til timebestilling →",
    icon: "person-outline",
    route: "/veiledning",
  },
  {
    title: "Fordypningsretreat",
    text: "Fordyp praksisen gjennom retreats og workshops.",
    action: "Se muligheter →",
    icon: "calendar-outline",
    route: "/kurs-liste",
  },
];

const skoleCards = [
  {
    title: "Værmelding",
    text: "Et lite rom for å sjekke inn med hvordan du har det akkurat nå.",
    action: "Yr →",
    icon: "sunny-outline",
  },
  {
    title: "Testkort",
    text: "Her kan vi senere legge inn videoer, lyd eller annet innhold fra Uro-skolen.",
    action: "Gå til Youtube →",
    icon: "musical-notes-outline",
  },
];

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
  const [selectedCourse, setSelectedCourse] = useState<(typeof courses)[number] | null>(
    null
  );

  return (
    <>
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

        <FadeUpSection delay={100}>
          <Text style={[styles.sectionLabel, { color: Colors.mutedText }]}>KURS</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.courseRow}
          >
            {courses.map((course) => (
              <TouchableOpacity
                key={course.title}
                activeOpacity={0.9}
                onPress={() => setSelectedCourse(course)}
                style={[
                  styles.courseCard,
                  { backgroundColor: Colors.card, borderColor: Colors.border },
                ]}
              >
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        course.type === "Online" ? "#E5EFE8" : "#F7E8D8",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color:
                          course.type === "Online" ? Colors.primary : "#B97635",
                      },
                    ]}
                  >
                    {course.type}
                  </Text>
                </View>

                <Text style={[styles.courseTitle, { color: Colors.text }]}>
                  {course.title}
                </Text>
                <Text style={[styles.courseMeta, { color: Colors.mutedText }]}>
                  {course.date}
                </Text>
                <Text style={[styles.courseMeta, { color: Colors.mutedText }]}>
                  {course.location}
                </Text>
                <Text
                  style={[styles.courseText, { color: Colors.mutedText }]}
                  numberOfLines={3}
                >
                  {course.text}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity onPress={() => router.push("/kurs-liste")}>
            <Text style={[styles.oldLink, { color: Colors.mutedText }]}>
              Vis tidligere hendelser
            </Text>
          </TouchableOpacity>
        </FadeUpSection>

        <View style={[styles.divider, { backgroundColor: Colors.border }]} />

        <FadeUpSection delay={180}>
          <Text style={[styles.sectionLabel, { color: Colors.mutedText }]}>
            UROFORDYPNING
          </Text>

          <View style={styles.bigGrid}>
            {fordypningCards.map((card) => (
              <TouchableOpacity
                key={card.title}
                activeOpacity={0.9}
                onPress={() => router.push(card.route as any)}
                style={[
                  styles.bigCard,
                  { backgroundColor: Colors.card, borderColor: Colors.border },
                ]}
              >
                <View style={[styles.iconBox, { backgroundColor: Colors.background }]}>
                  <Ionicons name={card.icon as any} size={24} color={Colors.text} />
                </View>

                <Text style={[styles.bigCardTitle, { color: Colors.text }]}>
                  {card.title}
                </Text>
                <Text style={[styles.bigCardText, { color: Colors.mutedText }]}>
                  {card.text}
                </Text>
                <Text style={[styles.bigCardAction, { color: Colors.primary }]}>
                  {card.action}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FadeUpSection>

        <View style={[styles.divider, { backgroundColor: Colors.border }]} />

        <FadeUpSection delay={260}>
          <Text style={[styles.sectionLabel, { color: Colors.mutedText }]}>
            URO-SKOLEN
          </Text>

          <View style={styles.bigGrid}>
            {skoleCards.map((card) => (
              <TouchableOpacity
                key={card.title}
                activeOpacity={0.9}
                onPress={() => router.push("/uroskolen")}
                style={[
                  styles.bigCard,
                  { backgroundColor: Colors.card, borderColor: Colors.border },
                ]}
              >
                <View style={[styles.iconBox, { backgroundColor: Colors.background }]}>
                  <Ionicons name={card.icon as any} size={24} color={Colors.text} />
                </View>

                <Text style={[styles.bigCardTitle, { color: Colors.text }]}>
                  {card.title}
                </Text>
                <Text style={[styles.bigCardText, { color: Colors.mutedText }]}>
                  {card.text}
                </Text>
                <Text style={[styles.bigCardAction, { color: Colors.primary }]}>
                  {card.action}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FadeUpSection>
      </ScrollView>

      <Modal visible={!!selectedCourse} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: Colors.card }]}>
            <TouchableOpacity
              style={[styles.closeButton, { borderColor: Colors.border }]}
              onPress={() => setSelectedCourse(null)}
            >
              <Ionicons name="close" size={22} color={Colors.mutedText} />
            </TouchableOpacity>

            {selectedCourse && (
              <>
                <View style={[styles.badge, { backgroundColor: "#E5EFE8" }]}>
                  <Text style={[styles.badgeText, { color: Colors.primary }]}>
                    {selectedCourse.type}
                  </Text>
                </View>

                <Text style={[styles.modalTitle, { color: Colors.text }]}>
                  {selectedCourse.title}
                </Text>
                <Text style={[styles.modalText, { color: Colors.mutedText }]}>
                  {selectedCourse.date}
                </Text>
                <Text style={[styles.modalText, { color: Colors.mutedText }]}>
                  📍 {selectedCourse.location}
                </Text>
                <Text style={[styles.modalDescription, { color: Colors.mutedText }]}>
                  {selectedCourse.text}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: Colors.background, borderColor: Colors.border },
                  ]}
                >
                  <Text style={[styles.modalButtonText, { color: Colors.text }]}>
                    Gå til arrangement →
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
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
    paddingHorizontal: 24,
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 17,
    paddingHorizontal: 24,
    marginBottom: 34,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    paddingHorizontal: 24,
    marginBottom: 14,
    textTransform: "uppercase",
  },

  courseRow: {
    paddingHorizontal: 24,
    gap: 14,
    marginBottom: 16,
  },

  courseCard: {
    width: 230,
    minHeight: 190,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },

  badge: {
    alignSelf: "flex-start",
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },

  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },

  courseTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 10,
  },

  courseMeta: {
    fontSize: 14,
    marginBottom: 8,
  },

  courseText: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },

  oldLink: {
    fontSize: 14,
    textDecorationLine: "underline",
    paddingHorizontal: 24,
  },

  divider: {
    height: 1,
    marginHorizontal: 24,
    marginVertical: 30,
  },

  bigGrid: {
    paddingHorizontal: 24,
    gap: 14,
  },

  bigCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    minHeight: 170,
  },

  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  bigCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },

  bigCardText: {
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 18,
  },

  bigCardAction: {
    fontSize: 14,
    fontWeight: "700",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  modalCard: {
    borderRadius: 24,
    padding: 24,
  },

  closeButton: {
    position: "absolute",
    right: 18,
    top: 18,
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  modalTitle: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 18,
  },

  modalText: {
    fontSize: 16,
    marginBottom: 10,
  },

  modalDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginVertical: 18,
  },

  modalButton: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },

  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});