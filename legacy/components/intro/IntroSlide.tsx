import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView} from "react-native";
import type { Slide } from "@/data/introSlides";

type Props = {
  item: Slide;
  width: number;
  onNext: () => void;
  onAudioPress: () => void;
  onChoicePress: (label: string) => void;
};

export default function IntroSlide({
  item,
  width,
  onNext,
  onAudioPress,
  onChoicePress,
}: Props) {
  switch (item.type) {
    case "bullets":
      return (
        <View style={[styles.slide, { width }]}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>

          <Text style={styles.question}>{item.question}</Text>

          <View style={styles.bulletList}>
            {item.bullets.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.audioButton} onPress={onAudioPress}>
            <Text style={styles.audioButtonText}>▶ {item.audioLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
            <Text style={styles.primaryButtonText}>{item.buttonLabel}</Text>
          </TouchableOpacity>
        </View>
      );

    case "text":
      return (
        <View style={[styles.slideCentered, { width }]}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.centerBody}>{item.body}</Text>

          <TouchableOpacity style={styles.primaryButtonBottom} onPress={onNext}>
            <Text style={styles.primaryButtonText}>{item.buttonLabel}</Text>
          </TouchableOpacity>
        </View>
      );

    case "audioList":
      return (
        <View style={[styles.slide, { width }]}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.smallSubtitle}>{item.subtitle}</Text>

          <View style={styles.audioList}>
            {item.audioButtons.map((label) => (
              <TouchableOpacity key={label} style={styles.audioListButton}>
                <Text style={styles.audioListButtonText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
            <Text style={styles.primaryButtonText}>{item.buttonLabel}</Text>
          </TouchableOpacity>
        </View>
      );

    case "story":
        return (
            <View style={[styles.slide, { width }]}>
            <Text style={styles.title}>{item.title}</Text>

            <ScrollView
                style={styles.storyScroll}
                contentContainerStyle={styles.storyScrollContent}
                showsVerticalScrollIndicator={false}
            >
                {item.paragraphs.map((paragraph, index) => (
                <Text key={index} style={styles.storyText}>
                    {paragraph}
                </Text>
                ))}
            </ScrollView>

            <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
                <Text style={styles.primaryButtonText}>{item.buttonLabel}</Text>
            </TouchableOpacity>
            </View>
        );

    case "choices":
      return (
        <View style={[styles.slide, { width }]}>
          <Text style={styles.title}>{item.title}</Text>

          <View style={styles.choiceContainer}>
            {item.choiceButtons.map((label) => (
              <TouchableOpacity
                key={label}
                style={styles.choiceButton}
                onPress={() => onChoicePress(label)}
              >
                <Text style={styles.choiceButtonText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );

    case "aboutMethod":
      return (
        <View style={[styles.slide, { width }]}>
          <Text style={styles.title}>{item.title}</Text>

          <View style={styles.aboutContainer}>
            {item.paragraphs.map((paragraph, index) => (
              <Text key={index} style={styles.aboutText}>
                {paragraph}
              </Text>
            ))}
          </View>

          <TouchableOpacity style={styles.readMoreButton}>
            <Text style={styles.readMoreButtonText}>{item.readMoreLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
            <Text style={styles.primaryButtonText}>{item.buttonLabel}</Text>
          </TouchableOpacity>
        </View>
      );
    case "learningOptions":
      return (
        <View style={[styles.slide, { width }]}>
        <Text style={styles.title}>{item.title}</Text>

        <View style={styles.learningOptionsContainer}>
            {item.optionButtons.map((label) => (
            <TouchableOpacity key={label} style={styles.learningOptionButton}>
                <Text style={styles.learningOptionButtonText}>{label}</Text>
            </TouchableOpacity>
            ))}
        </View>

        <Text style={styles.learningFooterText}>{item.footerText}</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
            <Text style={styles.primaryButtonText}>{item.buttonLabel}</Text>
        </TouchableOpacity>
        </View>
    );

    case "subscription":
      return (
        <View style={[styles.slide, { width }]}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subscriptionSubtitle}>{item.subtitle}</Text>

        <View style={styles.subscriptionBulletList}>
            {item.bullets.map((bullet) => (
            <View key={bullet} style={styles.subscriptionBulletRow}>
                <Text style={styles.subscriptionBulletDot}>•</Text>
                <Text style={styles.subscriptionBulletText}>{bullet}</Text>
            </View>
            ))}
        </View>

        <View style={styles.subscriptionButtonGroup}>
            <TouchableOpacity style={styles.secondaryActionButton}>
            <Text style={styles.secondaryActionButtonText}>
                {item.secondaryButtonLabel}
            </Text>
            </TouchableOpacity>

            <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => onChoicePress(item.primaryButtonLabel)}
            >
            <Text style={styles.primaryButtonText}>
                {item.primaryButtonLabel}
            </Text>
            </TouchableOpacity>
        </View>
        </View>
    );

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  slide: {
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 48,
    justifyContent: "space-between",
    alignItems: "center",
  },
  slideCentered: {
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 48,
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    marginTop: 20,
  },
  subtitle: {
    marginTop: 16,
    fontSize: 18,
    lineHeight: 26,
    color: "#ffffff",
    textAlign: "center",
    fontWeight: "600",
    maxWidth: 340,
  },
  smallSubtitle: {
    marginTop: 20,
    fontSize: 16,
    color: "#ffffff",
    textAlign: "center",
    fontWeight: "500",
  },
  question: {
    marginTop: 42,
    marginBottom: 24,
    fontSize: 18,
    lineHeight: 26,
    color: "#ffffff",
    textAlign: "center",
    fontWeight: "700",
    maxWidth: 340,
  },
  bulletList: {
    width: "100%",
    marginTop: 8,
    marginBottom: 24,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  bulletDot: {
    fontSize: 22,
    color: "#ffffff",
    marginRight: 10,
    lineHeight: 24,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: "#ffffff",
  },
  centerBody: {
    fontSize: 17,
    lineHeight: 28,
    color: "#ffffff",
    textAlign: "center",
    fontWeight: "600",
    maxWidth: 280,
    marginTop: 320,
    flex: 1,
    textAlignVertical: "center",
  },
  audioButton: {
    width: "100%",
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  audioButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000000",
    textAlign: "center",
  },
  audioList: {
    width: "100%",
    marginTop: 32,
    marginBottom: 24,
    gap: 18,
  },
  audioListButton: {
    width: "100%",
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  audioListButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
  },
  storyContainer: {
    width: "100%",
    flex: 1,
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 24,
  },
  storyText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#ffffff",
    textAlign: "left",
    marginBottom: 18,
  },
  aboutContainer: {
    width: "100%",
    flex: 1,
    justifyContent: "center",
    marginTop: 30,
    marginBottom: 24,
  },
  aboutText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#ffffff",
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 28,
  },
  choiceContainer: {
    width: "100%",
    flex: 1,
    justifyContent: "center",
    gap: 40,
  },
  choiceButton: {
    width: "100%",
    backgroundColor: "#ffffff",
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  readMoreButton: {
    width: "82%",
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  readMoreButtonText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "600",
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#ffffff",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonBottom: {
    width: "100%",
    backgroundColor: "#ffffff",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
  },
  storyScroll: {
  width: "100%",
  maxHeight: "65%",
  marginTop: 24,
  marginBottom: 24,
  },

  storyScrollContent: {
  paddingBottom: 20,
  },
  learningOptionsContainer: {
  width: "100%",
  flex: 1,
  justifyContent: "center",
  gap: 22,
  marginTop: 30,
},

learningOptionButton: {
  width: "100%",
  backgroundColor: "#ffffff",
  paddingVertical: 18,
  paddingHorizontal: 20,
  borderRadius: 18,
  alignItems: "center",
  justifyContent: "center",
},

learningOptionButtonText: {
  color: "#000000",
  fontSize: 16,
  fontWeight: "600",
  textAlign: "center",
},

learningFooterText: {
  fontSize: 15,
  lineHeight: 22,
  color: "#ffffff",
  textAlign: "center",
  fontWeight: "600",
  marginBottom: 24,
  maxWidth: 310,
},

subscriptionSubtitle: {
  marginTop: 28,
  fontSize: 18,
  color: "#ffffff",
  textAlign: "center",
  fontWeight: "600",
},

subscriptionBulletList: {
  width: "100%",
  flex: 1,
  justifyContent: "center",
  marginTop: 20,
  marginBottom: 20,
},

subscriptionBulletRow: {
  flexDirection: "row",
  alignItems: "flex-start",
  marginBottom: 18,
},

subscriptionBulletDot: {
  fontSize: 22,
  color: "#ffffff",
  marginRight: 10,
  lineHeight: 24,
},

subscriptionBulletText: {
  flex: 1,
  fontSize: 16,
  lineHeight: 22,
  color: "#ffffff",
},

subscriptionButtonGroup: {
  width: "100%",
  gap: 18,
},

secondaryActionButton: {
  width: "100%",
  backgroundColor: "#ffffff",
  paddingVertical: 18,
  borderRadius: 16,
  alignItems: "center",
  justifyContent: "center",
},

secondaryActionButtonText: {
  fontSize: 16,
  fontWeight: "600",
  color: "#000000",
},
});