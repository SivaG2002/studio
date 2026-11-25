
"use client";

import React, { useState } from 'react';
import BottomNavbar, { type ActiveTab } from './BottomNavbar';
import AISection from '@/components/sections/AISection';
import NoteSection from '@/components/sections/NoteSection';
import SettingsSection from '@/components/sections/SettingsSection';
import HomeSection from '@/components/sections/HomeSection'; 
import Image from 'next/image';

// The following import expects the user to create 'src/assets/logo.png'
// If this file doesn't exist, the application will fail to build.
// Please ensure 'src/assets/logo.png' is a valid image file.
import logoImage from '@/assets/logo.png';


export default function AppLayoutClient() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home'); 

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
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 sm:h-16 sm:px-6">
        <button
          onClick={() => setActiveTab('home')}
          className="p-0 m-0 bg-transparent border-none appearance-none cursor-pointer hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-opacity rounded"
          aria-label="CmdWeb Home"
        >
          <Image
            src={logoImage}
            alt="CmdWeb Logo"
            width={40} 
            height={40}
            priority 
            className="object-contain"
            data-ai-hint="logo brand"
          />
        </button>
        {/* Future elements for the right side of the header can be added here */}
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

