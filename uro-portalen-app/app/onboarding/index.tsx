import { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { router } from "expo-router";
import OnboardingSlide from "@/components/onboarding/OnboardingSlide";
import { onboardingSlides } from "@/constants/onboardingData";
import AccordionCard from "@/components/onboarding/AccordionCard";
import AudioPreviewCard from "@/components/onboarding/AudioPreviewCard";
import { useTheme } from "@/components/ui/ThemeContext";

const { width } = Dimensions.get("window");

export default function Onboarding() {
  const { colors: Colors } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const [step, setStep] = useState(0);
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);

  const handleNext = () => {
    if (step < onboardingSlides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: step + 1,
        animated: true,
      });
    } else {
      router.replace("/paywall");
    }
  };

  const handleSkip = () => {
    router.replace("/paywall");
  };

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setStep(index);
    setOpenAccordion(null);
  };

  const renderSlideContent = (slide: (typeof onboardingSlides)[number]) => {
    if (slide.type === "hero") {
      return (
        <View style={styles.heroContent}>
          <Text style={[styles.heroTitle, { color: Colors.text }]}>
            {slide.title}
          </Text>
          <Text style={[styles.heroSubtitle, { color: Colors.mutedText }]}>
            {slide.subtitle}
          </Text>
        </View>
      );
    }

    if (slide.type === "bullets") {
      return (
        <View style={styles.topContent}>
          <Text style={[styles.bulletsTitle, { color: Colors.text }]}>
            {slide.title}
          </Text>

          <View style={styles.list}>
            {slide.bullets?.map((item, i) => (
              <View key={i} style={styles.listItem}>
                <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
                <Text style={[styles.listText, { color: Colors.text }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (slide.type === "method") {
      return (
        <View style={styles.topContent}>
          <Text style={[styles.methodTitle, { color: Colors.text }]}>
            {slide.title}
          </Text>
          <Text style={[styles.methodSubtitle, { color: Colors.mutedText }]}>
            {slide.subtitle}
          </Text>

          <View style={styles.accordionGroup}>
            {slide.accordions?.map((accordion, i) => {
              const isOpen = openAccordion === i;

              return (
                <AccordionCard
                  key={i}
                  title={accordion.title}
                  content={accordion.content}
                  isOpen={isOpen}
                  onPress={() => setOpenAccordion(isOpen ? null : i)}
                />
              );
            })}
          </View>

          {slide.audio && (
            <AudioPreviewCard
              title={slide.audio.title}
              duration={slide.audio.duration}
            />
          )}
        </View>
      );
    }

    return null;
  };

  return (
    <FlatList
      ref={flatListRef}
      data={onboardingSlides}
      keyExtractor={(item) => item.id.toString()}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      renderItem={({ item }) => (
        <View style={{ width }}>
          <OnboardingSlide
            currentStep={step}
            totalSteps={onboardingSlides.length}
            onNext={handleNext}
            buttonText={item.buttonText}
            onSkip={handleSkip}
          >
            {renderSlideContent(item)}
          </OnboardingSlide>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  heroContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },

  heroTitle: {
    fontSize: 56,
    fontWeight: "700",
    marginBottom: 14,
  },

  heroSubtitle: {
    fontSize: 18,
    textAlign: "center",
    lineHeight: 30,
    maxWidth: 280,
  },

  topContent: {
    paddingTop: 110,
  },

  bulletsTitle: {
    fontSize: 44,
    fontWeight: "700",
    lineHeight: 52,
    marginBottom: 36,
  },

  list: {
    gap: 28,
  },

  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  dot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    marginTop: 9,
    marginRight: 18,
  },

  listText: {
    flex: 1,
    fontSize: 18,
    lineHeight: 34,
  },

  methodTitle: {
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 42,
    marginBottom: 14,
  },

  methodSubtitle: {
    fontSize: 17,
    lineHeight: 30,
    marginBottom: 24,
  },

  accordionGroup: {
    gap: 14,
    marginBottom: 20,
  },
});