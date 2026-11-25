"use client";

import { Button } from "@/components/ui/button";
import { useCommand } from "@/context/CommandContext";
import { useSettings } from "@/context/SettingsContext";
import { cn } from "@/lib/utils";
import type { ChatMessage, Conversation } from "@/types/chat";
import React, { useCallback, useEffect, useRef, useState } from "react";

const APP_VERSION = "1.0.0.2024";
const STORAGE_KEY = "termai-conversations";
const MAX_MESSAGE_LENGTH = 8_000;
const MAX_CONTEXT_MESSAGES = 40;

interface Line {
  id: string;
  content: React.ReactNode;
  type: "input" | "output" | "error" | "info";
}

interface RetryTurn {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
}

interface SavedChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
}

let lineIdCounter = 0;
const generateLineId = () => `line-${lineIdCounter++}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDate(value: unknown, fallback: string): string {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function normalizeMessage(value: unknown, index: number): ChatMessage | null {
  if (!isRecord(value)) return null;
  const sender = value.sender === "assistant" ? "ai" : value.sender;
  const text = typeof value.text === "string" ? value.text : value.content;
  if ((sender !== "user" && sender !== "ai") || typeof text !== "string") return null;

  const now = new Date().toISOString();
  return {
    id: typeof value.id === "string" || typeof value.id === "number"
      ? String(value.id)
      : `restored-${index}`,
    text,
    sender,
    createdAt: parseDate(value.createdAt, now),
  };
}

function normalizeConversation(value: unknown, index: number): Conversation | null {
  if (!isRecord(value) || !Array.isArray(value.messages)) return null;
  const messages = value.messages
    .map((message, messageIndex) => normalizeMessage(message, messageIndex))
    .filter((message): message is ChatMessage => message !== null);
  const now = new Date().toISOString();
  const firstUserMessage = messages.find((message) => message.sender === "user");

  return {
    id: typeof value.id === "string" || typeof value.id === "number"
      ? String(value.id)
      : `restored-conversation-${index}`,
    title: typeof value.title === "string" && value.title.trim()
      ? value.title
      : firstUserMessage?.text.slice(0, 40) || "New conversation",
    createdAt: parseDate(value.createdAt, now),
    updatedAt: parseDate(value.updatedAt, now),
    messages,
  };
}

function readSavedChatState(raw: string): SavedChatState {
  const parsed: unknown = JSON.parse(raw);
  let rawConversations: unknown[] = [];

  if (Array.isArray(parsed)) {
    rawConversations = parsed;
  } else if (isRecord(parsed) && Array.isArray(parsed.conversations)) {
    rawConversations = parsed.conversations;
  }

  let conversations = rawConversations
    .map((conversation, index) => normalizeConversation(conversation, index))
    .filter((conversation): conversation is Conversation => conversation !== null);

  if (conversations.length === 0 && Array.isArray(parsed)) {
    const legacyMessages = parsed
      .map((message, index) => normalizeMessage(message, index))
      .filter((message): message is ChatMessage => message !== null);
    if (legacyMessages.length > 0) {
      const firstUserMessage = legacyMessages.find((message) => message.sender === "user");
      const now = new Date().toISOString();
      conversations = [{
        id: "restored-legacy-conversation",
        title: firstUserMessage?.text.slice(0, 40) || "Restored conversation",
        createdAt: legacyMessages[0].createdAt,
        updatedAt: legacyMessages[legacyMessages.length - 1].createdAt || now,
        messages: legacyMessages,
      }];
    }
  }

  const savedActiveId = isRecord(parsed) && typeof parsed.activeConversationId === "string"
    ? parsed.activeConversationId
    : null;

  return {
    conversations,
    activeConversationId: conversations.some((conversation) => conversation.id === savedActiveId)
      ? savedActiveId
      : conversations[0]?.id ?? null,
  };
}

function createConversation(): Conversation {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function formatTerminalOutput(text: string): string {
  return text
    .replace(/(^|\n)[ \t]*\* (?=\S)/g, "$1- ")
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
    .replace(/(^|\n)#{1,6}\s+/g, "$1")
    .replace(/`{1,3}/g, "");
}

async function getResponseError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && isRecord(body.error) && typeof body.error.message === "string") {
      return body.error.message;
    }
  } catch {
    // Fall through to the safe status-based message below.
  }

  if (response.status === 401) return "OpenRouter rejected the API key. Check the server configuration.";
  if (response.status === 402) return "OpenRouter reports that this request has no available credits.";
  if (response.status === 429) return "The AI service is busy. Please wait a moment and try again.";
  return "The AI request failed. Please try again.";
}

async function consumeEventStream(
  response: Response,
  onContent: (content: string) => void,
): Promise<void> {
  if (!response.body) throw new Error("The AI service returned no response stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventData: string[] = [];
  let receivedDone = false;

  const dispatchEvent = () => {
    if (eventData.length === 0) return;
    const data = eventData.join("\n");
    eventData = [];

    if (data === "[DONE]") {
      receivedDone = true;
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(data) as unknown;
    } catch {
      throw new Error("The AI service returned an invalid response stream.");
    }
    if (!isRecord(payload) || !Array.isArray(payload.choices)) {
      throw new Error("The AI service returned an invalid response stream.");
    }

    const firstChoice = payload.choices[0];
    if (!isRecord(firstChoice) || !isRecord(firstChoice.delta)) return;
    const content = firstChoice.delta.content;
    if (typeof content === "string" && content) onContent(content);
  };

  const processLine = (line: string) => {
    if (line === "") {
      dispatchEvent();
      return;
    }
    if (line.startsWith(":")) return;

    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "data") eventData.push(value);
  };

  try {
    while (!receivedDone) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        processLine(buffer.slice(0, newline).replace(/\r$/, ""));
        buffer = buffer.slice(newline + 1);
        if (receivedDone) break;
        newline = buffer.indexOf("\n");
      }
    }

    if (!receivedDone && buffer) processLine(buffer.replace(/\r$/, ""));
    if (!receivedDone && eventData.length > 0) dispatchEvent();
    if (!receivedDone) {
      throw new Error("The connection ended before the AI response was complete. Please retry.");
    }
  } finally {
    reader.releaseLock();
  }
}

export default function TerminalView() {
  const { promptName } = useSettings();
  const {
    commandToExecute,
    setCommandToExecute,
    promptToSend,
    setPromptToSend,
  } = useCommand();

  const createInitialLines = useCallback(() => {
    lineIdCounter = 0;
    return [
      { id: generateLineId(), content: `TermAI [Version ${APP_VERSION}] (Prompt: ${promptName})`, type: "info" as const },
      { id: generateLineId(), content: "© TermAI CLI. All rights reserved.", type: "info" as const },
      { id: generateLineId(), content: <>&nbsp;</>, type: "info" as const },
    ];
  }, [promptName]);

  const createConversationLines = useCallback((conversation: Conversation): Line[] => [
    ...createInitialLines(),
    ...conversation.messages.map((message): Line => ({
      id: message.id,
      content: message.sender === "user"
        ? (
          <>
            <span className="text-prompt-gradient">{promptName}</span>
            <span className="text-cmd-prompt">&gt;</span>
            {message.text.replace(/ /g, "\u00A0")}
          </>
        )
        : message.text,
      type: message.sender === "user" ? "input" : "output",
    })),
  ], [createInitialLines, promptName]);

  const [lines, setLines] = useState<Line[]>(() => createInitialLines());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentInput, setCurrentInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTarget, setGenerationTarget] = useState<RetryTurn | null>(null);
  const [retryTurn, setRetryTurn] = useState<RetryTurn | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );

  useEffect(() => {
    if (isHydrated) return;

    let savedState: SavedChatState = { conversations: [], activeConversationId: null };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) savedState = readSavedChatState(raw);
    } catch (error) {
      console.error("Failed to restore chat history from localStorage.", error);
      setStorageError("Saved chat history could not be read. A new conversation was started.");
    }

    const restoredConversations = savedState.conversations.length > 0
      ? savedState.conversations
      : [createConversation()];
    const restoredActiveId = restoredConversations.some(
      (conversation) => conversation.id === savedState.activeConversationId,
    )
      ? savedState.activeConversationId
      : restoredConversations[0].id;
    const restoredConversation = restoredConversations.find(
      (conversation) => conversation.id === restoredActiveId,
    ) || restoredConversations[0];

    setConversations(restoredConversations);
    setActiveConversationId(restoredConversation.id);
    setLines(createConversationLines(restoredConversation));
    setIsHydrated(true);
  }, [createConversationLines, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        conversations,
        activeConversationId,
      }));
      setStorageError(null);
    } catch (error) {
      console.error("Failed to save chat history to localStorage.", error);
      setStorageError("Chat history could not be saved in this browser.");
    }
  }, [activeConversationId, conversations, isHydrated]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [lines]);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (
      isHydrated
      && !isGenerating
      && window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ) {
      inputRef.current?.focus();
    }
  }, [isGenerating, isHydrated]);

  const addLine = useCallback((content: React.ReactNode, type: Line["type"]) => {
    setLines((previous) => [...previous, { id: generateLineId(), content, type }]);
  }, []);

  const generateResponse = useCallback(async (
    target: RetryTurn,
    history: ChatMessage[],
  ) => {
    if (abortControllerRef.current) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setGenerationTarget(target);
    setIsGenerating(true);
    setRequestError(null);
    setRetryTurn(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history
            .filter((message) => message.text.trim())
            .slice(-MAX_CONTEXT_MESSAGES)
            .map((message) => ({
              role: message.sender === "ai" ? "assistant" : "user",
              content: message.text,
            })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(await getResponseError(response));

      await consumeEventStream(response, (content) => {
        setConversations((current) => current.map((conversation) => {
          if (conversation.id !== target.conversationId) return conversation;
          return {
            ...conversation,
            updatedAt: new Date().toISOString(),
            messages: conversation.messages.map((message) => message.id === target.assistantMessageId
              ? { ...message, text: message.text + content }
              : message),
          };
        }));
        setLines((current) => current.map((line) => line.id === target.assistantMessageId
          ? {
            ...line,
            content: (typeof line.content === "string" ? line.content : "") + content,
          }
          : line));
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setRetryTurn(null);
        return;
      }

      setRequestError(error instanceof Error
        ? error.message
        : "The AI request failed. Please try again.");
      setRetryTurn(target);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setGenerationTarget(null);
        setIsGenerating(false);
      }
    }
  }, []);

  const submitPrompt = useCallback(async (value: string) => {
    const text = value.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH || !isHydrated || !activeConversation) {
      if (text.length > MAX_MESSAGE_LENGTH) {
        setRequestError(`Messages must be ${MAX_MESSAGE_LENGTH.toLocaleString()} characters or fewer.`);
      }
      return;
    }
    if (abortControllerRef.current) return;

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      text,
      sender: "user",
      createdAt: now,
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      text: "",
      sender: "ai",
      createdAt: now,
    };
    const target = {
      conversationId: activeConversation.id,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
    };
    const history = [...activeConversation.messages, userMessage];

    setConversations((current) => current.map((conversation) => {
      if (conversation.id !== activeConversation.id) return conversation;
      return {
        ...conversation,
        title: conversation.messages.some((message) => message.sender === "user")
          ? conversation.title
          : text.slice(0, 40),
        updatedAt: now,
        messages: [...conversation.messages, userMessage, assistantMessage],
      };
    }));
    setLines((current) => [
      ...current,
      {
        id: userMessage.id,
        content: (
          <>
            <span className="text-prompt-gradient">{promptName}</span>
            <span className="text-cmd-prompt">&gt;</span>
            {text.replace(/ /g, "\u00A0")}
          </>
        ),
        type: "input",
      },
      { id: assistantMessage.id, content: "", type: "output" },
    ]);
    setCurrentInput("");
    setRequestError(null);
    setRetryTurn(null);
    setCommandHistory((previous) => previous[previous.length - 1] === text
      ? previous
      : [...previous, text]);
    await generateResponse(target, history);
  }, [activeConversation, generateResponse, isHydrated, promptName]);

  const processCommand = useCallback((commandStr: string): boolean => {
    const [command, ...args] = commandStr.trim().split(/\s+/);
    const fullArg = args.join(" ");

    switch (command.toLowerCase()) {
      case "cls":
        setLines(createInitialLines());
        return true;
      case "echo":
        addLine(fullArg || <>&nbsp;</>, "output");
        return true;
      case "help":
        addLine("Built-in commands: CLS, ECHO [text], DATE, TIME, VER, HELP, EXIT.", "output");
        addLine("Any other text is sent to the AI assistant.", "info");
        return true;
      case "date":
        addLine(new Date().toDateString(), "output");
        return true;
      case "time":
        addLine(new Date().toLocaleTimeString(), "output");
        return true;
      case "ver":
        addLine(`CmdWeb [Version ${APP_VERSION}] (Prompt: ${promptName})`, "output");
        return true;
      case "exit":
        addLine("Terminal session remains open.", "info");
        return true;
      case "":
        return true;
      default:
        return false;
    }
  }, [addLine, createInitialLines, promptName]);

  const submitCommand = useCallback((value: string) => {
    if (abortControllerRef.current) return;
    const text = value.trim();
    if (!text) return;

    const [command] = text.split(/\s+/);
    const builtInCommands = ["cls", "echo", "help", "date", "time", "ver", "exit"];
    if (builtInCommands.includes(command.toLowerCase())) {
      const displayInput = (
        <>
          <span className="text-prompt-gradient">{promptName}</span>
          <span className="text-cmd-prompt">&gt;</span>
          {value.replace(/ /g, "\u00A0")}
        </>
      );
      addLine(displayInput, "input");
      processCommand(text);
      setCommandHistory((previous) => previous[previous.length - 1] === text
        ? previous
        : [...previous, text]);
      return;
    }

    void submitPrompt(text);
  }, [addLine, processCommand, promptName, submitPrompt]);

  const handleInternalSubmit = useCallback(() => {
    if (!isHydrated || isGenerating || abortControllerRef.current) return;
    submitCommand(currentInput);
    setCurrentInput("");
    setHistoryIndex(-1);
  }, [currentInput, isGenerating, isHydrated, submitCommand]);

  const handleRetry = useCallback(async () => {
    if (!retryTurn || abortControllerRef.current) return;
    const conversation = conversations.find((item) => item.id === retryTurn.conversationId);
    if (!conversation) return;
    const userIndex = conversation.messages.findIndex(
      (message) => message.id === retryTurn.userMessageId,
    );
    if (userIndex === -1) return;

    const history = conversation.messages.slice(0, userIndex + 1);
    setConversations((current) => current.map((item) => item.id !== retryTurn.conversationId
      ? item
      : {
        ...item,
        updatedAt: new Date().toISOString(),
        messages: item.messages.map((message) => message.id === retryTurn.assistantMessageId
          ? { ...message, text: "" }
          : message),
      }));
    setLines((current) => current.map((line) => line.id === retryTurn.assistantMessageId
      ? { ...line, content: "" }
      : line));
    await generateResponse(retryTurn, history);
  }, [conversations, generateResponse, retryTurn]);

  const handleNewConversation = () => {
    if (isGenerating) return;
    const conversation = createConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    setLines(createConversationLines(conversation));
    setCurrentInput("");
    setRequestError(null);
    setRetryTurn(null);
    inputRef.current?.focus();
  };

  const handleClearChat = () => {
    if (!activeConversation || activeConversation.messages.length === 0 || isGenerating) return;
    if (!window.confirm("Clear all messages in this conversation?")) return;

    const now = new Date().toISOString();
    const clearedConversation = {
      ...activeConversation,
      title: "New conversation",
      updatedAt: now,
      messages: [],
    };
    setConversations((current) => current.map((conversation) =>
      conversation.id === activeConversation.id ? clearedConversation : conversation,
    ));
    setLines(createConversationLines(clearedConversation));
    setCurrentInput("");
    setCommandHistory([]);
    setHistoryIndex(-1);
    setRequestError(null);
    setRetryTurn(null);
    inputRef.current?.focus();
  };

  const handleClearMemory = () => {
    if (isGenerating) return;
    if (!window.confirm("Delete all saved conversations from this browser?")) return;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear saved chat history from localStorage.", error);
      setStorageError("Saved conversations could not be cleared in this browser.");
      return;
    }

    const freshConversation = createConversation();
    setConversations([freshConversation]);
    setActiveConversationId(freshConversation.id);
    setLines(createConversationLines(freshConversation));
    setCurrentInput("");
    setCommandHistory([]);
    setHistoryIndex(-1);
    setRequestError(null);
    setStorageError(null);
    setRetryTurn(null);
    inputRef.current?.focus();
  };

  const handleSelectConversation = (conversationId: string) => {
    if (isGenerating) return;
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    setActiveConversationId(conversation.id);
    setLines(createConversationLines(conversation));
    setRequestError(null);
    setRetryTurn(null);
    inputRef.current?.focus();
  };

  const pendingPrompt = promptToSend ?? commandToExecute;
  useEffect(() => {
    if (!isHydrated || !pendingPrompt || isGenerating || abortControllerRef.current) return;
    if (promptToSend !== null) setPromptToSend(null);
    if (commandToExecute !== null) setCommandToExecute(null);
    void submitPrompt(pendingPrompt);
  }, [
    commandToExecute,
    isGenerating,
    isHydrated,
    pendingPrompt,
    promptToSend,
    setCommandToExecute,
    setPromptToSend,
    submitPrompt,
  ]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleInternalSubmit();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (commandHistory.length > 0) {
        if (historyIndex === -1) {
          const newIndex = commandHistory.length - 1;
          setHistoryIndex(newIndex);
          setCurrentInput(commandHistory[newIndex]);
        } else if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setCurrentInput(commandHistory[newIndex]);
        }
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (commandHistory.length > 0 && historyIndex !== -1) {
        if (historyIndex < commandHistory.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setCurrentInput(commandHistory[newIndex]);
        } else {
          setHistoryIndex(-1);
          setCurrentInput("");
        }
      }
    }
  };

  return (
    <div className="flex h-full w-full flex-grow flex-col overflow-hidden focus:outline-none" tabIndex={-1}>
      <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-border/50 pb-2 text-sm">
        <label htmlFor="conversation-select" className="text-muted-foreground">Chat history</label>
        <select
          id="conversation-select"
          value={activeConversationId ?? ""}
          onChange={(event) => handleSelectConversation(event.target.value)}
          disabled={!isHydrated || isGenerating}
          className="max-w-56 rounded border border-border bg-background px-2 py-1 text-foreground"
        >
          {conversations.map((conversation) => (
            <option key={conversation.id} value={conversation.id}>{conversation.title}</option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" onClick={handleNewConversation} disabled={!isHydrated || isGenerating}>
          New chat
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClearChat}
          disabled={!isHydrated || isGenerating || !activeConversation?.messages.length}
        >
          Clear chat
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleClearMemory}
          disabled={!isHydrated || isGenerating}
        >
          Clear memory
        </Button>
        {isGenerating && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => abortControllerRef.current?.abort()}
          >
            Stop
          </Button>
        )}
        {retryTurn && !isGenerating && retryTurn.conversationId === activeConversationId && (
          <Button type="button" variant="outline" size="sm" onClick={() => void handleRetry()}>
            Retry
          </Button>
        )}
        {(requestError || storageError) && (
          <span role="alert" className="basis-full text-sm text-destructive">
            {requestError || storageError}
          </span>
        )}
      </div>

      <div
        className="flex-grow overflow-y-auto pr-2"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            className={cn("whitespace-pre-wrap break-words", {
              "text-cmd-input": line.type === "input",
              "text-cmd-output": line.type === "output",
              "text-cmd-error": line.type === "error",
              "text-cmd-info": line.type === "info",
            })}
          >
            {generationTarget?.assistantMessageId === line.id && !line.content
              ? <span className="animate-pulse">Thinking...</span>
              : line.type === "output" && typeof line.content === "string"
                ? formatTerminalOutput(line.content)
                : line.content}
          </div>
        ))}
        <div className="flex min-h-8 items-center">
          <span className="text-prompt-gradient">{promptName}</span>
          <span className="text-cmd-prompt">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={(event) => setCurrentInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onClick={(event) => event.stopPropagation()}
            className="min-w-0 flex-1 bg-transparent p-0 text-cmd-input caret-current outline-none"
            aria-label="Terminal chat prompt"
            autoCapitalize="sentences"
            autoCorrect="on"
            autoComplete="off"
            spellCheck
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={!isHydrated || isGenerating}
          />
        </div>
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
