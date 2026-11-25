// src/components/sections/NoteSection.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
// Input component is not directly used here, but its styling philosophy might be relevant
// import { Input } from "@/components/ui/input"; 
import { PlusCircle } from "lucide-react";
import AddNoteDialog from "@/components/notes/AddNoteDialog";
import NoteCard from "@/components/notes/NoteCard";
import type { Note } from "@/types/notes";
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

export default function NoteSection() {
  const { t } = useLanguage();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isAddNoteDialogOpen, setIsAddNoteDialogOpen] = useState(false);

  // Load notes from localStorage on component mount
  useEffect(() => {
    const storedNotes = localStorage.getItem('notes');
    if (storedNotes) {
      try {
        const parsedNotes: Note[] = JSON.parse(storedNotes).map((note: any) => ({
          ...note,
          createdAt: new Date(note.createdAt) // Ensure createdAt is a Date object
        }));
        setNotes(parsedNotes);
      } catch (error) {
        console.error("Failed to parse notes from localStorage", error);
        setNotes([]);
      }
    }
  }, []);

  // Save notes to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('notes', JSON.stringify(notes));
  }, [notes]);

  const handleAddNote = (newNote: { title: string; content: string }) => {
    const noteWithIdAndDate: Note = {
      id: Date.now().toString(),
      title: newNote.title,
      content: newNote.content,
      createdAt: new Date(),
    };
    setNotes((prevNotes) => [noteWithIdAndDate, ...prevNotes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    setIsAddNoteDialogOpen(false);
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId));
  };

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-foreground">{t("notes.title")}</h2>
        <div className="interactive-element-glow-wrapper rounded-full"> {/* Wrapper for the glow effect */}
          <Button
            onClick={() => setIsAddNoteDialogOpen(true)}
            className={cn(
              "w-auto rounded-full bg-background hover:bg-background px-6 h-10 text-sm font-medium text-foreground shadow-md", 
              "focus-visible:ring-0 focus-visible:ring-offset-0 active:scale-95"
            )}
          >
            <PlusCircle className="mr-2 h-5 w-5" /> {t("notes.add")}
          </Button>
        </div>
      </div>

      <AddNoteDialog
        isOpen={isAddNoteDialogOpen}
        onOpenChange={setIsAddNoteDialogOpen}
        onSave={handleAddNote}
      />

      {notes.length === 0 ? (
        <div className="flex-grow flex items-center justify-center">
          <p className="text-muted-foreground text-lg">
            {t("notes.empty")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-4">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} onDelete={handleDeleteNote} />
          ))}
        </div>
      )}
    </div>
  );
}
