"use client";

import type { ReactNode } from "react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  isLanguage,
  translate,
  type Language,
  type TranslationKey,
} from "@/lib/translations";

const LANGUAGE_STORAGE_KEY = "termai-language";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
  storageError: boolean;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage && isLanguage(savedLanguage)) {
        setLanguageState(savedLanguage);
      }
    } catch (error) {
      console.error("Failed to load the saved language preference.", error);
      setStorageError(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      setStorageError(false);
    } catch (error) {
      console.error("Failed to save the language preference.", error);
      setStorageError(true);
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translate(language, key),
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, storageError }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
}
