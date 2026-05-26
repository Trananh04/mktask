import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-700",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-700",
  HIGH: "border-orange-200 bg-orange-50 text-orange-700",
  CRITICAL: "border-red-200 bg-red-50 text-red-700",
};

const workloadClass: Record<ManagementWorkloadLevel, string> = {
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-700",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-700",
  HIGH: "border-red-200 bg-red-50 text-red-700",
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
    default: "bg-sky-50 text-sky-700 border-sky-100",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    danger: "bg-red-50 text-red-700 border-red-100",
  }[tone];

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-[var(--muted-foreground)]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
        </div>
        <div className={cn("rounded-md border p-2", toneClass)}>{icon}</div>
      </div>
      <p className="mt-3 text-sm text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]">
      <div
        className="h-full rounded-full bg-[var(--primary)] transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function ProgressList({
  title,
  icon,
  items,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  items: ProgressItem[];
  emptyText: string;
}) {
  return (
    <section className="rounded-md border border-[var(--border)] p-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="text-[var(--primary)]">{icon}</div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      </div>
      <div className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">{emptyText}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {item.label}
                  </p>
                  {item.meta && (
                    <p className="text-xs text-[var(--muted-foreground)]">{item.meta}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {item.riskLevel && (
                    <Badge variant="outline" className={cn("border", riskClass[item.riskLevel])}>
                      {riskLabel[item.riskLevel]}
                    </Badge>
                  )}
                  {item.workloadLevel && (
                    <Badge
                      variant="outline"
                      className={cn("border", workloadClass[item.workloadLevel])}
                    >
                      {workloadLabel[item.workloadLevel]}
                    </Badge>
                  )}
                  <span className="text-sm font-semibold">{formatPercent(item.completionRate)}</span>
                </div>
              </div>
              <ProgressBar value={item.completionRate} />
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
                <span>{item.totalTasks} việc</span>
                <span>{item.activeTasks} đang mở</span>
                <span>{item.overdueTasks} quá hạn</span>
                <span>{item.blockedTasks} blocker</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

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

  const workspaceItems: ProgressItem[] = summary.workspaceProgress.slice(0, 5).map((workspace) => ({
    id: workspace.workspaceId,
    label: workspace.workspaceName,
    meta: t("manager_dashboard.department_meta", {
      defaultValue: "Phòng ban / workspace",
    }),
    completionRate: workspace.completionRate,
    totalTasks: workspace.totalTasks,
    activeTasks: workspace.activeTasks,
    overdueTasks: workspace.overdueTasks,
    blockedTasks: workspace.blockedTasks,
  }));

  const projectItems: ProgressItem[] = summary.projectProgress.slice(0, 5).map((project) => ({
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

  const memberItems: ProgressItem[] = summary.memberProgress.slice(0, 5).map((member) => ({
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
      defaultValue:
        "{{active}} việc đang mở, trong đó {{inProgress}} việc đang làm và {{dueSoon}} việc sắp tới hạn.",
      active: overview.activeTasks,
      inProgress: overview.inProgressTasks,
      dueSoon: overview.dueSoonTasks,
    }),
    t("manager_dashboard.report_risk", {
      defaultValue:
        "{{projects}} dự án có rủi ro, {{overdue}} việc quá hạn, {{blocked}} việc đang bị chặn.",
      projects: summary.quickReport.atRiskProjects,
      overdue: summary.quickReport.overdueTasks,
      blocked: summary.quickReport.blockedTasks,
    }),
  ];

  if (summary.quickReport.topRiskProject) {
    reportLines.push(
      t("manager_dashboard.report_top_risk", {
        defaultValue: "Dự án cần ưu tiên kiểm tra: {{project}}.",
        project: summary.quickReport.topRiskProject,
      })
    );
  }

  return (
    <Card className="border-[var(--border)]">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="h-5 w-5 text-[var(--primary)]" />
              {t("manager_dashboard.title", { defaultValue: "Báo cáo quản lý" })}
            </CardTitle>
            <CardDescription>
              {t("manager_dashboard.description", {
                defaultValue:
                  "Tổng hợp tiến độ, workload, deadline, blocker và rủi ro dự án.",
              })}
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit">
            {t("manager_dashboard.project_count", {
              defaultValue: "{{count}} dự án",
              count: summary.quickReport.totalProjects,
            })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            icon={<ListChecks className="h-5 w-5" />}
            label={t("manager_dashboard.active_tasks", { defaultValue: "Đang mở" })}
            value={overview.activeTasks}
            detail={t("manager_dashboard.active_tasks_detail", {
              defaultValue: "{{count}} việc đang thực hiện",
              count: overview.inProgressTasks,
            })}
          />
          <MetricTile
            icon={<Clock3 className="h-5 w-5" />}
            label={t("manager_dashboard.overdue_tasks", { defaultValue: "Quá hạn" })}
            value={overview.overdueTasks}
            detail={t("manager_dashboard.overdue_tasks_detail", {
              defaultValue: "{{rate}} trên việc đang mở",
              rate: formatPercent(overview.overdueRate),
            })}
            tone={overview.overdueTasks > 0 ? "danger" : "success"}
          />
          <MetricTile
            icon={<CheckCircle2 className="h-5 w-5" />}
            label={t("manager_dashboard.completed_tasks", { defaultValue: "Hoàn thành" })}
            value={overview.completedTasks}
            detail={t("manager_dashboard.completed_tasks_detail", {
              defaultValue: "{{rate}} tỷ lệ hoàn thành",
              rate: formatPercent(overview.completionRate),
            })}
            tone="success"
          />
          <MetricTile
            icon={<ShieldAlert className="h-5 w-5" />}
            label={t("manager_dashboard.blockers", { defaultValue: "Blocker" })}
            value={overview.blockedTasks}
            detail={t("manager_dashboard.blockers_detail", {
              defaultValue: "{{count}} dự án có rủi ro",
              count: summary.quickReport.atRiskProjects,
            })}
            tone={overview.blockedTasks > 0 ? "warning" : "success"}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <section className="rounded-md border border-[var(--border)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[var(--primary)]" />
              <h3 className="text-sm font-semibold">
                {t("manager_dashboard.quick_report", { defaultValue: "Báo cáo nhanh" })}
              </h3>
            </div>
            <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
              {reportLines.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {deadlineItems.map((item) => (
                <div key={item.label} className="rounded-md bg-[var(--muted)]/50 p-2">
                  <p className="text-lg font-semibold">{item.count}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {item.label === "overdue"
                      ? t("manager_dashboard.deadline_overdue", { defaultValue: "Quá hạn" })
                      : item.label === "dueSoon"
                        ? t("manager_dashboard.deadline_due_soon", { defaultValue: "Sắp tới hạn" })
                        : t("manager_dashboard.deadline_no_date", { defaultValue: "Chưa có hạn" })}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-[var(--border)] p-4 xl:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold">
                {t("manager_dashboard.risk_alerts", { defaultValue: "Cảnh báo dự án" })}
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {summary.riskAlerts.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  {t("manager_dashboard.no_risk_alerts", {
                    defaultValue: "Chưa có dự án nào cần cảnh báo.",
                  })}
                </p>
              ) : (
                summary.riskAlerts.slice(0, 4).map((alert) => (
                  <div
                    key={`${alert.projectId}-${alert.severity}`}
                    className="rounded-md border border-[var(--border)] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{alert.projectName}</p>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {alert.message}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn("border", riskClass[alert.severity])}>
                        {riskLabel[alert.severity]}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <ProgressList
            title={t("manager_dashboard.by_department", { defaultValue: "Tiến độ theo phòng ban" })}
            icon={<BriefcaseBusiness className="h-4 w-4" />}
            items={workspaceItems}
            emptyText={t("manager_dashboard.no_department_data", {
              defaultValue: "Chưa có dữ liệu phòng ban.",
            })}
          />
          <ProgressList
            title={t("manager_dashboard.by_project", { defaultValue: "Tiến độ theo dự án" })}
            icon={<FolderKanban className="h-4 w-4" />}
            items={projectItems}
            emptyText={t("manager_dashboard.no_project_data", {
              defaultValue: "Chưa có dữ liệu dự án.",
            })}
          />
          <ProgressList
            title={t("manager_dashboard.by_member", { defaultValue: "Hiệu suất nhân viên" })}
            icon={<Users className="h-4 w-4" />}
            items={memberItems}
            emptyText={t("manager_dashboard.no_member_data", {
              defaultValue: "Chưa có dữ liệu nhân viên.",
            })}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="rounded-md border border-[var(--border)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold">
                {t("manager_dashboard.blocker_list", { defaultValue: "Blocker cần xử lý" })}
              </h3>
            </div>
            <div className="space-y-3">
              {summary.blockers.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  {t("manager_dashboard.no_blockers", {
                    defaultValue: "Không có blocker đang mở.",
                  })}
                </p>
              ) : (
                summary.blockers.slice(0, 5).map((blocker) => (
                  <div key={blocker.taskId} className="rounded-md bg-[var(--muted)]/40 p-3">
                    <p className="text-sm font-medium">{blocker.taskTitle}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {blocker.projectName} • {blocker.reason}
                      {blocker.blockingTaskTitle ? ` • Chặn bởi ${blocker.blockingTaskTitle}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-md border border-[var(--border)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-red-600" />
              <h3 className="text-sm font-semibold">
                {t("manager_dashboard.delayed_tasks", { defaultValue: "Việc đang chậm" })}
              </h3>
            </div>
            <div className="space-y-3">
              {summary.delayedTasks.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  {t("manager_dashboard.no_delayed_tasks", {
                    defaultValue: "Không có việc chậm hoặc bị chặn.",
                  })}
                </p>
              ) : (
                summary.delayedTasks.slice(0, 5).map((task) => (
                  <div key={`${task.taskId}-${task.reason}`} className="rounded-md bg-[var(--muted)]/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{task.taskTitle}</p>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {task.projectName}
                          {task.dueDate ? ` • Hạn ${formatDate(task.dueDate)}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {task.reason === "overdue" ? "Quá hạn" : "Blocked"}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
