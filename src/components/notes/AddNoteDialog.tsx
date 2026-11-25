// src/components/notes/AddNoteDialog.tsx
"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; 
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

interface AddNoteDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (note: { title: string; content: string }) => void;
}

export default function AddNoteDialog({ isOpen, onOpenChange, onSave }: AddNoteDialogProps) {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setContent("");
      setError(null);
      setIsSummarizing(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (!title.trim()) {
      setError(t("notes.titleRequired"));
      return;
    }
    if (!content.trim()) {
      setError(t("notes.contentRequired"));
      return;
    }
    setError(null); 
    onSave({ title, content });
  };

  const handleSummarizeClick = () => {
    setIsSummarizing(true);
    // Simulate API call
    setTimeout(() => {
      setIsSummarizing(false);
    }, 2500); 
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <DialogTitle className="text-foreground">{t("notes.addTitle")}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t("notes.addDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-foreground">
              {t("notes.titleLabel")}
            </Label>
            <div className="interactive-element-glow-wrapper rounded-md">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-10 bg-input text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                placeholder={t("notes.titlePlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content" className="text-foreground">
              {t("notes.contentLabel")}
            </Label>
            <div className="relative">
              <div className="interactive-element-glow-wrapper rounded-md">
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[120px] w-full pr-12 bg-input text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 resize-y"
                  placeholder={t("notes.contentPlaceholder")}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSummarizeClick}
                className={cn(
                  "group absolute right-2 top-2 h-8 w-8 p-1.5 z-10",
                  "hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                )}
                aria-label={t("notes.summarize")}
                disabled={isSummarizing}
              >
                <Sparkles
                  className={cn(
                    "w-5 h-5",
                    isSummarizing && "animate-processing-icon",
                    !isSummarizing && "transition-colors group-hover:icon-hover-gradient"
                  )}
                  aria-hidden="true"
                />
              </Button>
            </div>
          </div>
        </div>
        
        <div className="h-5 mb-2"> 
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse items-center space-y-2 sm:space-y-0 sm:flex-row sm:justify-end sm:space-x-4">
          <div className="interactive-element-glow-wrapper rounded-full w-full sm:w-auto">
            <DialogClose asChild>
              <Button
                type="button"
                className={cn(
                   "w-full sm:w-auto rounded-full bg-background hover:bg-background px-6 h-10 text-sm font-medium text-foreground",
                   "focus-visible:ring-0 focus-visible:ring-offset-0 active:scale-95"
                )}
              >
                {t("notes.cancel")}
              </Button>
            </DialogClose>
          </div>
          <div className="interactive-element-glow-wrapper rounded-full w-full sm:w-auto">
            <Button
              type="button"
              onClick={handleSave}
              className={cn(
                 "w-full sm:w-auto rounded-full bg-background hover:bg-background px-6 h-10 text-sm font-medium text-foreground",
                 "focus-visible:ring-0 focus-visible:ring-offset-0 active:scale-95"
              )}
            >
              {t("notes.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
