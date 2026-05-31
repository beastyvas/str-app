import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatStore {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
}));

const HISTORY_KEY = (userId: string) => `str_chat_history_${userId}`;
const MAX_STORED = 60; // keep last 60 messages

export async function loadChatHistory(userId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY(userId));
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export async function saveChatHistory(userId: string, messages: ChatMessage[]) {
  try {
    const toSave = messages.slice(-MAX_STORED);
    await AsyncStorage.setItem(HISTORY_KEY(userId), JSON.stringify(toSave));
  } catch {
    // silent
  }
}

export async function clearChatHistory(userId: string) {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY(userId));
  } catch {
    // silent
  }
}
