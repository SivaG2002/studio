
"use client";

import type { Dispatch, SetStateAction } from 'react';
import React, { useState } from 'react';
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
  const [isHovered, setIsHovered] = useState(false);
  const { t } = useLanguage();

  return (
    <nav
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "fixed bottom-0 left-1/2 -translate-x-1/2 z-40 flex justify-center items-center h-16 bg-background/80 backdrop-blur-md border-t border-border rounded-t-lg shadow-lg",
        "w-auto max-w-xs sm:max-w-sm md:max-w-md px-4", 
        "transition-transform duration-300 ease-in-out",
        !isHovered ? "translate-y-[calc(100%_-_0.7rem)]" : "translate-y-0" // Adjusted: 0.2rem visible (5% of 4rem height)
      )}
    >
      <div className="flex space-x-3 sm:space-x-4"> 
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
                "flex flex-col items-center justify-center p-2 rounded-lg transition-colors group",
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
                  "text-xs",
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

