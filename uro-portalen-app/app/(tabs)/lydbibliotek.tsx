import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useTheme } from "@/components/ui/ThemeContext";

const filters = ["Alle", "Lydøkter", "Case", "Refleksjon", "Video"];

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

export default function LydbibliotekScreen() {
  const { colors: Colors } = useTheme();
  const [activeFilter, setActiveFilter] = useState("Alle");

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <FadeUpSection delay={0}>
        <Text style={[styles.title, { color: Colors.text }]}>Lydbibliotek</Text>
        <Text style={[styles.subtitle, { color: Colors.mutedText }]}>
          Utforsk fritt i ditt eget tempo
        </Text>
      </FadeUpSection>

      <FadeUpSection delay={100}>
        <View style={styles.filterRow}>
          {filters.map((filter) => {
            const isActive = activeFilter === filter;

            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setActiveFilter(filter)}
                activeOpacity={0.85}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? Colors.primary : Colors.card,
                    borderColor: Colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: isActive ? Colors.white : Colors.text,
                    },
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </FadeUpSection>

      <FadeUpSection delay={180}>
        <View
          style={[
            styles.emptyState,
            {
              backgroundColor: Colors.card,
              borderColor: Colors.border,
            },
          ]}
        >
          <Text style={[styles.emptyTitle, { color: Colors.text }]}>
            Ingen innhold ennå
          </Text>

          <Text style={[styles.emptyText, { color: Colors.mutedText }]}>
            Innhold vil bli tilgjengelig her når backend er koblet til.
          </Text>
        </View>
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

  title: {
    fontSize: 40,
    fontWeight: "700",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 17,
    marginBottom: 22,
  },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 26,
  },

  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },

  filterText: {
    fontSize: 14,
    fontWeight: "600",
  },

  emptyState: {
    marginTop: 40,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});