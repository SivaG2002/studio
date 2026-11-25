
"use client";

import React, { useState } from 'react';
import BottomNavbar, { type ActiveTab } from './BottomNavbar';
import AISection from '@/components/sections/AISection';
import NoteSection from '@/components/sections/NoteSection';
import SettingsSection from '@/components/sections/SettingsSection';
import HomeSection from '@/components/sections/HomeSection'; 
import Image from 'next/image';
import { Languages } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { isLanguage, languageOptions } from '@/lib/translations';

// The following import expects the user to create 'src/assets/logo.png'
// If this file doesn't exist, the application will fail to build.
// Please ensure 'src/assets/logo.png' is a valid image file.
import logoImage from '@/assets/logo.png';


export default function AppLayoutClient() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home'); 
  const { language, setLanguage, t, storageError } = useLanguage();

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HomeSection setActiveTab={setActiveTab} />; // Pass setActiveTab
      case 'ai':
        return <AISection />;
      case 'notes':
        return <NoteSection />;
      case 'settings':
        return <SettingsSection />;
      default:
        return <HomeSection setActiveTab={setActiveTab} />; // Fallback to home
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen w-full bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background px-4 sm:h-16 sm:px-6">
        <button
          onClick={() => setActiveTab('home')}
          className="p-0 m-0 bg-transparent border-none appearance-none cursor-pointer hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-opacity rounded"
          aria-label={t("header.home")}
        >
          <Image
            src={logoImage}
            alt={t("header.logo")}
            width={40} 
            height={40}
            priority 
            className="object-contain"
            data-ai-hint="logo brand"
          />
        </button>
        <div className="flex items-center gap-2">
          {storageError && (
            <span role="alert" className="hidden text-xs text-destructive sm:inline">
              {t("language.storageError")}
            </span>
          )}
          <Languages aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          <select
            aria-label={t("language.select")}
            title={t("language.select")}
            value={language}
            onChange={(event) => {
              const nextLanguage = event.target.value;
              if (isLanguage(nextLanguage)) setLanguage(nextLanguage);
            }}
            className="h-9 max-w-36 rounded-md border border-input bg-background px-2 text-sm text-foreground sm:max-w-none"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-16"> 
        <div className="p-4 md:p-6 lg:p-8 h-full">
          {renderContent()}
        </div>
      </main>
      <BottomNavbar activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

