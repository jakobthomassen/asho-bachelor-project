import React, { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Heart,
  Waves,
  Sparkles,
  Repeat,
  Leaf,
  Rocket,
  PersonStanding,
} from "lucide-react-native";
import { useTheme } from "../components/ThemeContext";

const { width } = Dimensions.get("window");

type Slide = {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  Icon: any;
};

type IntroPalette = {
  background: string;
  gradientTop: string;
  gradientBottom: string;
  title: string;
  description: string;
  icon: string;
  button: string;
  buttonText: string;
  dotActive: string;
  dotInactive: string;
};

const slides: Slide[] = [
  {
    id: "1",
    title: "Hei. Vi er glad du er her.",
    description:
      "ASHO er din personlige guide til indre ro og selvforståelse.",
    buttonText: "Neste",
    Icon: Heart,
  },
  {
    id: "2",
    title: "Livet kan føles overveldende.",
    description:
      "Tankene spinner. Kroppen er urolig. Du vet ikke helt hva det er.",
    buttonText: "Neste",
    Icon: Waves,
  },
  {
    id: "3",
    title: "ASHO hjelper deg å finne klarhet.",
    description:
      "Ikke med råd eller svar — men ved å stille de rette spørsmålene.",
    buttonText: "Neste",
    Icon: Sparkles,
  },
  {
    id: "4",
    title: "Kroppen kjenner det før tanken gjør det.",
    description:
      "En klump i magen. Spenning i skuldrene. Noe som ikke slipper taket.",
    buttonText: "Neste",
    Icon: PersonStanding,
  },
  {
    id: "5",
    title: "Noen mønstre bare gjentar seg.",
    description:
      "Samme reaksjoner. Samme følelse. Selv om du ikke vil at de skal.",
    buttonText: "Neste",
    Icon: Repeat,
  },
  {
    id: "6",
    title: "ASHO er alltid her - rolig og uten dom.",
    description:
      "Et trygt sted å utforske hva som egentlig skjer inni deg.",
    buttonText: "Neste",
    Icon: Leaf,
  },
  {
    id: "7",
    title: "Er du klar til å starte?",
    description: "Din reise begynner nå.",
    buttonText: "Ja, jeg er klar",
    Icon: Rocket,
  },
];

function normalizeHex(hex: string): string {
  let value = hex.trim().replace("#", "");

  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }

  if (value.length !== 6) return "#0f172a";
  return `#${value.toLowerCase()}`;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex).replace("#", "");
  const num = parseInt(normalized, 16);

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mix(hex1: string, hex2: string, weight: number) {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);

  return rgbToHex(
    a.r * (1 - weight) + b.r * weight,
    a.g * (1 - weight) + b.g * weight,
    a.b * (1 - weight) + b.b * weight
  );
}

function lighten(hex: string, amount: number) {
  return mix(hex, "#ffffff", amount);
}

function darken(hex: string, amount: number) {
  return mix(hex, "#000000", amount);
}

function getLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);

  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  const R = channel(r);
  const G = channel(g);
  const B = channel(b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function getReadableTextColor(hex: string) {
  return getLuminance(hex) > 0.45 ? "#111827" : "#ffffff";
}

function getIntroPalette(backgroundColor: string): IntroPalette {
  const background = normalizeHex(backgroundColor);
  const gradientTop = lighten(background, 0.35);
  const gradientBottom = lighten(background, 0.15);
  const button = lighten(background, 0.42);
  const buttonText = getReadableTextColor(button);

  return {
    background,
    gradientTop,
    gradientBottom,
    title: getReadableTextColor(gradientBottom),
    description:
      getReadableTextColor(gradientBottom) === "#ffffff"
        ? "rgba(255,255,255,0.8)"
        : "rgba(17,24,39,0.72)",
    icon: lighten(background, 0.55),
    button,
    buttonText,
    dotActive: getReadableTextColor(gradientBottom),
    dotInactive:
      getReadableTextColor(gradientBottom) === "#ffffff"
        ? "rgba(255,255,255,0.45)"
        : "rgba(17,24,39,0.35)",
  };
}

export default function OnboardingScreen() {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();
  const { backgroundColor } = useTheme();

  const theme = useMemo(
    () => getIntroPalette(backgroundColor),
    [backgroundColor]
  );

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const goToNextSlide = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      router.replace("/signin");
    }
  };

  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              currentIndex === index
                ? [styles.activeDot, { backgroundColor: theme.dotActive }]
                : [styles.inactiveDot, { backgroundColor: theme.dotInactive }],
            ]}
          />
        ))}
      </View>
    );
  };

  const renderItem = ({ item }: { item: Slide }) => {
    const Icon = item.Icon;

    return (
      <View style={styles.slide}>
        <LinearGradient
          colors={[theme.gradientTop, theme.gradientBottom]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.card}
        >
          <View style={styles.topSpacer} />

          <View style={styles.content}>
            <View style={styles.iconWrapper}>
              <Icon size={44} color={theme.icon} strokeWidth={2.2} />
            </View>

            <Text style={[styles.title, { color: theme.title }]}>
              {item.title}
            </Text>

            <Text style={[styles.description, { color: theme.description }]}>
              {item.description}
            </Text>
          </View>

          <View style={styles.bottomArea}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.button }]}
              onPress={goToNextSlide}
            >
              <Text style={[styles.buttonText, { color: theme.buttonText }]}>
                {item.buttonText}
              </Text>
            </TouchableOpacity>

            {renderDots()}
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={
          getReadableTextColor(theme.background) === "#ffffff"
            ? "light-content"
            : "dark-content"
        }
      />
      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    width,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  card: {
    width: width * 0.88,
    height: "92%",
    borderRadius: 25,
    paddingHorizontal: 28,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  topSpacer: {
    height: 30,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },
  iconWrapper: {
    marginBottom: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 18,
  },
  description: {
    fontSize: 18,
    textAlign: "center",
    lineHeight: 26,
    maxWidth: 280,
  },
  bottomArea: {
    marginBottom: 28,
    alignItems: "center",
  },
  button: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  activeDot: {
    width: 9,
    height: 9,
  },
  inactiveDot: {},
});