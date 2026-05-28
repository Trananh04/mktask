import React from "react";
import { Button } from "@/components/ui/button";
import { HiOutlineExclamationCircle, HiHome } from "react-icons/hi2";
import { RotateCcw } from "lucide-react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
  retryText?: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry, retryText }) => {
  const router = useRouter();
  const { t } = useTranslation("common");

  return (
    <div className="pt-[20%] bg-[var(--background)] flex flex-col items-center justify-center px-6 text-center">
      <div className="animate-fadeIn">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center rounded-full bg-[var(--destructive)]/20 text-[var(--destructive)] shadow-md">
          <HiOutlineExclamationCircle size={36} />
        </div>

        {/* Title */}
        <h1 className="text-md font-bold text-[var(--foreground)] mb-3">
          {t("empty_state.error_occurred")}: {error || t("empty_state.unexpected_error")}
        </h1>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {onRetry && (
            <Button
              onClick={onRetry}
              className="sm:w-auto w-full flex items-center justify-center gap-2"
            >
              <RotateCcw />
              {retryText || t("empty_state.retry")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="sm:w-auto w-full flex items-center justify-center gap-2 border-[var(--border)]"
          >
            <HiHome size={18} /> {t("empty_state.back_to_dashboard")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ErrorState;
