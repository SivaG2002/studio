// src/components/sections/HomeSection.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Dispatch, SetStateAction } from 'react';
import { Particles } from "@tsparticles/react";
import type { Engine } from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useCommand } from "@/context/CommandContext";
import type { ActiveTab } from "@/components/layout/BottomNavbar";

interface HomeSectionProps {
  setActiveTab: Dispatch<SetStateAction<ActiveTab>>;
}

export default function HomeSection({ setActiveTab }: HomeSectionProps) {
  const [inputValue, setInputValue] = useState("");
  const { setCommandToExecute } = useCommand();
  const [isProcessing, setIsProcessing] = useState(false);
  const [init, setInit] = useState(false);

  useEffect(() => {
    loadSlim(__tspackage_options => {}).then((engine) => {
      setInit(true);
    }).catch(error => {
      console.error("Error loading particles engine:", error);
    });
  }, []);

  const particlesLoaded = useCallback(async (container: any) => {
    // You can add any custom logic after particles are loaded if needed
    // console.log(container); 
  }, []);

  const handleCommandSubmit = () => {
    if (inputValue.trim() && !isProcessing) {
      setIsProcessing(true);
      
      setTimeout(() => {
        setCommandToExecute(inputValue.trim());
        setActiveTab('ai'); 
        setInputValue(""); 
        setIsProcessing(false);
      }, 5000); 
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleCommandSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full items-center justify-center p-4 text-center relative">
      {init && (
        <Particles
          id="tsparticles"
          particlesLoaded={particlesLoaded}
          options={{
            background: {
              color: {
                value: "transparent", // Make background transparent
              },
            },
            fpsLimit: 60,
            interactivity: {
              events: {
                onClick: {
                  enable: true,
                  mode: "push",
                },
                onHover: {
                  enable: true,
                  mode: "repulse",
                },
              },
              modes: {
                push: {
                  quantity: 4,
                },
                repulse: {
                  distance: 100,
                  duration: 0.4,
                },
              },
            },
            particles: {
              color: {
                value: "#ffffff",
              },
              links: {
                color: "#ffffff",
                distance: 150,
                enable: true,
                opacity: 0.5,
                width: 1,
              },
              move: {
                direction: "none",
                enable: true,
                outModes: {
                  default: "bounce",
                },
                random: false,
                speed: 2,
                straight: false,
              },
              number: {
                density: {
                  enable: true,
                },
                value: 80,
              },
              opacity: {
                value: 0.5,
              },
              shape: {
                type: "circle",
              },
              size: {
                value: { min: 1, max: 3 },
              },
            },
            detectRetina: true,
            fullScreen: { 
              enable: true, 
              zIndex: -1 // Ensure particles are in the background
            }
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: -1, // Ensure particles are in the background
          }}
        />
      )}
      <h1 className="text-5xl font-bold mb-4 text-static-gradient-sweep z-10">
        Welcome to TermAI
      </h1>

      <div className={cn(
        "relative w-full max-w-md mt-40 input-gradient-glow-wrapper rounded-full z-10", // Added z-10
        isProcessing && "processing" 
        )}>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "group absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-1.5 z-20", 
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
