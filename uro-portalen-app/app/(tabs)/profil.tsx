import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  TextInput,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useTheme } from "@/components/ui/ThemeContext";

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

export default function ProfilScreen() {
  const { isDark, toggleTheme, colors } = useTheme();
  const [activeTab, setActiveTab] = useState<"progress" | "reflections">(
    "progress"
  );
  const [reflectionText, setReflectionText] = useState("");
  const [reflections, setReflections] = useState<string[]>([]);

  const palette = useMemo(() => {
    return {
      background: colors.background,
      card: colors.card,
      border: colors.border,
      text: colors.text,
      mutedText: colors.mutedText,
      primary: colors.primary,
      avatarBg: isDark ? "#2A2926" : "#E8E6DF",
      iconBox: isDark ? "#2B2926" : "#E6DBCE",
      segmentBg: isDark ? "#262420" : "#E4E0D8",
      activeSegmentBg: isDark ? "#1D1C1A" : colors.background,
      activeSegmentBorder: isDark ? "#4D6E5C" : "#B8CBC0",
      progressTrack: isDark ? "#312F2B" : "#E8E3DA",
    };
  }, [colors, isDark]);

  const handleSaveReflection = () => {
    const trimmed = reflectionText.trim();

    if (!trimmed) return;

    setReflections((prev) => [trimmed, ...prev]);
    setReflectionText("");
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <FadeUpSection delay={0}>
        <View style={styles.headerRow}>
          <View style={styles.profileLeft}>
            <View style={[styles.avatar, { backgroundColor: palette.avatarBg }]}>
              <Text style={[styles.avatarText, { color: palette.primary }]}>B</Text>
            </View>

            <View>
              <Text style={[styles.name, { color: palette.text }]}>bruker</Text>
              <Text style={[styles.email, { color: palette.mutedText }]}>
                bruker@epost.no
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.8}
              onPress={toggleTheme}
            >
              <Ionicons
                name={isDark ? "sunny-outline" : "moon-outline"}
                size={24}
                color={palette.mutedText}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
              <Ionicons
                name="log-out-outline"
                size={24}
                color={palette.mutedText}
              />
            </TouchableOpacity>
          </View>
        </View>
      </FadeUpSection>

      <FadeUpSection delay={100}>
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <View style={styles.statTopRow}>
              <Ionicons name="flame-outline" size={22} color={palette.primary} />
              <Text style={[styles.statNumber, { color: palette.text }]}>0</Text>
            </View>
            <Text style={[styles.statLabel, { color: palette.mutedText }]}>
              Dager på rad
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.statNumber, { color: palette.text }]}>0t</Text>
            <Text style={[styles.statLabel, { color: palette.mutedText }]}>
              Timer lyttet
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.statNumber, { color: palette.text }]}>0/8</Text>
            <Text style={[styles.statLabel, { color: palette.mutedText }]}>Uker</Text>
          </View>
        </View>
      </FadeUpSection>

      <FadeUpSection delay={180}>
        <View style={[styles.segmentWrap, { backgroundColor: palette.segmentBg }]}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              activeTab === "progress" && {
                backgroundColor: palette.activeSegmentBg,
                borderWidth: 1,
                borderColor: palette.activeSegmentBorder,
              },
            ]}
            activeOpacity={0.85}
            onPress={() => setActiveTab("progress")}
          >
            <Text
              style={[
                styles.segmentText,
                { color: palette.mutedText },
                activeTab === "progress" && { color: palette.text },
              ]}
            >
              Fremgang
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentButton,
              activeTab === "reflections" && {
                backgroundColor: palette.activeSegmentBg,
                borderWidth: 1,
                borderColor: palette.activeSegmentBorder,
              },
            ]}
            activeOpacity={0.85}
            onPress={() => setActiveTab("reflections")}
          >
            <Text
              style={[
                styles.segmentText,
                { color: palette.mutedText },
                activeTab === "reflections" && { color: palette.text },
              ]}
            >
              Refleksjoner
            </Text>
          </TouchableOpacity>
        </View>
      </FadeUpSection>

      {activeTab === "progress" ? (
        <>
          <FadeUpSection delay={260}>
            <TouchableOpacity
              style={[
                styles.progressCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
              activeOpacity={0.9}
              onPress={() => router.push("/(tabs)/reise")}
            >
              <View style={styles.progressHeader}>
                <View>
                  <Text style={[styles.progressTitle, { color: palette.text }]}>
                    Uropraksis
                  </Text>
                  <Text
                    style={[styles.progressSubtitle, { color: palette.mutedText }]}
                  >
                    8-ukersreise
                  </Text>
                </View>

                <Text style={[styles.progressLink, { color: palette.primary }]}>
                  Start ›
                </Text>
              </View>

              <View
                style={[styles.progressBar, { backgroundColor: palette.progressTrack }]}
              >
                <View
                  style={[
                    styles.progressFill,
                    { width: "0%", backgroundColor: palette.primary },
                  ]}
                />
              </View>

              <Text style={[styles.progressText, { color: palette.mutedText }]}>
                0 av 8 uker fullført
              </Text>
            </TouchableOpacity>
          </FadeUpSection>

          <FadeUpSection delay={340}>
            <TouchableOpacity
              style={[
                styles.linkCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
              activeOpacity={0.9}
              onPress={() => router.push("/(tabs)/lydbibliotek")}
            >
              <View style={styles.linkLeft}>
                <View
                  style={[styles.linkIconBox, { backgroundColor: palette.iconBox }]}
                >
                  <Ionicons name="book-outline" size={26} color={palette.text} />
                </View>

                <View>
                  <Text style={[styles.linkTitle, { color: palette.text }]}>
                    Bibliotek
                  </Text>
                  <Text style={[styles.linkSubtitle, { color: palette.mutedText }]}>
                    Utforsk alle lydøkter
                  </Text>
                </View>
              </View>

              <Ionicons
                name="chevron-forward"
                size={26}
                color={palette.mutedText}
              />
            </TouchableOpacity>
          </FadeUpSection>

          <FadeUpSection delay={420}>
            <TouchableOpacity
              style={[
                styles.linkCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
              activeOpacity={0.9}
            >
              <View style={styles.linkLeft}>
                <View
                  style={[styles.linkIconBox, { backgroundColor: palette.iconBox }]}
                >
                  <Ionicons name="school-outline" size={26} color={palette.text} />
                </View>

                <View>
                  <Text style={[styles.linkTitle, { color: palette.text }]}>
                    Uro-skolen
                  </Text>
                  <Text style={[styles.linkSubtitle, { color: palette.mutedText }]}>
                    Kunnskap og historier
                  </Text>
                </View>
              </View>

              <Ionicons
                name="chevron-forward"
                size={26}
                color={palette.mutedText}
              />
            </TouchableOpacity>
          </FadeUpSection>
        </>
      ) : (
        <FadeUpSection delay={260}>
          <View
            style={[
              styles.reflectionCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.journalTitle, { color: palette.text }]}>
              Skriv refleksjon
            </Text>

            <Text style={[styles.journalText, { color: palette.mutedText }]}>
              Skriv ned tanker, følelser eller noe du la merke til i dag.
            </Text>

            <TextInput
              style={[
                styles.reflectionInput,
                {
                  backgroundColor: palette.background,
                  borderColor: palette.border,
                  color: palette.text,
                },
              ]}
              placeholder="Hva legger du merke til?"
              placeholderTextColor={palette.mutedText}
              value={reflectionText}
              onChangeText={setReflectionText}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: palette.primary }]}
              activeOpacity={0.9}
              onPress={handleSaveReflection}
            >
              <Text style={[styles.saveButtonText, { color: colors.white }]}>
                Lagre refleksjon
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.reflectionList}>
            {reflections.length === 0 ? (
              <Text style={[styles.emptyText, { color: palette.mutedText }]}>
                Ingen refleksjoner enda.
              </Text>
            ) : (
              reflections.map((reflection, index) => (
                <View
                  key={`${reflection}-${index}`}
                  style={[
                    styles.reflectionItem,
                    { backgroundColor: palette.card, borderColor: palette.border },
                  ]}
                >
                  <Text style={[styles.reflectionItemTitle, { color: palette.text }]}>
                    Refleksjon {reflections.length - index}
                  </Text>
                  <Text
                    style={[styles.reflectionItemText, { color: palette.mutedText }]}
                  >
                    {reflection}
                  </Text>
                </View>
              ))
            )}
          </View>
        </FadeUpSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  content: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 120,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 26,
  },

  profileLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },

  avatar: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: { fontSize: 28, fontWeight: "700" },

  name: { fontSize: 22, fontWeight: "700", marginBottom: 4 },

  email: { fontSize: 15 },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  iconButton: { padding: 8 },

  statsRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 22,
  },

  statCard: {
    flex: 1,
    minHeight: 132,
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  statTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },

  statNumber: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  segmentWrap: {
    flexDirection: "row",
    borderRadius: 24,
    padding: 6,
    marginBottom: 22,
  },

  segmentButton: {
    flex: 1,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  segmentText: {
    fontSize: 16,
    fontWeight: "600",
  },

  progressCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    marginBottom: 18,
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  progressTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },

  progressSubtitle: { fontSize: 15 },

  progressLink: {
    fontSize: 16,
    fontWeight: "600",
  },

  progressBar: {
    height: 14,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 14,
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  progressText: {
    fontSize: 15,
    fontWeight: "600",
  },

  linkCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  linkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },

  linkIconBox: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  linkTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },

  linkSubtitle: { fontSize: 15 },

  reflectionCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    marginBottom: 18,
  },

  journalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },

  journalText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 18,
  },

  reflectionInput: {
    minHeight: 140,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },

  saveButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },

  reflectionList: {
    gap: 12,
  },

  emptyText: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 8,
  },

  reflectionItem: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },

  reflectionItemTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },

  reflectionItemText: {
    fontSize: 15,
    lineHeight: 23,
  },
});