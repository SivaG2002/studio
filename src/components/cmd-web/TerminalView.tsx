"use client";

import { Button } from "@/components/ui/button";
import { useCommand } from "@/context/CommandContext";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { cn } from "@/lib/utils";
import { interpolate, localeTags, type TranslationKey } from "@/lib/translations";
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

let messageIdCounter = 0;
const generateId = () => {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  messageIdCounter += 1;
  return `${Date.now().toString(36)}-${messageIdCounter.toString(36)}-${Math.random().toString(36).slice(2)}`;
};

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

function createConversation(title: string): Conversation {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title,
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

const apiErrorKeys: Record<string, TranslationKey> = {
  openrouter_not_configured: "api.notConfigured",
  openrouter_unauthorized: "api.auth",
  openrouter_no_credits: "api.credits",
  rate_limited: "api.rateLimit",
  upstream_rate_limited: "api.rateLimit",
  upstream_unavailable: "api.unavailable",
  upstream_failed: "api.failed",
  connection_failed: "api.connection",
  missing_stream: "api.noStream",
  invalid_stream: "api.invalidStream",
  interrupted_stream: "api.interrupted",
  invalid_content_type: "api.contentType",
  request_too_large: "api.tooLarge",
  invalid_json: "api.invalidBody",
  invalid_messages: "api.invalidMessages",
  invalid_language: "api.invalidLanguage",
};

async function getResponseError(
  response: Response,
  t: (key: TranslationKey) => string,
): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && isRecord(body.error) && typeof body.error.code === "string") {
      const key = apiErrorKeys[body.error.code];
      if (key) return t(key);
    }
  } catch {
    return t("api.failed");
  }

  if (response.status === 401) return t("api.auth");
  if (response.status === 402) return t("api.credits");
  if (response.status === 429) return t("api.rateLimit");
  return t("api.failed");
}

async function consumeEventStream(
  response: Response,
  onContent: (content: string) => void,
  t: (key: TranslationKey) => string,
): Promise<void> {
  if (!response.body) throw new Error(t("api.noStream"));

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
      throw new Error(t("api.invalidStream"));
    }
    if (!isRecord(payload) || !Array.isArray(payload.choices)) {
      throw new Error(t("api.invalidStream"));
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
      throw new Error(t("api.interrupted"));
    }
  } finally {
    reader.releaseLock();
  }
}

export default function TerminalView() {
  const { promptName } = useSettings();
  const { language, t } = useLanguage();
  const {
    commandToExecute,
    setCommandToExecute,
    promptToSend,
    setPromptToSend,
  } = useCommand();

  const createInitialLines = useCallback(() => {
    lineIdCounter = 0;
    return [
      {
        id: generateLineId(),
        content: interpolate(t("terminal.banner"), { version: APP_VERSION, prompt: promptName }),
        type: "info" as const,
      },
      { id: generateLineId(), content: t("terminal.copyright"), type: "info" as const },
      { id: generateLineId(), content: <>&nbsp;</>, type: "info" as const },
    ];
  }, [promptName, t]);

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
      setStorageError(t("terminal.storageLoadError"));
    }

    const restoredConversations = savedState.conversations.length > 0
      ? savedState.conversations
      : [createConversation(t("terminal.newConversation"))];
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
  }, [createConversationLines, isHydrated, t]);

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
      setStorageError(t("terminal.storageSaveError"));
    }
  }, [activeConversationId, conversations, isHydrated, t]);

  useEffect(() => {
    if (!isHydrated) return;
    setLines((current) => [...createInitialLines(), ...current.slice(3)]);
  }, [createInitialLines, isHydrated]);

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
          language,
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

      if (!response.ok) throw new Error(await getResponseError(response, t));

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
      }, t);
    } catch (error) {
      if (controller.signal.aborted) {
        setRetryTurn(null);
        return;
      }

      setRequestError(error instanceof TypeError ? t("api.connection") : (
        error instanceof Error ? error.message : t("api.failed")
      ));
      setRetryTurn(target);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setGenerationTarget(null);
        setIsGenerating(false);
      }
    }
  }, [language, t]);

  const submitPrompt = useCallback(async (value: string) => {
    const text = value.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH || !isHydrated || !activeConversation) {
      if (text.length > MAX_MESSAGE_LENGTH) {
        setRequestError(interpolate(t("terminal.tooLong"), {
          length: MAX_MESSAGE_LENGTH.toLocaleString(localeTags[language]),
        }));
      }
      return;
    }
    if (abortControllerRef.current) return;

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: generateId(),
      text,
      sender: "user",
      createdAt: now,
    };
    const assistantMessage: ChatMessage = {
      id: generateId(),
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
  }, [activeConversation, generateResponse, isHydrated, language, promptName, t]);

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
        addLine(t("terminal.builtins"), "output");
        addLine(t("terminal.otherPrompt"), "info");
        return true;
      case "date":
        addLine(new Date().toLocaleDateString(localeTags[language], { dateStyle: "full" }), "output");
        return true;
      case "time":
        addLine(new Date().toLocaleTimeString(localeTags[language]), "output");
        return true;
      case "ver":
        addLine(interpolate(t("terminal.version"), { version: APP_VERSION, prompt: promptName }), "output");
        return true;
      case "exit":
        addLine(t("terminal.sessionOpen"), "info");
        return true;
      case "":
        return true;
      default:
        return false;
    }
  }, [addLine, createInitialLines, language, promptName, t]);

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
    const conversation = createConversation(t("terminal.newConversation"));
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
    if (!window.confirm(t("terminal.clearChatConfirm"))) return;

    const now = new Date().toISOString();
    const clearedConversation = {
      ...activeConversation,
      title: t("terminal.newConversation"),
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
    if (!window.confirm(t("terminal.clearMemoryConfirm"))) return;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear saved chat history from localStorage.", error);
      setStorageError(t("terminal.storageClearError"));
      return;
    }

    const freshConversation = createConversation(t("terminal.newConversation"));
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
        <label htmlFor="conversation-select" className="text-muted-foreground">{t("terminal.history")}</label>
        <select
          id="conversation-select"
          value={activeConversationId ?? ""}
          onChange={(event) => handleSelectConversation(event.target.value)}
          disabled={!isHydrated || isGenerating}
          className="max-w-56 rounded border border-border bg-background px-2 py-1 text-foreground"
        >
          {conversations.map((conversation) => (
            <option key={conversation.id} value={conversation.id}>
              {conversation.messages.length === 0
                ? t("terminal.newConversation")
                : conversation.title}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" onClick={handleNewConversation} disabled={!isHydrated || isGenerating}>
          {t("terminal.newChat")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClearChat}
          disabled={!isHydrated || isGenerating || !activeConversation?.messages.length}
        >
          {t("terminal.clearChat")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleClearMemory}
          disabled={!isHydrated || isGenerating}
        >
          {t("terminal.clearMemory")}
        </Button>
        {isGenerating && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => abortControllerRef.current?.abort()}
          >
            {t("terminal.stop")}
          </Button>
        )}
        {retryTurn && !isGenerating && retryTurn.conversationId === activeConversationId && (
          <Button type="button" variant="outline" size="sm" onClick={() => void handleRetry()}>
            {t("terminal.retry")}
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
              ? <span className="animate-pulse">{t("terminal.thinking")}</span>
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
            aria-label={t("terminal.prompt")}
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
