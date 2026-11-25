"use client";

import { useSettings } from '@/context/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

export default function SettingsSection() {
  const { t } = useLanguage();
  const { promptName, setPromptName } = useSettings();
  const [localPromptName, setLocalPromptName] = useState(promptName);

  const handleSave = () => {
    setPromptName(localPromptName);
    // Optionally, add a toast notification for success
  };

  return (
    <div className="p-4 h-full flex flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("settings.title")}</CardTitle>
          <CardDescription>{t("settings.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="promptName">{t("settings.prefix")}</Label>
            <Input
              id="promptName"
              value={localPromptName}
              onChange={(e) => setLocalPromptName(e.target.value)}
              placeholder={t("settings.prefixPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.prefixDescription")}
            </p>
          </div>
          <Button onClick={handleSave} className="w-full">
            {t("settings.save")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
