import { TimelineHeaderProps, ViewMode } from "@/types";
import { formatDateForDisplay } from "@/utils/date";
import { getViewModeWidth, isWeekend } from "@/utils/gantt";
import { useCallback, useMemo } from "react";

interface ExtendedTimelineHeaderProps extends TimelineHeaderProps {
  visibleRange?: { startIndex: number; endIndex: number };
  isGCalConnected?: boolean;
  onConnectGCal?: () => void;
}

// Timeline Header Component
export const TimelineHeader: React.FC<ExtendedTimelineHeaderProps> = ({
  timeRange,
  viewMode,
  isCompact,
  visibleRange,
  isGCalConnected,
  onConnectGCal,
}) => {
  const formatDateForView = useCallback((date: Date, mode: ViewMode): string => {
    try {
      switch (mode) {
        case "days":
          return formatDateForDisplay(date, "MMM D");
        case "weeks": {
          const weekEnd = new Date(date);
          weekEnd.setDate(weekEnd.getDate() + 6);
          return `${formatDateForDisplay(date, { month: "short", day: "numeric" })} - ${formatDateForDisplay(weekEnd, { month: "short", day: "numeric" })}`;
        }
        case "months":
          return formatDateForDisplay(date, { month: "long", year: "numeric" });
        default:
          return formatDateForDisplay(date);
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return date.toString();
    }
  }, []);

  const cellWidth = getViewModeWidth(viewMode);
  
  const { visibleDays, spacerLeft, spacerRight } = useMemo(() => {
    if (!visibleRange) {
      return {
        visibleDays: timeRange.days.map((day, index) => ({ day, index })),
        spacerLeft: 0,
        spacerRight: 0,
      };
    }

    const { startIndex, endIndex } = visibleRange;
    const visibleDays = timeRange.days
      .slice(startIndex, endIndex + 1)
      .map((day, i) => ({ day, index: startIndex + i }));
    
    const spacerLeft = startIndex * cellWidth;
    const spacerRight = (timeRange.days.length - 1 - endIndex) * cellWidth;

    return { visibleDays, spacerLeft, spacerRight };
  }, [timeRange.days, visibleRange, cellWidth]);

  return (
    <div className="flex min-h-[64.98px] sticky top-0 z-20 bg-[var(--card)] border-b border-[var(--border)] shadow-sm">
      <div
        className={`${
          isCompact ? "w-48" : "w-80"
        } bg-[var(--muted)] border-r border-[var(--border)] flex items-center justify-between px-4 py-3 shrink-0 sticky left-0 z-20`}
        role="columnheader"
      >
        <span className="text-sm font-semibold text-[var(--foreground)]">Tasks</span>
        {onConnectGCal && !isGCalConnected && (
          <button
            onClick={onConnectGCal}
            className="text-[10px] font-medium bg-white dark:bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-colors px-2 py-1 rounded shadow-sm flex items-center gap-1"
            title="Kết nối Lịch cá nhân"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z" />
            </svg>
            Google Cal
          </button>
        )}
      </div>
      <div className="flex flex-1" role="row">
        {spacerLeft > 0 && <div style={{ width: `${spacerLeft}px` }} className="shrink-0" />}
        {visibleDays.map(({ day, index }) => {
          const isToday = new Date().toDateString() === day.toDateString();
          return (
            <div
              key={index}
              className={`text-xs text-center py-3 border-r border-[var(--border)] shrink-0 ${
                isWeekend(day)
                  ? "bg-[var(--muted)] text-[var(--muted-foreground)]"
                  : isToday
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold"
                    : "bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              }`}
              style={{ width: `${cellWidth}px` }}
              role="columnheader"
            >
              <div className="break-words px-1">
                <div className="font-medium">
                  {formatDateForView(day, viewMode)}
                </div>
                {viewMode === "days" && (
                  <div className="text-[10px] opacity-60">
                    {formatDateForDisplay(day, "ddd")}
                  </div>
                )}
              </div>
              {isToday && viewMode === "days" && (
                <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mx-auto mt-1"></div>
              )}
            </div>
          );
        })}
        {spacerRight > 0 && <div style={{ width: `${spacerRight}px` }} className="shrink-0" />}
      </div>
    </div>
  );
};
