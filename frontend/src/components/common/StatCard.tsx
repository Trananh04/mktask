import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  icon?: ReactNode;
  label: string;
  value: number | string | ReactNode;
  isLoading?: boolean;
  loadingPlaceholder?: ReactNode;
  statSuffix?: string | any; // e.g., "Active", "Total"
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  icon,
  label,
  value,
  isLoading = false,
  loadingPlaceholder = <span className="dashboard-loading-placeholder" />,
  statSuffix,
  className,
  onClick,
}: StatCardProps) {
  const isClickable = className?.includes("cursor-pointer") || !!onClick;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isClickable && onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div 
      className={`dashboard-stat-card transition-all duration-300 ${isClickable ? "hover:translate-y-[-2px] cursor-pointer" : ""} ${className || ""}`}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      <Card className={`dashboard-stat-card-inner transition-all duration-300 group ${isClickable ? "hover:bg-[var(--accent)] hover:shadow-md hover:ring-2 hover:ring-[var(--primary)]" : "hover:bg-[var(--accent)]"}`}>
        <CardContent className="dashboard-stat-content">
          <div className="dashboard-stat-header">
            <div className="dashboard-stat-indicator transition-all duration-300 group-hover:h-3 group-hover:bg-[var(--primary)]" />
            <h3 className="dashboard-stat-title">{label}</h3>
          </div>
          <div className="dashboard-single-stat-values">
            <span className="dashboard-stat-number">{isLoading ? loadingPlaceholder : value}</span>
            <div className="dashboard-stat-icon transition-transform duration-300 group-hover:scale-110 group-hover:text-[var(--primary)]">{icon}</div>
            {statSuffix && <span className="dashboard-stat-label-inline">{statSuffix}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
