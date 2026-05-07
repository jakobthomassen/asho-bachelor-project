import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../components/ThemeContext";
import { sendChatMessage, uuidv4 } from "../../api/chat";
import { createConversation } from "../../api/conversations";
import { useAuth } from "../../context/AuthContext";

type Message = {
  id: string;
  text: string;
  sender: "user" | "bot";
};

type StoredConversation = {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
};

type ChatPalette = {
  background: string;
  surface: string;
  surfaceSoft: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  userBubble: string;
  botBubble: string;
  buttonPrimary: string;
  buttonPrimaryText: string;
  inputBackground: string;
  chipBackground: string;
};

const HISTORY_STORAGE_KEY = "asho_conversations_v1";

const feelingOptions = [
  "Jeg føler meg urolig",
  "Jeg føler meg stresset",
  "Jeg føler meg tom",
  "Jeg føler meg overveldet",
  "Jeg føler meg trist",
  "Jeg trenger ro",
];

const clarifyOptions = ["Oppsummer", "Gi eksempel", "Vær konkret"];

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

function getChatPalette(backgroundColor: string): ChatPalette {
  const background = normalizeHex(backgroundColor);

  return {
    background,
    surface: darken(background, 0.12),
    surfaceSoft: lighten(background, 0.08),
    border: lighten(background, 0.22),
    textPrimary: getReadableTextColor(background),
    textSecondary:
      getReadableTextColor(background) === "#ffffff"
        ? "rgba(255,255,255,0.72)"
        : "rgba(17,24,39,0.72)",
    userBubble: lighten(background, 0.28),
    botBubble: darken(background, 0.18),
    buttonPrimary: lighten(background, 0.32),
    buttonPrimaryText: getReadableTextColor(lighten(background, 0.32)),
    inputBackground: darken(background, 0.1),
    chipBackground: darken(background, 0.06),
  };
}

export default function ChatScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  const { backgroundColor } = useTheme();
  const { sessionToken } = useAuth();
  const theme = useMemo(() => getChatPalette(backgroundColor), [backgroundColor]);
  const flatListRef = useRef<FlatList<Message>>(null);

  const displayName =
    typeof name === "string" && name.trim() ? name.trim() : "venn";

  const createBotMessage = (text?: string): Message => ({
    id: `${Date.now()}`,
    text: text ?? `Hei ${displayName}. Hvordan har du det akkurat nå?`,
    sender: "bot",
  });

  const [messages, setMessages] = useState<Message[]>([createBotMessage()]);
  const [input, setInput] = useState("");
  const [showFeelingOptions, setShowFeelingOptions] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionId] = useState(() => uuidv4());

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  useEffect(() => {
    setMessages([createBotMessage()]);
    setShowFeelingOptions(true);
    setConversationId(null);
  }, [displayName]);

  const ensureConversation = async (): Promise<string> => {
    if (conversationId) return conversationId;

    if (sessionToken) {
      const conv = await createConversation(sessionToken);
      setConversationId(conv.id);
      return conv.id;
    }

    const id = uuidv4();
    setConversationId(id);
    return id;
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: Message = { id: uuidv4(), text: trimmed, sender: "user" };
    setMessages((prev) => [...prev, userMsg]);
    setShowFeelingOptions(false);
    setIsSending(true);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const convId = await ensureConversation();
      const response = await sendChatMessage({
        conversationId: convId,
        sessionId,
        message: trimmed,
        sessionToken,
      });
      const botMsg: Message = { id: uuidv4(), text: response.reply, sender: "bot" };
      setMessages((prev) => [...prev, botMsg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "Noe gikk galt";
      const errMsg: Message = { id: uuidv4(), text: `Feil: ${detail}`, sender: "bot" };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = () => {
    if (!canSend) return;
    const text = input;
    setInput("");
    sendMessage(text);
  };

  const handleFeelingPress = (feeling: string) => {
    sendMessage(feeling);
  };

  const handleClarifyPress = (option: string) => {
    setInput(option);
  };

  const handleMicPress = () => {
    console.log("Mikrofon trykket");
  };

  const handleNewConversation = () => {
    setMessages([createBotMessage()]);
    setInput("");
    setShowFeelingOptions(true);
    setConversationId(null);

    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <View
          style={[
            styles.header,
            {
              borderBottomColor: theme.border,
              backgroundColor: theme.background,
            },
          ]}
        >
          <View>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
              ASHO
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Et trygt rom for refleksjon
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.newChatButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
            onPress={handleNewConversation}
          >
            <Ionicons name="add" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => {
            const isUser = item.sender === "user";

            return (
              <View
                style={[
                  styles.messageRow,
                  isUser ? styles.userRow : styles.botRow,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    isUser
                      ? [styles.userBubble, { backgroundColor: theme.userBubble }]
                      : [styles.botBubble, { backgroundColor: theme.botBubble }],
                  ]}
                >
                  <Text
                    style={[
                      isUser ? styles.userText : styles.botText,
                      {
                        color: isUser
                          ? getReadableTextColor(theme.userBubble)
                          : getReadableTextColor(theme.botBubble),
                      },
                    ]}
                  >
                    {item.text}
                  </Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            showFeelingOptions ? (
              <View style={styles.optionsSection}>
                <Text style={[styles.optionsTitle, { color: theme.textSecondary }]}>
                  Velg det som passer best
                </Text>

                <ScrollView
                  horizontal={false}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.optionsList}
                >
                  {feelingOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.optionButton,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => handleFeelingPress(option)}
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          { color: getReadableTextColor(theme.surface) },
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
        />

        <View
          style={[
            styles.clarifyBar,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.border,
            },
          ]}
        >
          {clarifyOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.clarifyButton,
                {
                  backgroundColor: theme.chipBackground,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => handleClarifyPress(option)}
            >
              <Text
                style={[
                  styles.clarifyButtonText,
                  { color: getReadableTextColor(theme.chipBackground) },
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.border,
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                color: getReadableTextColor(theme.inputBackground),
                borderColor: theme.border,
              },
            ]}
            value={input}
            onChangeText={setInput}
            placeholder="Skriv hvordan du har det..."
            placeholderTextColor={theme.textSecondary}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.micButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
            onPress={handleMicPress}
          >
            <Ionicons
              name="mic-outline"
              size={20}
              color={getReadableTextColor(theme.surface)}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: theme.buttonPrimary },
              !canSend && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!canSend}
          >
            <Text
              style={[
                styles.sendButtonText,
                { color: theme.buttonPrimaryText },
              ]}
            >
              Send
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messagesList: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    width: "100%",
    marginBottom: 12,
  },
  userRow: {
    alignItems: "flex-end",
  },
  botRow: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  botBubble: {
    borderBottomLeftRadius: 4,
  },
  userText: {
    fontSize: 16,
    lineHeight: 22,
  },
  botText: {
    fontSize: 16,
    lineHeight: 22,
  },
  optionsSection: {
    marginTop: 8,
  },
  optionsTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 12,
  },
  optionsList: {
    gap: 10,
  },
  optionButton: {
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  optionButtonText: {
    fontSize: 15,
    textAlign: "center",
  },
  clarifyBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  clarifyButton: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  clarifyButtonText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sendButton: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});