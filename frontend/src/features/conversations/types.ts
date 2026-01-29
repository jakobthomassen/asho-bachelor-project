export type Role = "user" | "asho";

export interface Message {
  id: string;
  role: Role;
  text: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  sessionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  messagesLoaded?: boolean;
}
