import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { useTheme } from "@/components/ui/ThemeContext";

type Plan = "monthly" | "yearly" | "trial14" | "student";

export default function Paywall() {
  const { colors: Colors } = useTheme();
  const [selected, setSelected] = useState<Plan>("monthly");

  const getCardStyle = (plan: Plan) => ({
    backgroundColor: Colors.background,
    borderColor: selected === plan ? Colors.primary : Colors.border,
  });

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      {/* Badge */}
      <View style={[styles.badge, { backgroundColor: Colors.card }]}>
        <Text style={[styles.badgeText, { color: Colors.primary }]}>
          14 dager gratis
        </Text>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: Colors.text }]}>
        Start din reise
      </Text>

      {/* Options */}
      <View style={styles.options}>
        {/* 14 Day Trial */}
        <TouchableOpacity
          onPress={() => setSelected("trial14")}
          style={[styles.card, getCardStyle("trial14")]}
        >
          <View>
            <Text style={[styles.planTitle, { color: Colors.text }]}>
              14 dager gratis
            </Text>
            <Text style={[styles.planSubtitle, { color: Colors.mutedText }]}>
              Prøv alt uten kostnad
            </Text>
          </View>
        </TouchableOpacity>

        {/* Monthly */}
        <TouchableOpacity
          onPress={() => setSelected("monthly")}
          style={[styles.card, getCardStyle("monthly")]}
        >
          <View>
            <Text style={[styles.planTitle, { color: Colors.text }]}>
              Månedlig
            </Text>
            <Text style={[styles.planSubtitle, { color: Colors.mutedText }]}>
              Fleksibelt — avslutt når du vil
            </Text>
          </View>

          <View>
            <Text style={[styles.price, { color: Colors.text }]}>179 kr</Text>
            <Text style={[styles.per, { color: Colors.mutedText }]}>
              / måned
            </Text>
          </View>
        </TouchableOpacity>

        {/* Student */}
        <TouchableOpacity
          onPress={() => setSelected("student")}
          style={[styles.card, getCardStyle("student")]}
        >
          <View>
            <Text style={[styles.planTitle, { color: Colors.text }]}>
              Student
            </Text>
            <Text style={[styles.planSubtitle, { color: Colors.mutedText }]}>
              Rabattert pris for studenter
            </Text>
          </View>

          <View>
            <Text style={[styles.price, { color: Colors.text }]}>79 kr</Text>
            <Text style={[styles.per, { color: Colors.mutedText }]}>
              / måned
            </Text>
          </View>
        </TouchableOpacity>

        {/* Yearly */}
        <TouchableOpacity
          onPress={() => setSelected("yearly")}
          style={[styles.card, getCardStyle("yearly")]}
        >
          <View>
            <Text style={[styles.planTitle, { color: Colors.text }]}>
              Årlig
            </Text>
            <Text style={[styles.planSubtitle, { color: Colors.mutedText }]}>
              Beste verdi
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <View style={[styles.discount, { backgroundColor: Colors.primary }]}>
              <Text style={[styles.discountText, { color: Colors.white }]}>
                Spar 36%
              </Text>
            </View>

            <Text style={[styles.price, { color: Colors.text }]}>1490 kr</Text>
            <Text style={[styles.per, { color: Colors.mutedText }]}>
              / år
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: Colors.primary }]}
        onPress={() => router.push("/auth/signin")}
        activeOpacity={0.9}
      >
        <Text style={[styles.buttonText, { color: Colors.white }]}>
          Fortsett
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 100,
    paddingBottom: 30,
  },

  badge: {
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },

  badgeText: {
    fontWeight: "600",
  },

  title: {
    fontSize: 40,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 40,
  },

  options: {
    gap: 16,
    marginBottom: 30,
  },

  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  activeCard: {},

  planTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },

  planSubtitle: {
    fontSize: 14,
  },

  price: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "right",
  },

  per: {
    fontSize: 14,
    textAlign: "right",
  },

  discount: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },

  discountText: {
    fontSize: 12,
    fontWeight: "600",
  },

  button: {
    marginTop: "auto",
    paddingVertical: 20,
    borderRadius: 28,
    alignItems: "center",
  },

  buttonText: {
    fontSize: 18,
    fontWeight: "700",
  },
});