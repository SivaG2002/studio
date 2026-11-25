"use client";

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import React, { createContext, useState, useContext } from 'react';

interface CommandContextType {
  commandToExecute: string | null;
  setCommandToExecute: Dispatch<SetStateAction<string | null>>;
  promptToSend: string | null;
  setPromptToSend: Dispatch<SetStateAction<string | null>>;
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

export const CommandProvider = ({ children }: { children: ReactNode }) => {
  const [commandToExecute, setCommandToExecute] = useState<string | null>(null);
  const [promptToSend, setPromptToSend] = useState<string | null>(null);

  return (
    <CommandContext.Provider value={{
      commandToExecute,
      setCommandToExecute,
      promptToSend,
      setPromptToSend,
    }}>
      {children}
    </CommandContext.Provider>
  );
};

export const useCommand = (): CommandContextType => {
  const context = useContext(CommandContext);
  if (context === undefined) {
    throw new Error('useCommand must be used within a CommandProvider');
  }
  return context;
};
