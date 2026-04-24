import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/components/ui/ThemeContext";

export default function AccordionCard({
  title,
  content,
  isOpen,
  onPress,
}: {
  title: string;
  content: string;
  isOpen: boolean;
  onPress: () => void;
}) {
  const { colors: Colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: Colors.border,
          backgroundColor: Colors.background,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={[styles.title, { color: Colors.text }]}>{title}</Text>
        <Text style={[styles.icon, { color: Colors.mutedText }]}>
          {isOpen ? "⌃" : "⌄"}
        </Text>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.body}>
          <Text style={[styles.content, { color: Colors.mutedText }]}>
            {content}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },

  header: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },

  icon: {
    fontSize: 20,
    marginLeft: 10,
  },

  body: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  content: {
    fontSize: 16,
    lineHeight: 28,
  },
});