
"use client";

import type { Dispatch, SetStateAction } from 'react';
import React from 'react';
import { Home, BrainCircuit, NotebookText, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import type { TranslationKey } from '@/lib/translations';

export type ActiveTab = 'home' | 'ai' | 'notes' | 'settings' | 'cmd';

interface BottomNavbarProps {
  activeTab: ActiveTab;
  setActiveTab: Dispatch<SetStateAction<ActiveTab>>;
}

const navItems = [
  { id: 'home', labelKey: 'nav.home' as TranslationKey, icon: Home, targetTab: 'home' as ActiveTab },
  { id: 'ai', labelKey: 'nav.ai' as TranslationKey, icon: BrainCircuit, targetTab: 'ai' as ActiveTab },
  { id: 'notes', labelKey: 'nav.notes' as TranslationKey, icon: NotebookText, targetTab: 'notes' as ActiveTab },
  { id: 'settings', labelKey: 'nav.settings' as TranslationKey, icon: Settings, targetTab: 'settings' as ActiveTab },
];

export default function BottomNavbar({ activeTab, setActiveTab }: BottomNavbarProps) {
  const { t } = useLanguage();

  return (
    <nav
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 flex h-16 justify-center items-center bg-background/80 backdrop-blur-md border-t border-border shadow-lg",
        "px-1 sm:left-1/2 sm:right-auto sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:px-4 sm:rounded-t-lg"
      )}
    >
      <div className="grid w-full grid-cols-4 sm:flex sm:justify-center sm:gap-3 md:gap-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          const isActive = activeTab === item.targetTab;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.targetTab)}
              aria-label={label}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center rounded-lg px-1 py-2 transition-colors group sm:px-3",
                isActive ? "" : "text-muted-foreground hover:text-foreground",
                !isActive && "hover:bg-transparent" 
              )}
            >
              <Icon
                className={cn(
                  "w-6 h-6 mb-1 transition-transform group-hover:scale-110",
                  isActive ? "text-gradient-active" : "group-hover:icon-hover-gradient"
                )}
              />
              <span
                className={cn(
                  "whitespace-nowrap text-xs leading-5",
                  isActive ? "text-gradient-active font-semibold" : "group-hover:icon-hover-gradient"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

