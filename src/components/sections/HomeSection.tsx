// src/components/sections/HomeSection.tsx
"use client";

import React, { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useCommand } from "@/context/CommandContext";
import type { ActiveTab } from "@/components/layout/BottomNavbar";
import Particles from "@/components/ui/particles";

interface HomeSectionProps {
  setActiveTab: Dispatch<SetStateAction<ActiveTab>>;
}

export default function HomeSection({ setActiveTab }: HomeSectionProps) {
  const [inputValue, setInputValue] = useState("");
  const { setCommandToExecute } = useCommand();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCommandSubmit = () => {
    if (inputValue.trim() && !isProcessing) {
      setIsProcessing(true);

      setTimeout(() => {
        setCommandToExecute(inputValue.trim());
        setActiveTab("ai");
        setInputValue("");
        setIsProcessing(false);
      }, 5000);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleCommandSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full items-center justify-center p-4 text-center relative">
      {/* Particle simulation background */}
      <Particles
        className="opacity-60"
        particleCount={80}
        speed={0.3}
        colors={["#ef4444", "#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b"]}
        enableConnections={true}
        connectionDistance={100}
      />

      <h1 className="text-5xl font-bold mb-4 text-static-gradient-sweep relative z-10">
        Welcome to TermAI
      </h1>

      <div
        className={cn(
          "relative w-full max-w-md mt-40 input-gradient-glow-wrapper rounded-full z-10",
          isProcessing && "processing"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "group absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-1.5 z-20", // z-20 is original, kept
            "hover:bg-transparent",
            "focus-visible:ring-0 focus-visible:ring-offset-0"
          )}
          aria-label="AI Search"
          onClick={handleCommandSubmit}
          disabled={isProcessing}
        >
          <Sparkles
            className={cn(
              "w-5 h-5",
              isProcessing
                ? "animate-processing-icon"
                : "transition-colors group-hover:icon-hover-gradient"
            )}
            aria-hidden="true"
          />
        </Button>
        <Input
          type="text"
          placeholder="Ask me anything..."
          className={cn(
            "w-full pl-4 pr-12 py-3 text-base md:text-sm rounded-full bg-input text-foreground",
            "focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          )}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          readOnly={isProcessing}
        />
      </div>
    </div>
  );
}
