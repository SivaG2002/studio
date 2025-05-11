// src/components/notes/NoteCard.tsx
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Note } from "@/types/notes";
import { formatDistanceToNow } from 'date-fns';


interface NoteCardProps {
  note: Note;
  onDelete: (noteId: string) => void;
}

export default function NoteCard({ note, onDelete }: NoteCardProps) {
  const timeAgo = formatDistanceToNow(new Date(note.createdAt), { addSuffix: true });

  return (
    <Card className="flex flex-col h-full bg-card shadow-lg hover:shadow-xl transition-shadow duration-200">
      <CardHeader>
        <CardTitle className="text-foreground text-lg break-words">{note.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto max-h-48"> {/* Added max-h-48 and overflow-y-auto */}
        <p className="text-foreground whitespace-pre-wrap break-words text-sm">
          {note.content}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between items-center border-t pt-4 mt-auto">
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(note.id)}
          aria-label="Delete note"
          className="text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
