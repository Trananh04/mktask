import React, { useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FolderKanban,
  Gauge,
  ListChecks,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ManagementRiskLevel,
  ManagementSummary,
  ManagementWorkloadLevel,
} from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ManagementSummaryPanelProps {
  data: ManagementSummary | null;
}

type ProgressItem = {
  id: string;
  label: string;
  meta?: string;
  completionRate: number;
  totalTasks: number;
  activeTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  riskLevel?: ManagementRiskLevel;
  workloadLevel?: ManagementWorkloadLevel;
};

const emptySummary: ManagementSummary = {
  taskOverview: {
    totalTasks: 0,
    activeTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    blockedTasks: 0,
    dueSoonTasks: 0,
    completionRate: 0,
    overdueRate: 0,
  },
  workspaceProgress: [],
  projectProgress: [],
  memberProgress: [],
  deadlinePerformance: [],
  riskAlerts: [],
  blockers: [],
  delayedTasks: [],
  quickReport: {
    generatedAt: "",
    totalProjects: 0,
    atRiskProjects: 0,
    overloadedMembers: 0,
    overdueTasks: 0,
    blockedTasks: 0,
    topRiskProject: null,
  },
};

const riskLabel: Record<ManagementRiskLevel, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  CRITICAL: "Khẩn cấp",
};

const workloadLabel: Record<ManagementWorkloadLevel, string> = {
  LOW: "Ổn",
  MEDIUM: "Cần theo dõi",
  HIGH: "Quá tải",
};

const riskClass: Record<ManagementRiskLevel, string> = {
  LOW: "border-emerald-200 bg-transparent text-emerald-800 dark:border-emerald-800 dark:bg-transparent dark:text-emerald-400 font-bold",
  MEDIUM: "border-amber-200 bg-transparent text-amber-800 dark:border-amber-800 dark:bg-transparent dark:text-amber-400 font-bold",
  HIGH: "border-orange-200 bg-transparent text-orange-800 dark:border-orange-800 dark:bg-transparent dark:text-orange-400 font-bold",
  CRITICAL: "border-red-200 bg-transparent text-red-800 dark:border-red-800 dark:bg-transparent dark:text-red-400 font-bold",
};

const workloadClass: Record<ManagementWorkloadLevel, string> = {
  LOW: "border-emerald-200 bg-transparent text-emerald-800 dark:border-emerald-800 dark:bg-transparent dark:text-emerald-400 font-bold",
  MEDIUM: "border-amber-200 bg-transparent text-amber-800 dark:border-amber-800 dark:bg-transparent dark:text-amber-400 font-bold",
  HIGH: "border-red-200 bg-transparent text-red-800 dark:border-red-800 dark:bg-transparent dark:text-red-400 font-bold",
};

function formatPercent(value: number): string {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

// ─── Collapsible Section Component ──────────────────────────────────────────
function CollapsibleSection({
  title,
  icon,
  badge,
  badgeVariant = "default",
  defaultOpen = false,
  children,
  emptyText,
  isEmpty = false,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeVariant?: "default" | "warning" | "danger" | "success";
  defaultOpen?: boolean;
  children: React.ReactNode;
  emptyText?: string;
  isEmpty?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const badgeColors = {
    default: "bg-transparent text-[var(--muted-foreground)] font-bold",
    warning: "bg-transparent text-amber-800 dark:bg-transparent dark:text-amber-400 font-bold",
    danger: "bg-transparent text-red-800 dark:bg-transparent dark:text-red-400 font-bold",
    success: "bg-transparent text-emerald-800 dark:bg-transparent dark:text-emerald-400 font-bold",
  };

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors duration-150",
          "hover:bg-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          open ? "bg-transparent border-b border-[var(--border)]" : "bg-transparent"
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-[var(--primary)] flex-shrink-0">{icon}</span>
          <span className="text-sm font-bold text-[var(--foreground)] tracking-tight">{title}</span>
          {badge !== undefined && (
            <span className={cn("ml-1 rounded-full px-2 py-0.5 text-xs font-bold shadow-sm", badgeColors[badgeVariant])}>
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[var(--muted-foreground)] transition-transform duration-200 flex-shrink-0",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-5 pb-4 pt-3.5 bg-transparent">
          {isEmpty && emptyText ? (
            <p className="text-xs text-[var(--muted-foreground)]/80 font-medium py-3 text-center">{emptyText}</p>
          ) : children}
        </div>
      </div>
    </div>
  );
}

// ─── Metric Tile (compact) ────────────────────────────────────────────────────
function MetricTile({
  icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "bg-transparent text-sky-800 border-sky-200 dark:text-sky-400 dark:border-sky-800",
    success: "bg-transparent text-emerald-800 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800",
    warning: "bg-transparent text-amber-800 border-amber-200 dark:text-amber-400 dark:border-amber-800",
    danger: "bg-transparent text-red-800 border-red-200 dark:text-red-400 dark:border-red-800",
  }[tone];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-transparent p-4 flex items-center gap-3.5 shadow-sm hover:shadow transition-all duration-200">
      <div className={cn("rounded-lg border p-2.5 flex-shrink-0 shadow-sm", toneClass)}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]/90">{label}</p>
        <p className="text-2xl font-extrabold text-[var(--foreground)] tracking-tight mt-0.5 leading-none">{value}</p>
        <p className="text-[11px] font-medium text-[var(--muted-foreground)] mt-1.5 truncate">{detail}</p>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]/60 border border-[var(--border)]/20 shadow-inner">
      <div className={cn("h-full rounded-full transition-all shadow-sm", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ProgressRow({ item }: { item: ProgressItem }) {
  return (
    <div className="space-y-2 py-3 border-b border-[var(--border)] last:border-0">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--foreground)] tracking-tight">{item.label}</p>
          {item.meta && <p className="text-xs font-semibold text-[var(--muted-foreground)]/80 truncate mt-0.5">{item.meta}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.riskLevel && (
            <Badge variant="outline" className={cn("border text-[10px] px-2 py-0.5 shadow-sm", riskClass[item.riskLevel])}>
              {riskLabel[item.riskLevel]}
            </Badge>
          )}
          {item.workloadLevel && (
            <Badge variant="outline" className={cn("border text-[10px] px-2 py-0.5 shadow-sm", workloadClass[item.workloadLevel])}>
              {workloadLabel[item.workloadLevel]}
            </Badge>
          )}
          <span className="text-sm font-extrabold text-[var(--primary)] tabular-nums">{formatPercent(item.completionRate)}</span>
        </div>
      </div>
      <ProgressBar value={item.completionRate} />
      <div className="flex gap-4 text-xs font-semibold">
        <span className="text-[var(--muted-foreground)]/90">{item.totalTasks} việc</span>
        <span className="text-blue-600 dark:text-blue-400">{item.activeTasks} đang mở</span>
        {item.overdueTasks > 0 && <span className="text-red-600 dark:text-red-400">{item.overdueTasks} quá hạn</span>}
        {item.blockedTasks > 0 && <span className="text-amber-600 dark:text-amber-400">{item.blockedTasks} blocker</span>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ManagementSummaryPanel({ data }: ManagementSummaryPanelProps) {
  const { t } = useTranslation("workspace-home");
  const hasChartError = Boolean(data && typeof data === "object" && "error" in data);
  const summary = !data || hasChartError ? emptySummary : data;
  const overview = summary.taskOverview;
  const deadlineItems = summary.deadlinePerformance.length
    ? summary.deadlinePerformance
    : [
      { label: "overdue" as const, count: overview.overdueTasks },
      { label: "dueSoon" as const, count: overview.dueSoonTasks },
      { label: "noDueDate" as const, count: 0 },
    ];

  const workspaceItems: ProgressItem[] = summary.workspaceProgress.slice(0, 8).map((workspace) => ({
    id: workspace.workspaceId,
    label: workspace.workspaceName,
    meta: "Phòng ban / workspace",
    completionRate: workspace.completionRate,
    totalTasks: workspace.totalTasks,
    activeTasks: workspace.activeTasks,
    overdueTasks: workspace.overdueTasks,
    blockedTasks: workspace.blockedTasks,
  }));

  const projectItems: ProgressItem[] = summary.projectProgress.slice(0, 8).map((project) => ({
    id: project.projectId,
    label: project.projectName,
    meta: `${project.workspaceName}${project.endDate ? ` • Hạn ${formatDate(project.endDate)}` : ""}`,
    completionRate: project.completionRate,
    totalTasks: project.totalTasks,
    activeTasks: project.activeTasks,
    overdueTasks: project.overdueTasks,
    blockedTasks: project.blockedTasks,
    riskLevel: project.riskLevel,
  }));

  const memberItems: ProgressItem[] = summary.memberProgress.slice(0, 8).map((member) => ({
    id: member.memberId,
    label: member.memberName,
    meta: `${member.assignedTasks} việc được giao`,
    completionRate: member.completionRate,
    totalTasks: member.totalTasks,
    activeTasks: member.activeTasks,
    overdueTasks: member.overdueTasks,
    blockedTasks: member.blockedTasks,
    workloadLevel: member.workloadLevel,
  }));

  const reportLines = [
    t("manager_dashboard.report_completion", {
      defaultValue: "{{completed}}/{{total}} công việc đã hoàn thành, đạt {{rate}}.",
      completed: overview.completedTasks,
      total: overview.totalTasks,
      rate: formatPercent(overview.completionRate),
    }),
    t("manager_dashboard.report_open_work", {
      defaultValue: "{{active}} việc đang mở, trong đó {{inProgress}} việc đang làm và {{dueSoon}} việc sắp tới hạn.",
      active: overview.activeTasks,
      inProgress: overview.inProgressTasks,
      dueSoon: overview.dueSoonTasks,
    }),
    t("manager_dashboard.report_risk", {
      defaultValue: "{{projects}} dự án có rủi ro, {{overdue}} việc quá hạn, {{blocked}} việc đang bị chặn.",
      projects: summary.quickReport.atRiskProjects,
      overdue: summary.quickReport.overdueTasks,
      blocked: summary.quickReport.blockedTasks,
    }),
    ...(summary.quickReport.topRiskProject
      ? [
        t("manager_dashboard.report_top_risk", {
          defaultValue: "Dự án cần ưu tiên kiểm tra: {{project}}.",
          project: summary.quickReport.topRiskProject,
        }),
      ]
      : []),
  ];

  const hasBlockers = summary.blockers.length > 0;
  const hasDelays = summary.delayedTasks.length > 0;
  const hasRiskAlerts = summary.riskAlerts.length > 0;

  return (
    <Card className="border-[var(--border)] shadow-sm">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-5.5 w-5.5 text-[var(--primary)]" />
            <CardTitle className="text-lg font-bold text-[var(--foreground)] tracking-tight">
              {t("manager_dashboard.title", { defaultValue: "Báo cáo quản lý" })}
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs font-bold bg-[var(--accent)] border-[var(--border)] px-2.5 py-0.5 shadow-sm">
            {t("manager_dashboard.project_count", {
              defaultValue: "{{count}} dự án",
              count: summary.quickReport.totalProjects,
            })}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 space-y-3">
        {/* ── KPI Tiles (always visible) ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile
            icon={<ListChecks className="h-4 w-4" />}
            label={t("manager_dashboard.active_tasks", { defaultValue: "Đang mở" })}
            value={overview.activeTasks}
            detail={`${overview.inProgressTasks} việc đang thực hiện`}
          />
          <MetricTile
            icon={<Clock3 className="h-4 w-4" />}
            label={t("manager_dashboard.overdue_tasks", { defaultValue: "Quá hạn" })}
            value={overview.overdueTasks}
            detail={`${formatPercent(overview.overdueRate)} trên việc đang mở`}
            tone={overview.overdueTasks > 0 ? "danger" : "success"}
          />
          <MetricTile
            icon={<CheckCircle2 className="h-4 w-4" />}
            label={t("manager_dashboard.completed_tasks", { defaultValue: "Hoàn thành" })}
            value={overview.completedTasks}
            detail={`${formatPercent(overview.completionRate)} tỷ lệ hoàn thành`}
            tone="success"
          />
          <MetricTile
            icon={<ShieldAlert className="h-4 w-4" />}
            label={t("manager_dashboard.blockers", { defaultValue: "Blocker" })}
            value={overview.blockedTasks}
            detail={`${summary.quickReport.atRiskProjects} dự án có rủi ro`}
            tone={overview.blockedTasks > 0 ? "warning" : "success"}
          />
        </div>

        {/* ── Collapsible: Báo cáo nhanh ── */}
        <CollapsibleSection
          title={t("manager_dashboard.quick_report", { defaultValue: "Báo cáo nhanh" })}
          icon={<TrendingUp className="h-4 w-4" />}
          defaultOpen={true}
        >
          <ul className="space-y-2.5 text-[13px] font-medium text-[var(--foreground)]/85 leading-relaxed">
            {reportLines.map((line) => (
              <li key={line} className="flex gap-2.5 items-start">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)] shadow-sm" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {deadlineItems.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "rounded-xl p-3 text-center border border-[var(--border)] shadow-sm hover:shadow transition-all duration-200",
                  item.label === "overdue"
                    ? "border-red-200 bg-transparent dark:border-red-900/50"
                    : item.label === "dueSoon"
                      ? "border-amber-200 bg-transparent dark:border-amber-900/50"
                      : "bg-transparent border-[var(--border)]"
                )}
              >
                <p className={cn("text-2xl font-extrabold tracking-tight",
                  item.label === "overdue" ? "text-red-700 dark:text-red-400"
                    : item.label === "dueSoon" ? "text-amber-700 dark:text-amber-400"
                      : "text-[var(--foreground)]"
                )}>
                  {item.count}
                </p>
                <p className="text-[11px] font-bold text-[var(--muted-foreground)] mt-1 uppercase tracking-wide">
                  {item.label === "overdue"
                    ? "Quá hạn"
                    : item.label === "dueSoon"
                      ? "Sắp tới hạn"
                      : "Chưa có hạn"}
                </p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* ── Collapsible: Cảnh báo dự án ── */}
        <CollapsibleSection
          title={t("manager_dashboard.risk_alerts", { defaultValue: "Cảnh báo dự án" })}
          icon={<AlertTriangle className="h-4 w-4" />}
          badge={hasRiskAlerts ? summary.riskAlerts.length : undefined}
          badgeVariant={hasRiskAlerts ? "warning" : "default"}
          isEmpty={!hasRiskAlerts}
          emptyText="Chưa có dự án nào cần cảnh báo."
        >
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {summary.riskAlerts.slice(0, 6).map((alert) => (
              <div
                key={`${alert.projectId}-${alert.severity}`}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5 hover:bg-[var(--accent)] hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--foreground)]">{alert.projectName}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--muted-foreground)]/90 line-clamp-2 leading-relaxed">{alert.message}</p>
                  </div>
                  <Badge variant="outline" className={cn("border text-[10px] px-2 py-0.5 shrink-0 shadow-sm", riskClass[alert.severity])}>
                    {riskLabel[alert.severity]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* ── Collapsible: Tiến độ theo phòng ban ── */}
        <CollapsibleSection
          title={t("manager_dashboard.by_department", { defaultValue: "Tiến độ theo phòng ban" })}
          icon={<BriefcaseBusiness className="h-4 w-4" />}
          badge={workspaceItems.length || undefined}
          isEmpty={workspaceItems.length === 0}
          emptyText="Chưa có dữ liệu phòng ban."
        >
          <div className="divide-y divide-[var(--border)]">
            {workspaceItems.map((item) => <ProgressRow key={item.id} item={item} />)}
          </div>
        </CollapsibleSection>

        {/* ── Collapsible: Tiến độ theo dự án ── */}
        <CollapsibleSection
          title={t("manager_dashboard.by_project", { defaultValue: "Tiến độ theo dự án" })}
          icon={<FolderKanban className="h-4 w-4" />}
          badge={projectItems.length || undefined}
          isEmpty={projectItems.length === 0}
          emptyText="Chưa có dữ liệu dự án."
        >
          <div>
            {projectItems.map((item) => <ProgressRow key={item.id} item={item} />)}
          </div>
        </CollapsibleSection>

        {/* ── Collapsible: Hiệu suất nhân viên ── */}
        <CollapsibleSection
          title={t("manager_dashboard.by_member", { defaultValue: "Hiệu suất nhân viên" })}
          icon={<Users className="h-4 w-4" />}
          badge={memberItems.length || undefined}
          isEmpty={memberItems.length === 0}
          emptyText="Chưa có dữ liệu nhân viên."
        >
          <div>
            {memberItems.map((item) => <ProgressRow key={item.id} item={item} />)}
          </div>
        </CollapsibleSection>

        {/* ── Collapsible: Blocker cần xử lý ── */}
        <CollapsibleSection
          title={t("manager_dashboard.blocker_list", { defaultValue: "Blocker cần xử lý" })}
          icon={<ShieldAlert className="h-4 w-4" />}
          badge={summary.blockers.length || undefined}
          badgeVariant={hasBlockers ? "warning" : "default"}
          isEmpty={!hasBlockers}
          emptyText="Không có blocker đang mở."
        >
          <div className="space-y-2.5">
            {summary.blockers.slice(0, 8).map((blocker) => (
              <div key={blocker.taskId} className="rounded-xl border border-[var(--border)] bg-[var(--card)]/40 px-3.5 py-3 hover:bg-[var(--accent)] hover:shadow-sm transition-all duration-200">
                <p className="text-sm font-bold text-[var(--foreground)]">{blocker.taskTitle}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--muted-foreground)]/90 leading-relaxed">
                  {blocker.projectName} • {blocker.reason}
                  {blocker.blockingTaskTitle ? ` • Chặn bởi ${blocker.blockingTaskTitle}` : ""}
                </p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* ── Collapsible: Việc đang chậm ── */}
        <CollapsibleSection
          title={t("manager_dashboard.delayed_tasks", { defaultValue: "Việc đang chậm" })}
          icon={<Clock3 className="h-4 w-4" />}
          badge={summary.delayedTasks.length || undefined}
          badgeVariant={hasDelays ? "danger" : "default"}
          isEmpty={!hasDelays}
          emptyText="Không có việc chậm hoặc bị chặn."
        >
          <div className="space-y-2.5">
            {summary.delayedTasks.slice(0, 8).map((task) => (
              <div
                key={`${task.taskId}-${task.reason}`}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)]/40 px-3.5 py-3 hover:bg-[var(--accent)] hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--foreground)]">{task.taskTitle}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--muted-foreground)]/90 leading-relaxed">
                      {task.projectName}
                      {task.dueDate ? ` • Hạn ${formatDate(task.dueDate)}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("border font-bold text-[10px] px-2 py-0.5 shrink-0 shadow-sm",
                      task.reason === "overdue" ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400"
                    )}
                  >
                    {task.reason === "overdue" ? "Quá hạn" : "Blocked"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </CardContent>
    </Card>
  );
}
