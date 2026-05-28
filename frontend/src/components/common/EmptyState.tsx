import React from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { HiClipboardDocumentList } from "react-icons/hi2";
import { useTranslation } from "react-i18next";

interface EmptyStateProps {
  searchQuery?: string;
  priorityFilter?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ searchQuery = "", priorityFilter = "all" }) => {
  const { t } = useTranslation("common");
  
  const noTasksMessage =
    searchQuery || priorityFilter !== "all" 
      ? t("empty_state.no_tasks_found") 
      : t("empty_state.no_tasks_yet");
      
  const descriptionMessage =
    searchQuery || priorityFilter !== "all"
      ? t("empty_state.adjust_filters")
      : t("empty_state.create_first_task");

  return (
    <Card className="border-none bg-[var(--card)]">
      <CardContent className="p-8 text-center">
        <HiClipboardDocumentList
          size={48}
          className="mx-auto text-[var(--muted-foreground)] mb-4"
        />
        <CardTitle className="text-lg font-medium mb-2 text-[var(--foreground)]">
          {noTasksMessage}
        </CardTitle>
        <CardDescription className="text-sm text-[var(--muted-foreground)] mb-6">
          {descriptionMessage}
        </CardDescription>
      </CardContent>
    </Card>
  );
};

export default EmptyState;
