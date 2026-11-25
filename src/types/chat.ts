export interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "ai";
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}
