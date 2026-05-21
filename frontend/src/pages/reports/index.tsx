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
import { useAuth } from "@/contexts/auth-context";
import { TokenManager } from "@/lib/api";
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

function StatCard({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "neutral" | "warning" | "success";
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md",
            tone === "warning" && "bg-amber-50 text-amber-700",
            tone === "success" && "bg-emerald-50 text-emerald-700",
            tone === "neutral" && "bg-slate-100 text-slate-700"
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-normal">{value}</p>
          <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const { isAuthenticated, getCurrentUser } = useAuth();
  const currentUser = getCurrentUser();
  const [selectedDate, setSelectedDate] = useState(today);
  const [statusRequests, setStatusRequests] = useState<TaskStatusChangeRequest[]>([]);
  const [dailyReports, setDailyReports] = useState<TaskDailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const canReview = currentUser?.role === "MANAGER" || currentUser?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    if (currentUser && !canReview) {
      router.replace("/projects");
    }
  }, [canReview, currentUser, isAuthenticated, router]);

  const loadReports = useCallback(async () => {
    const organizationId = TokenManager.getCurrentOrgId();
    if (!organizationId || !canReview) {
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
  }, [canReview, selectedDate]);

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
              <div className="grid gap-3 md:grid-cols-3">
                <StatCard
                  icon={<AlertCircle className="h-5 w-5" />}
                  label="Yêu cầu chờ duyệt"
                  value={statusRequests.length}
                  tone="warning"
                />
                <StatCard
                  icon={<ClipboardList className="h-5 w-5" />}
                  label="Báo cáo trong ngày"
                  value={dailyReports.length}
                />
                <StatCard
                  icon={<Check className="h-5 w-5" />}
                  label="Đã xem"
                  value={`${reviewedCount}/${dailyReports.length}`}
                  tone="success"
                />
              </div>

              <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                  <div>
                    <h2 className="text-base font-semibold">Tóm tắt tự động trong ngày</h2>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Hệ thống tự tổng hợp báo cáo, tiến độ và các điểm cần chú ý.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700">
                    <TrendingUp className="h-4 w-4" />
                    {dailySummary.averageProgress === null
                      ? "Chưa có tiến độ"
                      : `${dailySummary.averageProgress}% trung bình`}
                  </span>
                </div>

                <div className="grid gap-4 p-5 lg:grid-cols-[1.3fr_1fr]">
                  <div className="space-y-3">
                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">Nhận định nhanh</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {dailyReports.length === 0
                          ? "Hôm nay chưa có báo cáo nào được gửi. Khi nhân viên gửi báo cáo, phần này sẽ tự cập nhật."
                          : `${dailySummary.health} Có ${dailyReports.length} báo cáo từ ${dailySummary.employeeCount} nhân viên, liên quan ${dailySummary.projectNames.length || 0} dự án.`}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {dailySummary.progressText}
                      </p>
                    </div>

                    {dailySummary.blockerReports.length > 0 && (
                      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
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

                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <div className="rounded-lg border border-[var(--border)] p-3">
                      <p className="text-xs text-[var(--muted-foreground)]">Dự án có báo cáo</p>
                      <p className="mt-1 text-lg font-semibold">
                        {dailySummary.projectNames.length || 0}
                      </p>
                      <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
                        {dailySummary.projectNames.slice(0, 3).join(", ") || "Chưa có"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] p-3">
                      <p className="text-xs text-[var(--muted-foreground)]">Chưa xem</p>
                      <p className="mt-1 text-lg font-semibold">{dailySummary.unreviewedCount}</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        báo cáo cần manager đọc
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] p-3">
                      <p className="text-xs text-[var(--muted-foreground)]">Vướng mắc</p>
                      <p className="mt-1 text-lg font-semibold">
                        {dailySummary.blockerReports.length}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        task đang bị chặn
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                  <div>
                    <h2 className="text-base font-semibold">Yêu cầu đổi trạng thái</h2>
                    <p className="text-sm text-[var(--muted-foreground)]">
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
                                <span className="truncate">{getProjectLabel(request.task)}</span>
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                              {getUserName(request.requestedBy)} muốn chuyển sang{" "}
                              <span className="font-medium text-[var(--foreground)]">
                                {request.requestedStatus?.name}
                              </span>
                            </p>
                            {request.requesterNote && (
                              <p className="mt-2 break-words text-sm">{request.requesterNote}</p>
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

              <section className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold">Báo cáo theo nhân viên</h2>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Tổng hợp nội dung báo cáo, vướng mắc và tiến độ theo từng người.
                    </p>
                  </div>
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {dailyReports.length} báo cáo
                  </span>
                </div>

                {dailyReports.length === 0 ? (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted-foreground)] shadow-sm">
                    Chưa có báo cáo trong ngày đã chọn.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {Object.entries(reportsByEmployee).map(([employeeId, reports]) => {
                      const employeeName = getUserName(reports[0]?.reporter);
                      return (
                        <section
                          key={employeeId}
                          className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white">
                                {getInitials(employeeName)}
                              </div>
                              <div className="min-w-0">
                                <h3 className="truncate font-semibold">{employeeName}</h3>
                                <p className="text-sm text-[var(--muted-foreground)]">
                                  {reports.length} báo cáo trong ngày
                                  {getProjectCount(reports) > 0 &&
                                    ` - ${getProjectCount(reports)} dự án`}
                                </p>
                              </div>
                            </div>
                            <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--muted)] px-2.5 py-1 text-sm text-[var(--muted-foreground)]">
                              <Users className="h-4 w-4" />
                              Nhân viên
                            </div>
                          </div>

                          <div className="divide-y divide-[var(--border)]">
                            {reports.map((report) => {
                              const taskHref = getTaskHref(report.task);
                              return (
                                <article key={report.id} className="p-5">
                                  <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                          {formatReportType(report.type)}
                                        </span>
                                        <span className="min-w-0 break-words text-sm font-semibold">
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
                                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                                        {getWorkspaceLabel(report.task)}
                                        {report.task?.status?.name &&
                                          ` - ${report.task.status.name}`}
                                      </p>
                                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                                        {report.content}
                                      </p>
                                      {report.blockers && (
                                        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                                          Vướng mắc: {report.blockers}
                                        </p>
                                      )}
                                      {typeof report.progressPercent === "number" && (
                                        <div className="mt-3 max-w-md">
                                          <div className="mb-1 flex justify-between text-xs text-[var(--muted-foreground)]">
                                            <span>Tiến độ</span>
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
                                      )}
                                    </div>

                                    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                                      {taskHref && (
                                        <Button variant="outline" size="sm" asChild>
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
                                          disabled={reviewingId === report.id}
                                          onClick={() => reviewDailyReport(report)}
                                        >
                                          Đánh dấu đã xem
                                        </Button>
                                      )}
                                    </div>
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
            </>
          )}
        </div>
      </div>
    </>
  );
}
