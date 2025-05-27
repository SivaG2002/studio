"use client";

import { suggestCommand, type SuggestCommandInput, type SuggestCommandOutput } from "@/ai/flows/suggest-command";
import Cursor from "@/components/cmd-web/Cursor";
import { useSettings } from "@/context/SettingsContext";
import { useCommand } from "@/context/CommandContext"; 
import { cn } from "@/lib/utils";
import React, { useState, useEffect, useRef, useCallback } from "react";

const APP_VERSION = "1.0.0.2024"; 

interface Line {
  id: string;
  content: React.ReactNode;
  type: "input" | "output" | "error" | "info";
}

let lineIdCounter = 0;
const generateLineId = () => `line-${lineIdCounter++}`; // Managed globally for simplicity here, reset in createInitialLines

export default function TerminalView() {
  const { promptName } = useSettings();
  const { commandToExecute, setCommandToExecute } = useCommand();

  const createInitialLines = useCallback(() => {
    lineIdCounter = 0; // Reset counter for unique IDs for this set of initial lines
    return [
      { id: generateLineId(), content: `TermAI [Version ${APP_VERSION}] (Prompt: ${promptName})`, type: "info" as const },
      { id: generateLineId(), content: "© TermAI CLI. All rights reserved.", type: "info" as const },
      { id: generateLineId(), content: <>&nbsp;</>, type: "info" as const },
    ];
  }, [promptName]); // Depends on promptName

  const [lines, setLines] = useState<Line[]>(() => createInitialLines());
  const [currentInput, setCurrentInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  // historyIndex: -1 means current input, 0 to commandHistory.length - 1 means browsing history
  const [historyIndex, setHistoryIndex] = useState(-1); 
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLines(createInitialLines());
    // lineIdCounter is reset within createInitialLines and correctly incremented.
    // createInitialLines dependency ensures this runs when promptName changes.
  }, [createInitialLines]);


  const scrollToBottom = () => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [lines, currentInput]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLine = useCallback((content: React.ReactNode, type: Line["type"]) => {
    // Ensure lineIdCounter continues to increment correctly for dynamically added lines.
    // generateLineId handles its own incrementing.
    setLines((prevLines) => [...prevLines, { id: generateLineId(), content, type }]);
  }, []); // setLines from useState is stable and doesn't need to be in deps

  const processCommand = useCallback((commandStr: string) => {
    const [command, ...args] = commandStr.trim().split(/\s+/);
    const fullArg = args.join(" ");

    switch (command.toLowerCase()) {
      case "cls":
        // createInitialLines will use the current promptName due to its own useCallback dependency
        setLines(createInitialLines()); 
        break;
      case "echo":
        addLine(fullArg || <>&nbsp;</>, "output");
        break;
      case "help":
        addLine("Available commands:", "output");
        addLine("  CLS          - Clears the screen.", "output");
        addLine("  ECHO [text]  - Displays messages.", "output");
        addLine("  DATE         - Displays the current date.", "output");
        addLine("  TIME         - Displays the current time.", "output");
        addLine("  VER          - Displays the CmdWeb version.", "output");
        addLine("  HELP         - Provides Help information for commands.", "output");
        addLine("  EXIT         - Exits the CmdWeb (simulated).", "output");
        break;
      case "date":
        addLine(new Date().toDateString(), "output");
        break;
      case "time":
        addLine(new Date().toLocaleTimeString(), "output");
        break;
      case "ver":
        // promptName is available in the closure of processCommand
        addLine(`CmdWeb [Version ${APP_VERSION}] (Prompt: ${promptName})`, "output");
        break;
      case "exit":
        addLine("Exiting CmdWeb... (This is a simulation)", "info");
        break;
      case "":
        break;
      default:
        addLine(
          `'${command}' is not recognized as an internal or external command, operable program or batch file.`,
          "error"
        );
        break;
    }
  }, [addLine, promptName, createInitialLines, setLines]); // setLines added due to 'cls' command

  const submitCommand = useCallback((commandToProcess: string) => {
    const trimmedCommand = commandToProcess.trim();
    // Display the command with the prompt
    const displayInput = (
      <>
        <span className="text-prompt-gradient">{promptName}</span>
        <span className="text-cmd-prompt">&gt;</span>
        {/* Replace spaces with non-breaking spaces for display */}
        {commandToProcess.replace(/ /g, '\u00A0')} 
      </>
    );
    addLine(displayInput, "input");

    if (trimmedCommand) {
      processCommand(trimmedCommand);
      // Add to command history only if it's a new, non-empty command
      // and not a duplicate of the immediate last command.
      setCommandHistory(prevCmdHistory => {
        if (prevCmdHistory.length === 0 || prevCmdHistory[prevCmdHistory.length - 1] !== trimmedCommand) {
          return [...prevCmdHistory, trimmedCommand];
        }
        return prevCmdHistory;
      });
    }
  }, [promptName, processCommand, addLine]); // Dependencies are correct


  const handleInternalSubmit = useCallback(() => {
    submitCommand(currentInput);
    setCurrentInput(""); 
    setHistoryIndex(-1); // Reset history index to current input line
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
  }, [currentInput, submitCommand]); // commandHistory.length removed as setHistoryIndex is now -1


  useEffect(() => {
    if (commandToExecute) {
      submitCommand(commandToExecute);
      setCommandToExecute(null); 
      inputRef.current?.focus(); 
    }
  }, [commandToExecute, setCommandToExecute, submitCommand]);

  const fetchSuggestions = useCallback(async (prefix: string) => {
    if (!prefix.trim() || prefix.includes(" ")) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const result: SuggestCommandOutput = await suggestCommand({ commandPrefix: prefix });
      setSuggestions(result.suggestions || []);
      setActiveSuggestionIndex(-1);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
    }
    setLoadingSuggestions(false);
  }, []);

  const debouncedFetchSuggestions = useCallback(
    debounce(fetchSuggestions, 300),
    [fetchSuggestions]
  );

  useEffect(() => {
    if (currentInput) {
      debouncedFetchSuggestions(currentInput);
    } else {
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
    }
  }, [currentInput, debouncedFetchSuggestions]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInternalSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length > 0 && activeSuggestionIndex !== -1) { // Cycle through suggestions
         setActiveSuggestionIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      } else if (suggestions.length > 0 && activeSuggestionIndex === -1) { // Activate last suggestion
        setActiveSuggestionIndex(suggestions.length - 1);
      } else if (commandHistory.length > 0) { // Cycle through command history
        if (historyIndex === -1) { // Currently on new input, go to last history item
          const newIdx = commandHistory.length - 1;
          setHistoryIndex(newIdx);
          setCurrentInput(commandHistory[newIdx]);
        } else if (historyIndex > 0) { // Go to previous history item
          const newIdx = historyIndex - 1;
          setHistoryIndex(newIdx);
          setCurrentInput(commandHistory[newIdx]);
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length > 0 && activeSuggestionIndex !== -1) { // Cycle through suggestions
        setActiveSuggestionIndex(prev => (prev >= suggestions.length - 1 ? 0 : prev + 1));
      } else if (suggestions.length > 0 && activeSuggestionIndex === -1) { // Activate first suggestion
         setActiveSuggestionIndex(0);
      } else if (commandHistory.length > 0 && historyIndex !== -1) { // Cycle through command history
        if (historyIndex < commandHistory.length - 1) { // Go to next history item
          const newIdx = historyIndex + 1;
          setHistoryIndex(newIdx);
          setCurrentInput(commandHistory[newIdx]);
        } else { // Was at last history item, go to current input line
          setHistoryIndex(-1);
          setCurrentInput(""); // Consider saving current typed input if needed
        }
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (suggestions.length > 0) {
        // Apply active suggestion or first suggestion if none active
        const suggestionToApply = suggestions[activeSuggestionIndex > -1 ? activeSuggestionIndex : 0];
        if (suggestionToApply) {
          setCurrentInput(suggestionToApply + " "); // Add space for easier next arg
          setSuggestions([]);
          setActiveSuggestionIndex(-1);
        }
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setCurrentInput(suggestion + " "); // Add space for easier next arg
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
    inputRef.current?.focus(); // Keep focus on input
  };

  // Debounce function utility (remains unchanged, but good to keep it co-located or in utils)
  // function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) { ... }


  return (
    <div 
      className="flex-grow flex flex-col focus:outline-none w-full h-full overflow-hidden"
      onClick={() => inputRef.current?.focus()}
      tabIndex={-1} 
    >
      <div className="flex-grow overflow-y-auto pr-2">
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
            {/* Content can be simple text or complex JSX (e.g. for formatted input lines) */}
            {line.content}
          </div>
        ))}
        <div className="flex items-center">
          <span className="text-prompt-gradient">{promptName}</span>
          <span className="text-cmd-prompt">&gt;</span>
          <span className="break-all text-cmd-input">{currentInput.replace(/ /g, '\u00A0')}</span>
          <Cursor />
        </div>
        <div ref={terminalEndRef} />
      </div>

      <input
        ref={inputRef}
        type="text"
        value={currentInput}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="opacity-0 w-0 h-0 absolute -top-96 -left-96" 
        aria-label="Command input"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck="false"
      />

      {suggestions.length > 0 && (
        <div className="mt-1 p-1 bg-cmd-suggestion rounded-sm shadow-md max-w-md">
          <ul className="text-cmd-suggestion-foreground">
            {suggestions.map((s, idx) => (
              <li
                key={idx}
                onClick={() => handleSuggestionClick(s)}
                className={cn(
                  "px-2 py-1 cursor-pointer hover:bg-cmd-suggestion-hover hover:text-cmd-suggestion-hover-foreground",
                  idx === activeSuggestionIndex && "bg-cmd-suggestion-active text-cmd-suggestion-active-foreground"
                )}
              >
                {s}
              </li>
            ))}
          </ul>
          {loadingSuggestions && <div className="text-xs text-muted-foreground p-1">Loading...</div>}
        </div>
      )}
    </div>
  );
}

function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
}
