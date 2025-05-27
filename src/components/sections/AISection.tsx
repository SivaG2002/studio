"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input"; // Assuming Input component exists
import { Button } from "@/components/ui/button"; // Assuming Button component exists
import { cn } from "@/lib/utils";

/**
 * Defines the structure for a chat message.
 * - id: Unique identifier for React key purposes.
 * - text: The content of the message.
 * - sender: Specifies who sent the message ('user', 'ai', or 'system' for notices).
 */
interface Message {
  id: number;
  text: string;
  sender: "user" | "ai" | "system";
}

// Simple counter to generate unique IDs for messages.
let messageIdCounter = 0;

export default function AISection() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Automatically scroll to the latest message when the messages array changes.
  useEffect(scrollToBottom, [messages]);

  const handleQuestionSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const question = inputValue.trim();
    if (!question) return;

    setMessages((prevMessages) => [
      ...prevMessages,
      { id: messageIdCounter++, text: question, sender: "user" },
    ]);
    setInputValue("");
    setIsLoading(true);

    // Simulate an AI response with a 15-second delay.
    // In a real application, this would be an API call to an AI service.
    setTimeout(() => {
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          id: messageIdCounter++, // Generate a new ID for the AI's message
          text: "This is a simulated AI response.",
          sender: "ai",
        },
      ]);
      setIsLoading(false); // Re-enable input after the response
    }, 15000); // 15-second delay
  }, [inputValue]);

  return (
    <div className="p-4 h-full flex flex-col items-center justify-center">
      <Card className="w-full max-w-2xl h-full flex flex-col">
        <CardHeader>
          <CardTitle>Ask AI</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col overflow-hidden">
          <div className="flex-grow overflow-y-auto space-y-4 p-4 bg-muted/50 rounded-md mb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "p-3 rounded-lg max-w-[75%] break-words",
                  msg.sender === "user"
                    ? "bg-primary text-primary-foreground self-end ml-auto"
                    : "bg-secondary text-secondary-foreground self-start mr-auto",
                  msg.sender === "system" && "bg-transparent text-muted-foreground text-sm text-center mx-auto"
                )}
              >
                {msg.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {isLoading && (
            <div className="text-center text-muted-foreground mb-2 animate-pulse">
              Processing...
            </div>
          )}

          <form onSubmit={handleQuestionSubmit} className="flex items-center space-x-2">
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your question to the AI..."
              disabled={isLoading}
              className="flex-grow"
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
