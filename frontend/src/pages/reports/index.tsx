import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  ClipboardList,
  ExternalLink,
  FolderKanban,
  RefreshCw,
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
      <div className="space-y-6 px-3 py-4 sm:px-6">
        <PageHeader
          className="rounded border border-[var(--border)] bg-[var(--card)] p-4"
          icon={<ClipboardList className="h-5 w-5" />}
          title="Báo cáo"
          description="Duyệt trạng thái task và xem báo cáo nhân viên theo ngày"
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <label className="flex h-10 w-full items-center gap-2 rounded border border-[var(--border)] bg-[var(--background)] px-3 sm:w-auto">
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
                className="h-10 justify-center gap-2"
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
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded border border-[var(--border)] bg-[var(--muted)]/20" />
            <div className="h-40 animate-pulse rounded border border-[var(--border)] bg-[var(--muted)]/20" />
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Yêu cầu đổi trạng thái</h2>
                <span className="text-sm text-[var(--muted-foreground)]">
                  {statusRequests.length} chờ duyệt
                </span>
              </div>
              {statusRequests.length === 0 ? (
                <div className="rounded border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--muted-foreground)]">
                  Không có yêu cầu đổi trạng thái đang chờ.
                </div>
              ) : (
                <div className="grid gap-3">
                  {statusRequests.map((request) => (
                    <article key={request.id} className="rounded border border-[var(--border)] bg-[var(--card)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 break-words font-medium">
                              {request.task?.title || "Công việc"}
                            </p>
                            <span className="inline-flex max-w-full items-center gap-1 rounded bg-[var(--muted)] px-2 py-1 text-xs font-medium text-[var(--muted-foreground)]">
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
                          {getTaskHref(request.task) && (
                            <Link
                              href={getTaskHref(request.task)!}
                              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded border border-[var(--border)] px-2.5 text-xs font-medium hover:bg-[var(--muted)]"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Xem công việc
                            </Link>
                          )}
                        </div>
                        <div className="flex w-full gap-2 sm:w-auto">
                          <button
                            type="button"
                            disabled={reviewingId === request.id}
                            onClick={() => reviewStatusRequest(request, "APPROVED")}
                            className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded bg-green-600 px-3 text-sm font-medium text-white disabled:opacity-60 sm:flex-none"
                          >
                            <Check className="h-4 w-4" />
                            Duyệt
                          </button>
                          <button
                            type="button"
                            disabled={reviewingId === request.id}
                            onClick={() => reviewStatusRequest(request, "REJECTED")}
                            className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded border border-[var(--border)] px-3 text-sm font-medium disabled:opacity-60 sm:flex-none"
                          >
                            <X className="h-4 w-4" />
                            Từ chối
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Báo cáo theo nhân viên</h2>
                <span className="text-sm text-[var(--muted-foreground)]">
                  {dailyReports.length} báo cáo
                </span>
              </div>
              {dailyReports.length === 0 ? (
                <div className="rounded border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--muted-foreground)]">
                  Chưa có báo cáo trong ngày đã chọn.
                </div>
              ) : (
                <div className="grid gap-4">
                  {Object.entries(reportsByEmployee).map(([employeeId, reports]) => (
                    <section key={employeeId} className="overflow-hidden rounded border border-[var(--border)] bg-[var(--card)]">
                      <div className="border-b border-[var(--border)] px-4 py-3">
                        <h3 className="truncate font-medium">{getUserName(reports[0]?.reporter)}</h3>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {reports.length} báo cáo trong ngày
                          {getProjectCount(reports) > 0 && ` • ${getProjectCount(reports)} dự án`}
                        </p>
                      </div>
                      <div className="divide-y divide-[var(--border)]">
                        {reports.map((report) => (
                          <article key={report.id} className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded bg-[var(--muted)] px-2 py-1 text-xs font-medium">
                                    {formatReportType(report.type)}
                                  </span>
                                  <span className="min-w-0 break-words text-sm font-medium">
                                    {report.task?.title || "Công việc"}
                                  </span>
                                  <span className="inline-flex max-w-full items-center gap-1 rounded bg-[var(--muted)] px-2 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                                    <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{getProjectLabel(report.task)}</span>
                                  </span>
                                  <span
                                    className={cn(
                                      "rounded px-2 py-1 text-xs",
                                      report.status === "REVIEWED"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-amber-100 text-amber-700"
                                    )}
                                  >
                                    {report.status === "REVIEWED" ? "Đã xem" : "Chưa xem"}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                                  {getWorkspaceLabel(report.task)}
                                  {report.task?.status?.name && ` • ${report.task.status.name}`}
                                </p>
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{report.content}</p>
                                {report.blockers && (
                                  <p className="mt-2 break-words text-sm text-red-600">
                                    Vướng mắc: {report.blockers}
                                  </p>
                                )}
                                {typeof report.progressPercent === "number" && (
                                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                                    Tiến độ: {report.progressPercent}%
                                  </p>
                                )}
                              </div>
                              {getTaskHref(report.task) && (
                                <Link
                                  href={getTaskHref(report.task)!}
                                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded border border-[var(--border)] px-3 text-sm font-medium hover:bg-[var(--muted)] sm:w-auto"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Xem công việc
                                </Link>
                              )}
                              {report.status !== "REVIEWED" && (
                                <button
                                  type="button"
                                  disabled={reviewingId === report.id}
                                  onClick={() => reviewDailyReport(report)}
                                  className="h-9 w-full rounded border border-[var(--border)] px-3 text-sm font-medium disabled:opacity-60 sm:w-auto"
                                >
                                  Đánh dấu đã xem
                                </button>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
