export type Role = "user" | "asho";

export interface Message {
  id: string;
  role: Role;
  text: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

export type ContextMenuState =
  | { open: true; x: number; y: number; convId: string }
  | { open: false };

export type ConfirmState = { open: true; convId: string } | { open: false };
