import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ClipboardList,
  Clock3,
  ExternalLink,
  FolderKanban,
  RefreshCw,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { SEO } from "@/components/common/SEO";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { TokenManager } from "@/lib/api";
import { aiProjectPlannerApi, AiProjectReportSummary } from "@/utils/api/aiProjectPlannerApi";
import {
  taskApi,
  TaskDailyReport,
  TaskReportTaskSummary,
  TaskStatusChangeRequest,
} from "@/utils/api/taskApi";
import { cn } from "@/lib/utils";

const today = new Date().toISOString().split("T")[0];

function getUserName(user: any) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return fullName || user?.email || "Nhân viên";
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatReportType(type: TaskDailyReport["type"]) {
  return type === "START_OF_DAY" ? "Đầu ngày" : "Cuối ngày";
}

function getProjectLabel(task?: TaskReportTaskSummary | null) {
  return task?.project?.name || "Chưa có dự án";
}

function getWorkspaceLabel(task?: TaskReportTaskSummary | null) {
  return task?.project?.workspace?.name || "Workspace";
}

function getTaskHref(task?: TaskReportTaskSummary | null) {
  const taskSlug = task?.slug || task?.id;
  if (!taskSlug) return null;

  const workspaceSlug = task?.project?.workspace?.slug;
  const projectSlug = task?.project?.slug;
  if (workspaceSlug && projectSlug) {
    return `/${encodeURIComponent(workspaceSlug)}/${encodeURIComponent(projectSlug)}/tasks/${encodeURIComponent(taskSlug)}`;
  }

  return `/tasks/${encodeURIComponent(taskSlug)}`;
}

function getProjectCount(reports: TaskDailyReport[]) {
  return new Set(reports.map((report) => report.task?.project?.id).filter(Boolean)).size;
}

function buildDailySummary(
  reports: TaskDailyReport[],
  pendingRequests: TaskStatusChangeRequest[],
  reviewedCount: number
) {
  const employeeCount = new Set(reports.map((report) => report.reporterId)).size;
  const projectNames = Array.from(
    new Set(reports.map((report) => report.task?.project?.name).filter(Boolean))
  ) as string[];
  const reportsWithProgress = reports.filter(
    (report) => typeof report.progressPercent === "number"
  );
  const averageProgress =
    reportsWithProgress.length > 0
      ? Math.round(
          reportsWithProgress.reduce((total, report) => total + (report.progressPercent || 0), 0) /
            reportsWithProgress.length
        )
      : null;
  const blockerReports = reports.filter((report) => report.blockers?.trim());
  const unreviewedCount = reports.length - reviewedCount;

  const health =
    reports.length === 0
      ? "Chưa có dữ liệu để đánh giá."
      : blockerReports.length > 0
        ? "Có vướng mắc cần manager theo dõi."
        : pendingRequests.length > 0
          ? "Có yêu cầu trạng thái đang chờ xử lý."
          : "Tình hình trong ngày đang ổn định.";

  const progressText =
    averageProgress === null
      ? "Chưa có số liệu tiến độ."
      : averageProgress >= 80
        ? `Tiến độ trung bình ${averageProgress}%, đang gần hoàn tất.`
        : averageProgress >= 50
          ? `Tiến độ trung bình ${averageProgress}%, đang đi đúng nhịp.`
          : `Tiến độ trung bình ${averageProgress}%, nên kiểm tra thêm để tránh chậm.`;

  return {
    employeeCount,
    projectNames,
    averageProgress,
    blockerReports,
    unreviewedCount,
    health,
    progressText,
  };
}

function buildProjectSummaries(
  reports: TaskDailyReport[],
  pendingRequests: TaskStatusChangeRequest[]
) {
  const groups = new Map<
    string,
    {
      projectId: string;
      projectName: string;
      workspaceName: string;
      reports: TaskDailyReport[];
      pendingRequests: TaskStatusChangeRequest[];
    }
  >();

  for (const report of reports) {
    const project = report.task?.project;
    const projectId = project?.id || "no-project";
    const existing = groups.get(projectId);
    if (existing) {
      existing.reports.push(report);
      continue;
    }

    groups.set(projectId, {
      projectId,
      projectName: project?.name || "Chưa có dự án",
      workspaceName: project?.workspace?.name || "Workspace",
      reports: [report],
      pendingRequests: [],
    });
  }

  for (const request of pendingRequests) {
    const project = request.task?.project;
    const projectId = project?.id || "no-project";
    const existing = groups.get(projectId);
    if (existing) {
      existing.pendingRequests.push(request);
      continue;
    }

    groups.set(projectId, {
      projectId,
      projectName: project?.name || "Chưa có dự án",
      workspaceName: project?.workspace?.name || "Workspace",
      reports: [],
      pendingRequests: [request],
    });
  }

  return Array.from(groups.values()).map((group) => {
    const reportsWithProgress = group.reports.filter(
      (report) => typeof report.progressPercent === "number"
    );
    const averageProgress =
      reportsWithProgress.length > 0
        ? Math.round(
            reportsWithProgress.reduce(
              (total, report) => total + (report.progressPercent || 0),
              0
            ) / reportsWithProgress.length
          )
        : null;
    const blockerReports = group.reports.filter((report) => report.blockers?.trim());
    const unreviewedReports = group.reports.filter((report) => report.status !== "REVIEWED");
    const taskNames = Array.from(
      new Set(group.reports.map((report) => report.task?.title).filter(Boolean))
    ) as string[];

    const issues: string[] = [];
    if (blockerReports.length > 0) {
      issues.push(`${blockerReports.length} báo cáo có vướng mắc cần xử lý.`);
    }
    if (averageProgress !== null && averageProgress < 50) {
      issues.push(`Tiến độ trung bình mới đạt ${averageProgress}%, có nguy cơ chậm.`);
    }
    if (group.pendingRequests.length > 0) {
      issues.push(`${group.pendingRequests.length} yêu cầu đổi trạng thái đang chờ duyệt.`);
    }
    if (unreviewedReports.length > 0) {
      issues.push(`${unreviewedReports.length} báo cáo chưa được manager xem.`);
    }
    if (issues.length === 0) {
      issues.push("Chưa phát hiện vấn đề nổi bật trong báo cáo hôm nay.");
    }

    const suggestions: string[] = [];
    if (blockerReports.length > 0) {
      suggestions.push(
        "Trao đổi nhanh với người báo cáo để làm rõ vướng mắc và chốt người hỗ trợ."
      );
    }
    if (averageProgress !== null && averageProgress < 50) {
      suggestions.push(
        "Rà lại phạm vi task, tách nhỏ đầu việc và ưu tiên các hạng mục chặn tiến độ."
      );
    }
    if (group.pendingRequests.length > 0) {
      suggestions.push(
        "Duyệt hoặc từ chối các yêu cầu trạng thái để bảng công việc phản ánh đúng thực tế."
      );
    }
    if (unreviewedReports.length > 0) {
      suggestions.push("Đánh dấu đã xem sau khi kiểm tra nội dung để tránh bỏ sót thông tin.");
    }
    if (suggestions.length === 0) {
      suggestions.push("Tiếp tục theo dõi tiến độ ngày mai và giữ nhịp cập nhật báo cáo đều đặn.");
    }

    return {
      ...group,
      averageProgress,
      blockerReports,
      unreviewedReports,
      taskNames,
      issues,
      suggestions,
    };
  });
}

export default function ReportsPage() {
  const router = useRouter();
  const { isAuthenticated, getCurrentUser, refreshCurrentUser } = useAuth();
  const currentUser = getCurrentUser();
  const [selectedDate, setSelectedDate] = useState(today);
  const [statusRequests, setStatusRequests] = useState<TaskStatusChangeRequest[]>([]);
  const [dailyReports, setDailyReports] = useState<TaskDailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<{
    overallSummary: string;
    projects: AiProjectReportSummary[];
  } | null>(null);
  const [isAiSummaryLoading, setIsAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [roleSynced, setRoleSynced] = useState(false);

  const canReview = currentUser?.role === "MANAGER" || currentUser?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    setRoleSynced(false);

    refreshCurrentUser()
      .then((freshUser) => {
        if (cancelled) return;

        const syncedUser = freshUser || currentUser;
        const syncedCanReview =
          syncedUser?.role === "MANAGER" || syncedUser?.role === "SUPER_ADMIN";

        setRoleSynced(true);
        if (syncedUser && !syncedCanReview) {
          router.replace("/projects");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoleSynced(true);
          if (currentUser && !canReview) {
            router.replace("/projects");
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReview, currentUser?.id, currentUser?.role, isAuthenticated, refreshCurrentUser, router]);

  useEffect(() => {
    if (roleSynced && currentUser && !canReview) {
      router.replace("/projects");
    }
  }, [canReview, currentUser, roleSynced, router]);

  const loadReports = useCallback(async () => {
    const organizationId = TokenManager.getCurrentOrgId();
    if (!organizationId || !canReview || !roleSynced) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [requests, reports] = await Promise.all([
        taskApi.getTaskStatusChangeRequests({
          organizationId,
          status: "PENDING",
        }),
        taskApi.getTaskDailyReports({
          organizationId,
          date: selectedDate,
        }),
      ]);
      setStatusRequests(requests);
      setDailyReports(reports);
    } catch (error) {
      toast.error("Không tải được báo cáo");
    } finally {
      setIsLoading(false);
    }
  }, [canReview, roleSynced, selectedDate]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const reportsByEmployee = useMemo(() => {
    return dailyReports.reduce<Record<string, TaskDailyReport[]>>((acc, report) => {
      const key = report.reporterId;
      acc[key] = acc[key] || [];
      acc[key].push(report);
      return acc;
    }, {});
  }, [dailyReports]);

  const reviewedCount = dailyReports.filter((report) => report.status === "REVIEWED").length;
  const dailySummary = useMemo(
    () => buildDailySummary(dailyReports, statusRequests, reviewedCount),
    [dailyReports, statusRequests, reviewedCount]
  );
  const reviewPercent =
    dailyReports.length > 0 ? Math.round((reviewedCount / dailyReports.length) * 100) : 0;
  const attentionCount =
    statusRequests.length + dailySummary.unreviewedCount + dailySummary.blockerReports.length;
  const projectSummaries = useMemo(
    () => buildProjectSummaries(dailyReports, statusRequests),
    [dailyReports, statusRequests]
  );

  useEffect(() => {
    const summarizeWithAi = async () => {
      if (isLoading || !canReview || projectSummaries.length === 0) {
        if (projectSummaries.length === 0) {
          setAiSummary(null);
          setAiSummaryError(null);
        }
        return;
      }

      setIsAiSummaryLoading(true);
      setAiSummaryError(null);
      try {
        const result = await aiProjectPlannerApi.summarizeReports({
          date: selectedDate,
          projects: projectSummaries.map((project) => ({
            projectId: project.projectId === "no-project" ? undefined : project.projectId,
            projectName: project.projectName,
            workspaceName: project.workspaceName,
            reports: project.reports.map((report) => ({
              reporterName: getUserName(report.reporter),
              taskTitle: report.task?.title,
              reportType: report.type,
              status: report.status,
              progressPercent: report.progressPercent,
              content: report.content,
              blockers: report.blockers,
            })),
            pendingRequests: project.pendingRequests.map((request) => ({
              requesterName: getUserName(request.requestedBy),
              taskTitle: request.task?.title,
              requestedStatusName: request.requestedStatus?.name,
              note: request.requesterNote,
            })),
          })),
        });
        setAiSummary({
          overallSummary: result.overallSummary,
          projects: result.projects,
        });
      } catch (error: any) {
        setAiSummary(null);
        setAiSummaryError(
          error?.response?.data?.message ||
            error?.response?.data?.error ||
            error?.message ||
            "AI chưa tóm tắt được báo cáo."
        );
      } finally {
        setIsAiSummaryLoading(false);
      }
    };

    summarizeWithAi();
  }, [canReview, isLoading, projectSummaries, selectedDate]);

  const reviewStatusRequest = async (
    request: TaskStatusChangeRequest,
    decision: "APPROVED" | "REJECTED"
  ) => {
    setReviewingId(request.id);
    try {
      await taskApi.reviewTaskStatusChangeRequest(request.id, { decision });
      toast.success(decision === "APPROVED" ? "Đã duyệt trạng thái" : "Đã từ chối yêu cầu");
      await loadReports();
    } catch (error) {
      toast.error("Không xử lý được yêu cầu");
    } finally {
      setReviewingId(null);
    }
  };

  const reviewDailyReport = async (report: TaskDailyReport) => {
    setReviewingId(report.id);
    try {
      await taskApi.reviewTaskDailyReport(report.id, {});
      toast.success("Đã đánh dấu báo cáo đã xem");
      await loadReports();
    } catch (error) {
      toast.error("Không cập nhật được báo cáo");
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <>
      <SEO title="Báo cáo" description="Báo cáo task hằng ngày và duyệt trạng thái" />
      <div className="dashboard-container">
        <div className="space-y-6">
          <PageHeader
            icon={<ClipboardList className="h-5 w-5" />}
            title="Báo cáo"
            description="Duyệt yêu cầu trạng thái và theo dõi báo cáo công việc theo ngày."
            actions={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <label className="flex h-10 w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 shadow-sm sm:w-auto">
                  <CalendarDays className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none sm:w-[9.5rem]"
                    aria-label="Ngày báo cáo"
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-center gap-2 rounded-md shadow-sm"
                  onClick={loadReports}
                  disabled={isLoading}
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  Làm mới
                </Button>
              </div>
            }
          />

          {isLoading ? (
            <div className="grid gap-4">
              <div className="h-24 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--muted)]/20" />
              <div className="h-56 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--muted)]/20" />
            </div>
          ) : (
            <>
              <section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-[var(--muted-foreground)]">
                        Cần xử lý hôm nay
                      </p>
                      <h2 className="mt-1 text-2xl font-bold tracking-normal">
                        {attentionCount === 0
                          ? "Không có điểm nghẽn"
                          : `${attentionCount} việc cần chú ý`}
                      </h2>
                      <p className="mt-1 text-sm font-medium text-[var(--muted-foreground)]">
                        {dailyReports.length === 0
                          ? "Chưa có báo cáo nào trong ngày đã chọn."
                          : `${dailyReports.length} báo cáo từ ${dailySummary.employeeCount} nhân viên, thuộc ${dailySummary.projectNames.length || 0} dự án.`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold",
                        attentionCount > 0
                          ? "bg-amber-50 text-amber-800"
                          : "bg-emerald-50 text-emerald-800"
                      )}
                    >
                      {attentionCount > 0 ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      {attentionCount > 0 ? "Cần kiểm tra" : "Ổn định"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-md bg-slate-50 p-3">
                      <ClipboardList className="h-4 w-4 text-slate-600" />
                      <p className="mt-2 text-xl font-bold">{dailyReports.length}</p>
                      <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                        Báo cáo
                      </p>
                    </div>
                    <div className="rounded-md bg-amber-50 p-3">
                      <AlertCircle className="h-4 w-4 text-amber-700" />
                      <p className="mt-2 text-xl font-bold">{statusRequests.length}</p>
                      <p className="text-xs font-semibold text-amber-800">Chờ duyệt</p>
                    </div>
                    <div className="rounded-md bg-blue-50 p-3">
                      <Clock3 className="h-4 w-4 text-blue-700" />
                      <p className="mt-2 text-xl font-bold">{dailySummary.unreviewedCount}</p>
                      <p className="text-xs font-semibold text-blue-800">Chưa xem</p>
                    </div>
                    <div className="rounded-md bg-red-50 p-3">
                      <X className="h-4 w-4 text-red-700" />
                      <p className="mt-2 text-xl font-bold">
                        {dailySummary.blockerReports.length}
                      </p>
                      <p className="text-xs font-semibold text-red-800">Vướng mắc</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-[var(--muted-foreground)]">
                        Tiến độ đọc báo cáo
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {reviewedCount}/{dailyReports.length}
                      </p>
                    </div>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald-50 text-sm font-bold text-emerald-800">
                      {reviewPercent}%
                    </span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${reviewPercent}%` }}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md border border-[var(--border)] p-3">
                      <p className="font-bold">{dailySummary.projectNames.length || 0}</p>
                      <p className="mt-1 text-xs font-medium text-[var(--muted-foreground)]">
                        dự án có báo cáo
                      </p>
                    </div>
                    <div className="rounded-md border border-[var(--border)] p-3">
                      <p className="font-bold">
                        {dailySummary.averageProgress === null
                          ? "-"
                          : `${dailySummary.averageProgress}%`}
                      </p>
                      <p className="mt-1 text-xs font-medium text-[var(--muted-foreground)]">
                        tiến độ trung bình
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="hidden" aria-hidden="true">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-slate-50 px-5 py-4">
                  <div>
                    <h2 className="text-lg font-bold">Tổng quan ngày báo cáo</h2>
                    <p className="text-sm font-medium text-[var(--muted-foreground)]">
                      Hệ thống tự tổng hợp báo cáo, tiến độ và các điểm cần chú ý.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
                    <TrendingUp className="h-4 w-4" />
                    {dailySummary.averageProgress === null
                      ? "Chưa có tiến độ"
                      : `${dailySummary.averageProgress}% trung bình`}
                  </span>
                </div>

                <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
                  <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Nhận định nhanh</p>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                        {dailyReports.length === 0
                          ? "Hôm nay chưa có báo cáo nào được gửi. Khi nhân viên gửi báo cáo, phần này sẽ tự cập nhật."
                          : `${dailySummary.health} Có ${dailyReports.length} báo cáo từ ${dailySummary.employeeCount} nhân viên, liên quan ${dailySummary.projectNames.length || 0} dự án.`}
                      </p>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                        {dailySummary.progressText}
                      </p>
                    </div>

                    {dailySummary.blockerReports.length > 0 && (
                      <div className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800">
                        <p className="font-semibold">Vướng mắc cần chú ý</p>
                        <ul className="mt-2 space-y-1">
                          {dailySummary.blockerReports.slice(0, 3).map((report) => (
                            <li key={report.id}>
                              {getUserName(report.reporter)}: {report.blockers}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                      <p className="text-xs font-bold uppercase text-[var(--muted-foreground)]">
                        Dự án có báo cáo
                      </p>
                      <p className="mt-1 text-xl font-bold">
                        {dailySummary.projectNames.length || 0}
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-[var(--muted-foreground)]">
                        {dailySummary.projectNames.slice(0, 3).join(", ") || "Chưa có"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                      <p className="text-xs font-bold uppercase text-[var(--muted-foreground)]">
                        Chưa xem
                      </p>
                      <p className="mt-1 text-xl font-bold">{dailySummary.unreviewedCount}</p>
                      <p className="mt-1 text-sm font-medium text-[var(--muted-foreground)]">
                        báo cáo cần manager đọc
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                      <p className="text-xs font-bold uppercase text-[var(--muted-foreground)]">
                        Vướng mắc
                      </p>
                      <p className="mt-1 text-xl font-bold">{dailySummary.blockerReports.length}</p>
                      <p className="mt-1 text-sm font-medium text-[var(--muted-foreground)]">
                        task đang bị chặn
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <Tabs defaultValue="reports" className="space-y-4">
                <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 shadow-sm md:grid-cols-3">
                  <TabsTrigger
                    value="reports"
                    className="h-auto justify-start rounded-md px-4 py-3 text-left data-[state=active]:bg-slate-900 data-[state=active]:text-white"
                  >
                    <span className="flex flex-col items-start">
                      <span className="text-sm font-bold">Báo cáo nhân viên</span>
                      <span className="text-xs opacity-75">
                        {dailySummary.unreviewedCount} chưa xem, {dailyReports.length} tổng
                      </span>
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="projects"
                    className="h-auto justify-start rounded-md px-4 py-3 text-left data-[state=active]:bg-slate-900 data-[state=active]:text-white"
                  >
                    <span className="flex flex-col items-start">
                      <span className="text-sm font-bold">Tổng hợp dự án</span>
                      <span className="text-xs opacity-75">
                        {projectSummaries.length} dự án có dữ liệu
                      </span>
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="requests"
                    className="h-auto justify-start rounded-md px-4 py-3 text-left data-[state=active]:bg-slate-900 data-[state=active]:text-white"
                  >
                    <span className="flex flex-col items-start">
                      <span className="text-sm font-bold">Yêu cầu duyệt</span>
                      <span className="text-xs opacity-75">
                        {statusRequests.length} yêu cầu chờ xử lý
                      </span>
                    </span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="projects" className="m-0">
                  <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                      <div>
                        <h2 className="text-lg font-bold">Tổng hợp theo dự án</h2>
                        <p className="text-sm font-medium text-[var(--muted-foreground)]">
                          AI đọc báo cáo thô, viết lại rõ ý người báo cáo và gợi ý phương án xử lý.
                        </p>
                      </div>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700">
                        {isAiSummaryLoading
                          ? "AI đang viết lại..."
                          : `${projectSummaries.length} project`}
                      </span>
                    </div>

                    {(aiSummary?.overallSummary || aiSummaryError) && (
                      <div className="border-b border-[var(--border)] px-5 py-4">
                        {aiSummary?.overallSummary && (
                          <div className="rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                            <p className="font-semibold">AI tóm tắt điều hành</p>
                            <p className="mt-1">{aiSummary.overallSummary}</p>
                          </div>
                        )}
                        {aiSummaryError && (
                          <div className="rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                            Không gọi được AI: {aiSummaryError}. Hệ thống đang hiển thị bản tổng hợp
                            tự động cơ bản.
                          </div>
                        )}
                      </div>
                    )}

                    {projectSummaries.length === 0 ? (
                      <div className="px-5 py-6 text-sm text-[var(--muted-foreground)]">
                        Chưa có dữ liệu project để tổng hợp.
                      </div>
                    ) : (
                      <div className="grid gap-4 p-5">
                        {projectSummaries.map((project) => {
                          const aiProject = aiSummary?.projects.find(
                            (item) =>
                              (project.projectId !== "no-project" &&
                                item.projectId === project.projectId) ||
                              item.projectName === project.projectName
                          );
                          const displayIssues = aiProject?.issues || project.issues;
                          const displayRecommendations =
                            aiProject?.recommendations || project.suggestions;
                          const displayNextActions = aiProject?.nextActions || [];

                          return (
                            <article
                              key={project.projectId}
                              className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-semibold">
                                      {project.projectName}
                                    </h3>
                                    <span className="rounded-md bg-[var(--muted)] px-2 py-1 text-xs text-[var(--muted-foreground)]">
                                      {project.workspaceName}
                                    </span>
                                    {aiProject && (
                                      <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                                        AI đã viết lại
                                      </span>
                                    )}
                                    {aiProject?.riskLevel && (
                                      <span
                                        className={cn(
                                          "rounded-md px-2 py-1 text-xs font-medium",
                                          aiProject.riskLevel === "HIGH" &&
                                            "bg-red-50 text-red-700",
                                          aiProject.riskLevel === "MEDIUM" &&
                                            "bg-amber-50 text-amber-700",
                                          aiProject.riskLevel === "LOW" &&
                                            "bg-emerald-50 text-emerald-700"
                                        )}
                                      >
                                        Rủi ro {aiProject.riskLevel}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                                    {project.reports.length} báo cáo
                                    {project.taskNames.length > 0 &&
                                      ` - ${project.taskNames.length} task được nhắc tới`}
                                  </p>
                                </div>
                                <div className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                                  {project.averageProgress === null
                                    ? "Chưa có tiến độ"
                                    : `${project.averageProgress}% tiến độ`}
                                </div>
                              </div>

                              {aiProject && (
                                <div className="mt-4 rounded-lg bg-blue-50 p-4 text-blue-950">
                                  <p className="text-sm font-semibold">AI viết lại báo cáo</p>
                                  <p className="mt-2 text-sm leading-6">
                                    {aiProject.rewrittenSummary}
                                  </p>
                                  <p className="mt-3 text-sm font-semibold">Đánh giá tiến độ</p>
                                  <p className="mt-1 text-sm leading-6">
                                    {aiProject.progressAssessment}
                                  </p>
                                </div>
                              )}

                              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                <div className="rounded-lg bg-amber-50 p-4">
                                  <p className="text-sm font-semibold text-amber-900">
                                    Vấn đề tổng hợp
                                  </p>
                                  <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-900">
                                    {displayIssues.map((issue) => (
                                      <li key={issue} className="flex gap-2">
                                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                                        <span>{issue}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="rounded-lg bg-emerald-50 p-4">
                                  <p className="text-sm font-semibold text-emerald-900">
                                    Gợi ý phương án xử lý
                                  </p>
                                  <ul className="mt-2 space-y-2 text-sm leading-6 text-emerald-900">
                                    {displayRecommendations.map((suggestion) => (
                                      <li key={suggestion} className="flex gap-2">
                                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                                        <span>{suggestion}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              {displayNextActions.length > 0 && (
                                <div className="mt-4 rounded-lg bg-slate-50 p-4">
                                  <p className="text-sm font-semibold text-slate-900">
                                    Việc nên làm tiếp theo
                                  </p>
                                  <ul className="mt-2 grid gap-2 text-sm leading-6 text-slate-700 md:grid-cols-2">
                                    {displayNextActions.map((action) => (
                                      <li key={action} className="flex gap-2">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                                        <span>{action}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {project.blockerReports.length > 0 && (
                                <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4">
                                  <p className="text-sm font-semibold text-red-800">
                                    Chi tiết vướng mắc gốc
                                  </p>
                                  <div className="mt-2 space-y-2">
                                    {project.blockerReports.map((report) => (
                                      <div
                                        key={report.id}
                                        className="text-sm leading-6 text-red-800"
                                      >
                                        <span className="font-medium">
                                          {getUserName(report.reporter)}
                                        </span>
                                        {report.task?.title && ` - ${report.task.title}`}:{" "}
                                        {report.blockers}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </TabsContent>

                <TabsContent value="requests" className="m-0">
                  <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                      <div>
                        <h2 className="text-lg font-bold">Yêu cầu đổi trạng thái</h2>
                        <p className="text-sm font-medium text-[var(--muted-foreground)]">
                          Các yêu cầu cần manager xác nhận trước khi đổi trạng thái task.
                        </p>
                      </div>
                      <span className="rounded-md bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-700">
                        {statusRequests.length} chờ duyệt
                      </span>
                    </div>

                    {statusRequests.length === 0 ? (
                      <div className="flex items-center gap-3 px-5 py-6 text-sm text-[var(--muted-foreground)]">
                        <Clock3 className="h-5 w-5" />
                        Không có yêu cầu đổi trạng thái đang chờ.
                      </div>
                    ) : (
                      <div className="grid gap-3 p-4">
                        {statusRequests.map((request) => (
                          <article
                            key={request.id}
                            className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="min-w-0 break-words font-medium">
                                    {request.task?.title || "Công việc"}
                                  </p>
                                  <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-[var(--muted)] px-2 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                                    <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">
                                      {getProjectLabel(request.task)}
                                    </span>
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                                  {getUserName(request.requestedBy)} muốn chuyển sang{" "}
                                  <span className="font-medium text-[var(--foreground)]">
                                    {request.requestedStatus?.name}
                                  </span>
                                </p>
                                {request.requesterNote && (
                                  <p className="mt-2 break-words text-sm">
                                    {request.requesterNote}
                                  </p>
                                )}
                                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                                  {getWorkspaceLabel(request.task)}
                                </p>
                              </div>
                              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                                {getTaskHref(request.task) && (
                                  <Button variant="outline" size="sm" asChild>
                                    <Link href={getTaskHref(request.task)!}>
                                      <ExternalLink className="h-4 w-4" />
                                      Xem công việc
                                    </Link>
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                                  disabled={reviewingId === request.id}
                                  onClick={() => reviewStatusRequest(request, "APPROVED")}
                                >
                                  <Check className="h-4 w-4" />
                                  Duyệt
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={reviewingId === request.id}
                                  onClick={() => reviewStatusRequest(request, "REJECTED")}
                                >
                                  <X className="h-4 w-4" />
                                  Từ chối
                                </Button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </TabsContent>

                <TabsContent value="reports" className="m-0">
                  <section className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
                    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4">
                      <div>
                        <h2 className="text-lg font-bold">Báo cáo theo nhân viên</h2>
                        <p className="mt-1 text-sm font-medium text-[var(--muted-foreground)]">
                          Tổng hợp nội dung báo cáo, vướng mắc và tiến độ theo từng người.
                        </p>
                      </div>
                      <span className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                        {dailyReports.length} báo cáo
                      </span>
                    </div>

                    {dailyReports.length === 0 ? (
                      <div className="rounded-lg bg-[var(--background)] p-6 text-sm font-medium text-[var(--muted-foreground)]">
                        Chưa có báo cáo trong ngày đã chọn.
                      </div>
                    ) : (
                      <div className="grid gap-5">
                        {Object.entries(reportsByEmployee).map(([employeeId, reports]) => {
                          const employeeName = getUserName(reports[0]?.reporter);
                          const unreadReports = reports.filter(
                            (report) => report.status !== "REVIEWED"
                          ).length;
                          return (
                            <section
                              key={employeeId}
                              className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] bg-slate-50 px-5 py-4">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white">
                                    {getInitials(employeeName)}
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="truncate text-base font-bold">{employeeName}</h3>
                                    <p className="text-sm font-medium text-[var(--muted-foreground)]">
                                      {reports.length} báo cáo trong ngày
                                      {getProjectCount(reports) > 0 &&
                                        ` - ${getProjectCount(reports)} dự án`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-sm font-semibold text-slate-700">
                                    <Users className="h-4 w-4" />
                                    Nhân viên
                                  </div>
                                  <div
                                    className={cn(
                                      "rounded-md px-2.5 py-1 text-sm font-semibold",
                                      unreadReports > 0
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-emerald-100 text-emerald-800"
                                    )}
                                  >
                                    {unreadReports > 0 ? `${unreadReports} chưa xem` : "Đã xem hết"}
                                  </div>
                                </div>
                              </div>

                              <div className="divide-y divide-[var(--border)]">
                                {reports.map((report) => {
                                  const taskHref = getTaskHref(report.task);
                                  return (
                                    <article key={report.id} className="p-5 lg:p-6">
                                      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                              {formatReportType(report.type)}
                                            </span>
                                            <span className="min-w-0 break-words text-base font-bold">
                                              {report.task?.title || "Công việc"}
                                            </span>
                                            <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-[var(--muted)] px-2 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                                              <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                                              <span className="truncate">
                                                {getProjectLabel(report.task)}
                                              </span>
                                            </span>
                                            <span
                                              className={cn(
                                                "rounded-md px-2 py-1 text-xs font-medium",
                                                report.status === "REVIEWED"
                                                  ? "bg-emerald-50 text-emerald-700"
                                                  : "bg-amber-50 text-amber-700"
                                              )}
                                            >
                                              {report.status === "REVIEWED" ? "Đã xem" : "Chưa xem"}
                                            </span>
                                          </div>
                                          <p className="mt-2 text-sm font-medium text-[var(--muted-foreground)]">
                                            {getWorkspaceLabel(report.task)}
                                            {report.task?.status?.name &&
                                              ` - ${report.task.status.name}`}
                                          </p>
                                          <p className="mt-4 text-xs font-bold uppercase text-[var(--muted-foreground)]">
                                            Nội dung báo cáo
                                          </p>
                                          <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-4 py-3 text-base font-medium leading-7 text-slate-900">
                                            {report.content}
                                          </p>
                                          {report.blockers && (
                                            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                                              Vướng mắc: {report.blockers}
                                            </p>
                                          )}
                                        </div>

                                        <aside className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                                          <div>
                                            <p className="text-xs font-bold uppercase text-[var(--muted-foreground)]">
                                              Tiến độ
                                            </p>
                                            {typeof report.progressPercent === "number" ? (
                                              <div className="mt-2">
                                                <div className="mb-1 flex justify-between text-sm font-semibold">
                                                  <span>Công việc</span>
                                                  <span>{report.progressPercent}%</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-[var(--muted)]">
                                                  <div
                                                    className="h-2 rounded-full bg-slate-900"
                                                    style={{
                                                      width: `${Math.min(Math.max(report.progressPercent, 0), 100)}%`,
                                                    }}
                                                  />
                                                </div>
                                              </div>
                                            ) : (
                                              <p className="mt-2 text-sm font-medium text-[var(--muted-foreground)]">
                                                Chưa cập nhật.
                                              </p>
                                            )}
                                          </div>
                                          {taskHref && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="w-full justify-center font-semibold"
                                              asChild
                                            >
                                              <Link href={taskHref}>
                                                <ExternalLink className="h-4 w-4" />
                                                Xem công việc
                                              </Link>
                                            </Button>
                                          )}
                                          {report.status !== "REVIEWED" && (
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              className="w-full justify-center font-semibold"
                                              disabled={reviewingId === report.id}
                                              onClick={() => reviewDailyReport(report)}
                                            >
                                              Đánh dấu đã xem
                                            </Button>
                                          )}
                                        </aside>
                                      </div>
                                    </article>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </>
  );
}
