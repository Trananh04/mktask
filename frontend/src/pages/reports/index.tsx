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
  Download,
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
import { orgChartsApi } from "@/utils/api/orgChartsApi";
import { projectApi } from "@/utils/api/projectApi";
import { ChartType } from "@/types";
import type { Task, Project } from "@/types";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

const today = new Date().toISOString().split("T")[0];

type ExportReportType = "task" | "project" | "member" | "quarter";

type ExportColumnDefinition = {
  id: string;
  label: string;
  important?: boolean;
};

type ExportColumnSelection = Record<ExportReportType, string[]>;

type MemberPerformanceRow = {
  memberId: string;
  memberName: string;
  email: string;
  assignedTasks: number;
  totalTasks: number;
  activeTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  workloadLevel: "LOW" | "MEDIUM" | "HIGH";
  completionRate: number;
};

const EXPORT_COLUMN_OPTIONS: Record<ExportReportType, ExportColumnDefinition[]> = {
  task: [
    { id: "taskNumber", label: "Mã công việc" },
    { id: "title", label: "Tiêu đề công việc" },
    { id: "type", label: "Loại công việc" },
    { id: "projectName", label: "Dự án" },
    { id: "workspaceName", label: "Phòng ban (Workspace)" },
    { id: "priority", label: "Độ ưu tiên" },
    { id: "statusName", label: "Trạng thái" },
    { id: "assigneeNames", label: "Người phụ trách" },
    { id: "assigneeEmails", label: "Email người phụ trách" },
    { id: "memberPerformancePercent", label: "Hiệu suất người phụ trách (%)", important: true },
    { id: "memberPerformanceDetail", label: "Chi tiết hiệu suất từng người", important: true },
    { id: "startDate", label: "Ngày bắt đầu" },
    { id: "dueDate", label: "Hạn hoàn thành" },
    { id: "completedAt", label: "Ngày hoàn thành" },
    { id: "createdAt", label: "Ngày tạo" },
    { id: "storyPoints", label: "Điểm Story" },
    { id: "originalEstimate", label: "Ước tính ban đầu" },
    { id: "remainingEstimate", label: "Ước tính còn lại" },
    { id: "childTasksCount", label: "Số việc con" },
    { id: "commentsCount", label: "Số bình luận" },
    { id: "description", label: "Mô tả" },
  ],
  project: [
    { id: "projectName", label: "Tên dự án" },
    { id: "workspaceName", label: "Phòng ban (Workspace)" },
    { id: "status", label: "Trạng thái" },
    { id: "priority", label: "Độ ưu tiên" },
    { id: "endDate", label: "Ngày kết thúc" },
    { id: "totalTasks", label: "Tổng số việc" },
    { id: "completedTasks", label: "Đã hoàn thành" },
    { id: "activeTasks", label: "Đang mở" },
    { id: "inProgressTasks", label: "Đang thực hiện" },
    { id: "overdueTasks", label: "Quá hạn" },
    { id: "blockedTasks", label: "Bị chặn" },
    { id: "completionRate", label: "Tiến độ hoàn thành (%)" },
    { id: "averageMemberPerformance", label: "Hiệu suất nhân sự TB (%)", important: true },
    { id: "openRisks", label: "Rủi ro đang mở" },
    { id: "riskLevel", label: "Mức độ rủi ro" },
    { id: "latestHealth", label: "Sức khỏe gần nhất" },
    { id: "latestSummary", label: "Tóm tắt gần nhất" },
  ],
  member: [
    { id: "memberName", label: "Tên nhân viên" },
    { id: "email", label: "Email" },
    { id: "assignedTasks", label: "Tổng công việc được giao" },
    { id: "completedTasks", label: "Đã hoàn thành" },
    { id: "activeTasks", label: "Đang mở" },
    { id: "inProgressTasks", label: "Đang thực hiện" },
    { id: "overdueTasks", label: "Quá hạn" },
    { id: "blockedTasks", label: "Bị chặn" },
    { id: "workloadLevel", label: "Mức độ tải công việc" },
    { id: "completionRate", label: "Hiệu suất công việc (%)", important: true },
  ],
  quarter: [
    { id: "quarter", label: "Quý" },
    { id: "year", label: "Năm" },
    { id: "taskNumber", label: "Mã công việc" },
    { id: "title", label: "Tiêu đề công việc" },
    { id: "type", label: "Loại công việc" },
    { id: "projectName", label: "Dự án" },
    { id: "workspaceName", label: "Phòng ban (Workspace)" },
    { id: "priority", label: "Độ ưu tiên" },
    { id: "statusName", label: "Trạng thái" },
    { id: "assigneeNames", label: "Người phụ trách" },
    { id: "assigneeEmails", label: "Email người phụ trách" },
    { id: "memberPerformancePercent", label: "Hiệu suất người phụ trách (%)", important: true },
    { id: "memberPerformanceDetail", label: "Chi tiết hiệu suất từng người", important: true },
    { id: "startDate", label: "Ngày bắt đầu" },
    { id: "dueDate", label: "Hạn hoàn thành" },
    { id: "completedAt", label: "Ngày hoàn thành" },
    { id: "createdAt", label: "Ngày tạo" },
    { id: "storyPoints", label: "Điểm Story" },
    { id: "description", label: "Mô tả" },
  ],
};

function getDefaultExportColumnSelection(): ExportColumnSelection {
  return Object.fromEntries(
    Object.entries(EXPORT_COLUMN_OPTIONS).map(([type, columns]) => [
      type,
      columns.map((column) => column.id),
    ])
  ) as ExportColumnSelection;
}

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

function formatExportDate(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function formatExportPercent(value?: number | null) {
  const numericValue = Number.isFinite(value) ? Number(value) : 0;
  return `${numericValue.toFixed(1)}%`;
}

function getTaskUsers(task: Task, field: "assignees" | "reporters") {
  const users = task[field];
  return Array.isArray(users) ? users : [];
}

function getTaskUserNames(task: Task, field: "assignees" | "reporters") {
  const names = getTaskUsers(task, field)
    .map((user) => getUserName(user))
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : field === "assignees" ? "Chưa phân công" : "";
}

function getTaskUserEmails(task: Task, field: "assignees" | "reporters") {
  return getTaskUsers(task, field)
    .map((user) => user.email)
    .filter(Boolean)
    .join(", ");
}

function isTaskCompleted(task: Task) {
  return Boolean(task.completedAt || task.status?.category === "DONE");
}

function isTaskInProgress(task: Task) {
  return !isTaskCompleted(task) && task.status?.category === "IN_PROGRESS";
}

function isTaskOverdue(task: Task) {
  return Boolean(!isTaskCompleted(task) && task.dueDate && new Date(task.dueDate) < new Date());
}

function isTaskBlocked(task: Task) {
  const taskData = task as any;
  const openBlockingDependency = Array.isArray(taskData.dependsOn)
    ? taskData.dependsOn.some((dependency: any) => !dependency?.blockingTask?.completedAt)
    : false;
  return Boolean(!isTaskCompleted(task) && (taskData.isBlocked || taskData.blockedReason || openBlockingDependency));
}

function calculateExportPercent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function getMemberWorkloadLevel(activeTasks: number, overdueTasks: number, blockedTasks: number) {
  if (activeTasks >= 10 || (overdueTasks > 0 && blockedTasks > 0)) return "HIGH";
  if (activeTasks >= 5 || overdueTasks > 0 || blockedTasks > 0) return "MEDIUM";
  return "LOW";
}

function getWorkloadLabel(level?: string) {
  if (level === "HIGH") return "Quá tải";
  if (level === "MEDIUM") return "Cần theo dõi";
  return "Ổn";
}

function getRiskLabel(level?: string) {
  if (level === "CRITICAL") return "Khẩn cấp";
  if (level === "HIGH") return "Cao";
  if (level === "MEDIUM") return "Trung bình";
  return "Thấp";
}

function addMemberPerformanceKeys(
  map: Map<string, MemberPerformanceRow>,
  member: MemberPerformanceRow
) {
  if (member.memberId) map.set(member.memberId, member);
  if (member.email) map.set(member.email.toLowerCase(), member);
  if (member.memberName) map.set(member.memberName.toLowerCase(), member);
}

function findMemberPerformance(
  map: Map<string, MemberPerformanceRow>,
  user?: { id?: string; email?: string | null; firstName?: string | null; lastName?: string | null } | null
) {
  if (!user) return undefined;
  const name = getUserName(user).toLowerCase();
  return (
    (user.id ? map.get(user.id) : undefined) ||
    (user.email ? map.get(user.email.toLowerCase()) : undefined) ||
    map.get(name)
  );
}

function buildMemberPerformanceRows(tasks: Task[], chartMembers: any[] = []) {
  const performanceMap = new Map<string, MemberPerformanceRow>();

  for (const task of tasks) {
    const isCompleted = isTaskCompleted(task);
    const isInProgress = isTaskInProgress(task);
    const isOverdue = isTaskOverdue(task);
    const isBlocked = isTaskBlocked(task);

    for (const assignee of getTaskUsers(task, "assignees")) {
      const key = assignee.id || assignee.email || getUserName(assignee);
      if (!key) continue;

      let member = findMemberPerformance(performanceMap, assignee);
      if (!member) {
        member = {
          memberId: assignee.id || key,
          memberName: getUserName(assignee),
          email: assignee.email || "",
          assignedTasks: 0,
          totalTasks: 0,
          activeTasks: 0,
          inProgressTasks: 0,
          completedTasks: 0,
          overdueTasks: 0,
          blockedTasks: 0,
          workloadLevel: "LOW",
          completionRate: 0,
        };
        addMemberPerformanceKeys(performanceMap, member);
      }

      member.assignedTasks += 1;
      member.totalTasks += 1;
      if (isCompleted) member.completedTasks += 1;
      else member.activeTasks += 1;
      if (isInProgress) member.inProgressTasks += 1;
      if (isOverdue) member.overdueTasks += 1;
      if (isBlocked) member.blockedTasks += 1;
    }
  }

  const uniqueRows = Array.from(new Set(performanceMap.values()));
  for (const member of uniqueRows) {
    member.completionRate = calculateExportPercent(member.completedTasks, member.totalTasks);
    member.workloadLevel = getMemberWorkloadLevel(
      member.activeTasks,
      member.overdueTasks,
      member.blockedTasks
    );
  }

  for (const chartMember of chartMembers) {
    const chartRow: MemberPerformanceRow = {
      memberId: chartMember.memberId || chartMember.id || chartMember.email || chartMember.memberName,
      memberName: chartMember.memberName || chartMember.name || chartMember.email || "Nhân viên",
      email: chartMember.email || "",
      assignedTasks: chartMember.assignedTasks || chartMember.totalTasks || 0,
      totalTasks: chartMember.totalTasks || chartMember.assignedTasks || 0,
      activeTasks: chartMember.activeTasks || 0,
      inProgressTasks: chartMember.inProgressTasks || 0,
      completedTasks: chartMember.completedTasks || 0,
      overdueTasks: chartMember.overdueTasks || 0,
      blockedTasks: chartMember.blockedTasks || 0,
      workloadLevel: chartMember.workloadLevel || "LOW",
      completionRate: Number(chartMember.completionRate || 0),
    };
    const existing = findMemberPerformance(performanceMap, {
      id: chartRow.memberId,
      email: chartRow.email,
      firstName: chartRow.memberName,
    });
    if (existing) {
      Object.assign(existing, chartRow);
      addMemberPerformanceKeys(performanceMap, existing);
    } else {
      addMemberPerformanceKeys(performanceMap, chartRow);
    }
  }

  return Array.from(new Set(performanceMap.values())).sort(
    (a, b) => b.completionRate - a.completionRate || b.activeTasks - a.activeTasks
  );
}

function getTaskMemberPerformance(task: Task, performanceMap: Map<string, MemberPerformanceRow>) {
  const details = getTaskUsers(task, "assignees")
    .map((assignee) => {
      const performance = findMemberPerformance(performanceMap, assignee);
      return {
        name: getUserName(assignee),
        rate: performance?.completionRate ?? 0,
      };
    })
    .filter((item) => item.name);

  const average =
    details.length > 0
      ? details.reduce((total, item) => total + item.rate, 0) / details.length
      : 0;

  return {
    average,
    detail: details.map((item) => `${item.name}: ${formatExportPercent(item.rate)}`).join("; "),
  };
}

function getProjectAverageMemberPerformance(
  project: any,
  tasks: Task[],
  performanceMap: Map<string, MemberPerformanceRow>
) {
  const projectTasks = tasks.filter((task) => {
    const taskProject = task.project;
    return (
      taskProject?.id === project.projectId ||
      taskProject?.slug === project.projectSlug ||
      taskProject?.name === project.projectName
    );
  });
  const rates = projectTasks.flatMap((task) =>
    getTaskUsers(task, "assignees")
      .map((assignee) => findMemberPerformance(performanceMap, assignee)?.completionRate)
      .filter((rate): rate is number => typeof rate === "number")
  );

  if (rates.length === 0) return 0;
  return rates.reduce((total, rate) => total + rate, 0) / rates.length;
}

function buildProjectExportRows(
  tasks: Task[],
  chartProjects: any[] = [],
  performanceMap: Map<string, MemberPerformanceRow>
) {
  const projectMap = new Map<string, any>();

  for (const task of tasks) {
    const project = task.project;
    const projectKey = project?.id || project?.slug || project?.name || "no-project";

    if (!projectMap.has(projectKey)) {
      projectMap.set(projectKey, {
        projectId: project?.id || "",
        projectSlug: project?.slug || "",
        projectName: project?.name || "Chưa có dự án",
        workspaceName: (project as any)?.workspace?.name || "",
        status: "",
        priority: "",
        endDate: "",
        totalTasks: 0,
        completedTasks: 0,
        activeTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        blockedTasks: 0,
        completionRate: "0.0%",
        averageMemberPerformance: "0.0%",
        openRisks: 0,
        riskLevel: "",
        latestHealth: "",
        latestSummary: "",
      });
    }

    const row = projectMap.get(projectKey);
    row.totalTasks += 1;
    if (isTaskCompleted(task)) row.completedTasks += 1;
    else row.activeTasks += 1;
    if (isTaskInProgress(task)) row.inProgressTasks += 1;
    if (isTaskOverdue(task)) row.overdueTasks += 1;
    if (isTaskBlocked(task)) row.blockedTasks += 1;
  }

  for (const row of projectMap.values()) {
    row.completionRate = formatExportPercent(
      calculateExportPercent(row.completedTasks, row.totalTasks)
    );
    row.averageMemberPerformance = formatExportPercent(
      getProjectAverageMemberPerformance(row, tasks, performanceMap)
    );
  }

  for (const chartProject of chartProjects) {
    const key =
      chartProject.projectId ||
      chartProject.projectSlug ||
      chartProject.projectName ||
      chartProject.name;
    const existing =
      (key ? projectMap.get(key) : undefined) ||
      Array.from(projectMap.values()).find(
        (row) =>
          row.projectId === chartProject.projectId ||
          row.projectSlug === chartProject.projectSlug ||
          row.projectName === chartProject.projectName
      );

    const chartRow = {
      projectId: chartProject.projectId || "",
      projectSlug: chartProject.projectSlug || "",
      projectName: chartProject.projectName || chartProject.name || "",
      workspaceName: chartProject.workspaceName || "",
      status: chartProject.status || "",
      priority: chartProject.priority || "",
      endDate: formatExportDate(chartProject.endDate),
      totalTasks: chartProject.totalTasks || 0,
      completedTasks: chartProject.completedTasks || 0,
      activeTasks: chartProject.activeTasks || 0,
      inProgressTasks: chartProject.inProgressTasks || 0,
      overdueTasks: chartProject.overdueTasks || 0,
      blockedTasks: chartProject.blockedTasks || 0,
      completionRate: formatExportPercent(chartProject.completionRate || 0),
      averageMemberPerformance: formatExportPercent(
        getProjectAverageMemberPerformance(chartProject, tasks, performanceMap)
      ),
      openRisks: chartProject.openRisks || 0,
      riskLevel: getRiskLabel(chartProject.riskLevel),
      latestHealth: chartProject.latestHealth || "",
      latestSummary: chartProject.latestSummary || "",
    };

    if (existing) {
      Object.assign(existing, chartRow, {
        averageMemberPerformance: chartRow.averageMemberPerformance,
      });
    } else if (key) {
      projectMap.set(key, chartRow);
    }
  }

  return Array.from(projectMap.values()).sort((a, b) => b.totalTasks - a.totalTasks);
}

function createTaskExportRow(
  task: Task,
  performanceMap: Map<string, MemberPerformanceRow>,
  extra: Record<string, any> = {}
) {
  const taskPerformance = getTaskMemberPerformance(task, performanceMap);
  return {
    ...extra,
    taskNumber: task.taskNumber || "",
    title: task.title || "",
    type: task.type || "",
    projectName: task.project?.name || "Chưa có dự án",
    workspaceName: (task.project as any)?.workspace?.name || "",
    sprintName: task.sprint?.name || "",
    priority: task.priority || "",
    statusName: task.status?.name || "",
    assigneeNames: getTaskUserNames(task, "assignees"),
    assigneeEmails: getTaskUserEmails(task, "assignees"),
    memberPerformancePercent: formatExportPercent(taskPerformance.average),
    memberPerformanceDetail: taskPerformance.detail,
    reporterNames: getTaskUserNames(task, "reporters"),
    startDate: formatExportDate(task.startDate),
    dueDate: formatExportDate(task.dueDate),
    completedAt: formatExportDate(task.completedAt),
    createdAt: formatExportDate(task.createdAt),
    updatedAt: formatExportDate(task.updatedAt),
    storyPoints: task.storyPoints || 0,
    originalEstimate: task.originalEstimate || 0,
    remainingEstimate: task.remainingEstimate || 0,
    childTasksCount: task._count?.childTasks || task.childTasks?.length || 0,
    commentsCount: task._count?.comments || task.comments?.length || 0,
    description: task.description || "",
  };
}

function selectExportColumns(
  rows: Array<Record<string, any>>,
  exportType: ExportReportType,
  selectedColumnIds: string[]
) {
  const columns = EXPORT_COLUMN_OPTIONS[exportType].filter((column) =>
    selectedColumnIds.includes(column.id)
  );
  return rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column.label, row[column.id] ?? ""]))
  );
}

async function fetchAllOrganizationTasks(orgId: string) {
  const allTasks: Task[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await taskApi.getTasksByOrganization(orgId, { page, limit: 100 });
    allTasks.push(...(response?.tasks || []));
    totalPages = response?.pagination?.totalPages || page;
    page += 1;
  } while (page <= totalPages);

  return allTasks;
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

  // States for Excel Export Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<ExportReportType>("task");
  const [selectedExportColumns, setSelectedExportColumns] =
    useState<ExportColumnSelection>(getDefaultExportColumnSelection);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());


  const canReview = currentUser?.role === "MANAGER" || currentUser?.role === "SUPER_ADMIN";
  const activeExportColumns = EXPORT_COLUMN_OPTIONS[exportType];
  const selectedActiveExportColumnIds = selectedExportColumns[exportType];

  const toggleExportColumn = (columnId: string, checked: boolean) => {
    setSelectedExportColumns((prev) => {
      const current = prev[exportType] || [];
      return {
        ...prev,
        [exportType]: checked
          ? Array.from(new Set([...current, columnId]))
          : current.filter((id) => id !== columnId),
      };
    });
  };

  const setAllExportColumnsForType = (columnIds: string[]) => {
    setSelectedExportColumns((prev) => ({
      ...prev,
      [exportType]: columnIds,
    }));
  };

  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      const orgId = TokenManager.getCurrentOrgId();
      if (!orgId) {
        toast.error("Không tìm thấy ID tổ chức");
        return;
      }

      const selectedColumnIds = selectedExportColumns[exportType] || [];
      if (selectedColumnIds.length === 0) {
        toast.error("Vui lòng chọn ít nhất một cột thông tin để xuất");
        return;
      }

      // 1. Fetch Management Summary data for members and projects
      const chartsData = await orgChartsApi.getSingleChart(orgId, ChartType.MANAGEMENT_SUMMARY);
      const projectProgress = chartsData?.projectProgress || [];

      // 2. Fetch all tasks for the organization
      const allTasks = await fetchAllOrganizationTasks(orgId);
      const memberPerformanceRows = buildMemberPerformanceRows(allTasks, chartsData?.memberProgress || []);
      const performanceMap = new Map<string, MemberPerformanceRow>();
      memberPerformanceRows.forEach((member) => addMemberPerformanceKeys(performanceMap, member));

      let exportData: any[] = [];
      let filename = "bao_cao";
      let worksheetName = "Sheet1";

      if (exportType === "task") {
        // Export by task
        filename = `bao_cao_cong_viec_${new Date().toISOString().split("T")[0]}`;
        worksheetName = "Danh sach cong viec";
        exportData = allTasks.map((task) => createTaskExportRow(task, performanceMap));
      } else if (exportType === "project") {
        // Export by project
        filename = `bao_cao_du_an_${new Date().toISOString().split("T")[0]}`;
        worksheetName = "Danh sach du an";
        const builtRows = buildProjectExportRows(allTasks, projectProgress, performanceMap);
        exportData = builtRows.filter(row => selectedProjectIds.includes(row.projectId));
      } else if (exportType === "member") {
        // Export by member performance
        filename = `bao_cao_hieu_suat_nhan_vien_${new Date().toISOString().split("T")[0]}`;
        worksheetName = "Hieu suat nhan vien";
        exportData = memberPerformanceRows.map((m) => {
          return {
            memberName: m.memberName || "",
            email: m.email || "",
            assignedTasks: m.assignedTasks || m.totalTasks || 0,
            totalTasks: m.totalTasks || m.assignedTasks || 0,
            completedTasks: m.completedTasks || 0,
            activeTasks: m.activeTasks || 0,
            inProgressTasks: m.inProgressTasks || 0,
            overdueTasks: m.overdueTasks || 0,
            blockedTasks: m.blockedTasks || 0,
            workloadLevel: getWorkloadLabel(m.workloadLevel),
            completionRate: formatExportPercent(m.completionRate || 0),
          };
        });
      } else if (exportType === "quarter") {
        // Export by quarter
        filename = `bao_cao_quy_${selectedQuarter}_nam_${selectedYear}`;
        worksheetName = `Quy ${selectedQuarter} - ${selectedYear}`;

        const qStartMonth = (selectedQuarter - 1) * 3;
        const qEndMonth = qStartMonth + 2;

        const quarterTasks = allTasks.filter((t) => {
          const taskDate = t.createdAt ? new Date(t.createdAt) : null;
          if (!taskDate) return false;
          return (
            taskDate.getFullYear() === selectedYear &&
            taskDate.getMonth() >= qStartMonth &&
            taskDate.getMonth() <= qEndMonth
          );
        });

        exportData = quarterTasks.map((task) =>
          createTaskExportRow(task, performanceMap, {
            quarter: `Quý ${selectedQuarter}`,
            year: selectedYear,
          })
        );
      }

      if (exportData.length === 0) {
        toast.error("Không có dữ liệu tương ứng để xuất!");
        return;
      }

      const selectedExportData = selectExportColumns(exportData, exportType, selectedColumnIds);

      // Convert json data to worksheet
      const worksheet = XLSX.utils.json_to_sheet(selectedExportData);

      // Auto-size columns nicely
      const maxKeys = Object.keys(selectedExportData[0]);
      const colWidths = maxKeys.map(key => {
        const headerLen = key.length;
        const maxValLen = Math.max(...selectedExportData.map(row => String(row[key] || '').length));
        return { wch: Math.max(headerLen, maxValLen) + 3 };
      });
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, worksheetName);
      XLSX.writeFile(workbook, `${filename}.xlsx`);

      toast.success("Xuất báo cáo Excel thành công!");
      setIsExportModalOpen(false);
    } catch (err: any) {
      console.error("Export report error:", err);
      toast.error("Không thể xuất báo cáo. Vui lòng thử lại.");
    } finally {
      setIsExporting(false);
    }
  };

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

  const [orgProjects, setOrgProjects] = useState<any[]>([]);
  const [isFetchingProjects, setIsFetchingProjects] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [hasInitProjectSelection, setHasInitProjectSelection] = useState(false);
  
  useEffect(() => {
    if (isExportModalOpen && exportType === "project" && !hasInitProjectSelection) {
      const fetchProjects = async () => {
        try {
          setIsFetchingProjects(true);
          const orgId = TokenManager.getCurrentOrgId();
          if (orgId) {
            const chartsData = await orgChartsApi.getSingleChart(orgId, ChartType.MANAGEMENT_SUMMARY);
            const projects = chartsData?.projectProgress || [];
            
            const formatted = projects.filter((p: any) => p.projectId && p.projectId !== "no-project").map((p: any) => ({
              id: p.projectId,
              name: p.projectName,
              workspace: { name: p.workspaceName || "Khác" }
            }));
            
            setOrgProjects(formatted);
            setSelectedProjectIds(formatted.map((p: any) => p.id));
            setHasInitProjectSelection(true);
          }
        } catch (error) {
          console.error("Failed to fetch projects for export", error);
        } finally {
          setIsFetchingProjects(false);
        }
      };
      
      fetchProjects();
    }
  }, [isExportModalOpen, exportType, hasInitProjectSelection]);

  useEffect(() => {
    if (!isExportModalOpen) {
      setHasInitProjectSelection(false);
      setOrgProjects([]);
    }
  }, [isExportModalOpen]);

  const projectsByWorkspace = useMemo(() => {
    const grouped: Record<string, { id: string; name: string }[]> = {};
    orgProjects.forEach((p) => {
      const wsName = p.workspace?.name || "Khác";
      if (!grouped[wsName]) grouped[wsName] = [];
      if (!grouped[wsName].find((x) => x.id === p.id)) {
        grouped[wsName].push({ id: p.id, name: p.name });
      }
    });
    return grouped;
  }, [orgProjects]);

  const totalProjectsCount = orgProjects.length;

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
                  className="h-10 justify-center gap-2 rounded-md shadow-sm font-semibold"
                  onClick={loadReports}
                  disabled={isLoading}
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  Làm mới
                </Button>
                <Button
                  type="button"
                  variant="default"
                  className="h-10 justify-center gap-2 rounded-md shadow-sm bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  onClick={() => setIsExportModalOpen(true)}
                >
                  <Download className="h-4 w-4" />
                  Xuất báo cáo
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
                      <p className="mt-2 text-xl font-bold text-slate-900">{dailyReports.length}</p>
                      <p className="text-xs font-semibold text-slate-700">
                        Báo cáo
                      </p>
                    </div>
                    <div className="rounded-md bg-amber-50 p-3">
                      <AlertCircle className="h-4 w-4 text-amber-700" />
                      <p className="mt-2 text-xl font-bold text-amber-900">{statusRequests.length}</p>
                      <p className="text-xs font-semibold text-amber-800">Chờ duyệt</p>
                    </div>
                    <div className="rounded-md bg-blue-50 p-3">
                      <Clock3 className="h-4 w-4 text-blue-700" />
                      <p className="mt-2 text-xl font-bold text-blue-900">{dailySummary.unreviewedCount}</p>
                      <p className="text-xs font-semibold text-blue-800">Chưa xem</p>
                    </div>
                    <div className="rounded-md bg-red-50 p-3">
                      <X className="h-4 w-4 text-red-700" />
                      <p className="mt-2 text-xl font-bold text-red-900">
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
                                  const displayProgress = report.progressPercent ?? (report.task as any)?.progressPercent;
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
                                            {typeof displayProgress === "number" ? (
                                              <div className="mt-2">
                                                <div className="mb-1 flex justify-between text-sm font-semibold">
                                                  <span>Công việc</span>
                                                  <span>{displayProgress}%</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-[var(--muted)]">
                                                  <div
                                                    className="h-2 rounded-full bg-slate-900"
                                                    style={{
                                                      width: `${Math.min(Math.max(displayProgress, 0), 100)}%`,
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

      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-5">
              <h3 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Download className="h-4 w-4" />
                </div>
                Xuất Báo Cáo
              </h3>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="rounded-full p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Select Options */}
            <div className="space-y-6">
              <div>
                <label className="block text-[13px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
                  1. Chọn định dạng báo cáo
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "task", title: "Theo công việc", desc: "Danh sách task & tiến độ" },
                    { id: "project", title: "Theo dự án", desc: "Thống kê theo từng project" },
                    { id: "member", title: "Hiệu suất nhân viên", desc: "Tỷ lệ % hiệu suất & số lượng việc" },
                    { id: "quarter", title: "Theo quý", desc: "Lọc dữ liệu theo Q1 - Q4" },
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setExportType(type.id as any)}
                      className={cn(
                        "flex flex-col items-start justify-center p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer outline-none",
                        exportType === type.id
                          ? "border-blue-500 bg-blue-500/5 text-blue-700 dark:text-blue-400 ring-1 ring-blue-500 shadow-sm"
                          : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:border-[var(--border)]"
                      )}
                    >
                      <span className="text-sm font-bold">{type.title}</span>
                      <span className={cn("text-xs mt-1", exportType === type.id ? "text-blue-600/80 dark:text-blue-400/80 font-medium" : "text-[var(--muted-foreground)]")}>
                        {type.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {exportType === "quarter" && (
                <div className="animate-in fade-in slide-in-from-top-2 p-5 rounded-xl bg-[var(--background)] border border-[var(--border)] grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                      Chọn Quý
                    </label>
                    <select
                      value={selectedQuarter}
                      onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                      className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value={1}>Quý 1 (T1 - T3)</option>
                      <option value={2}>Quý 2 (T4 - T6)</option>
                      <option value={3}>Quý 3 (T7 - T9)</option>
                      <option value={4}>Quý 4 (T10 - T12)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                      Chọn Năm
                    </label>
                    <input
                      type="number"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/50"
                      min={2020}
                      max={2100}
                    />
                  </div>
                </div>
              )}

              {exportType === "project" && (
                <div className="animate-in fade-in slide-in-from-top-2 mb-6">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-[13px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      2. Chọn dự án
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md">
                        Đã chọn {selectedProjectIds.length}/{totalProjectsCount}
                      </span>
                      <div className="flex gap-1 bg-[var(--muted)] p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedProjectIds(orgProjects.map((p) => p.id))
                          }
                          className="rounded-md px-3 py-1.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--background)] shadow-sm transition-all"
                        >
                          Tất cả
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedProjectIds([])}
                          className="rounded-md px-3 py-1.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--background)] shadow-sm transition-all"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {isFetchingProjects ? (
                    <div className="flex items-center justify-center p-8 border border-[var(--border)] rounded-xl bg-[var(--background)]">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    </div>
                  ) : totalProjectsCount === 0 ? (
                    <div className="flex items-center justify-center p-8 border border-[var(--border)] rounded-xl bg-[var(--background)]">
                      <span className="text-sm font-semibold text-[var(--muted-foreground)]">Không có dự án nào</span>
                    </div>
                  ) : (
                    <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-inner space-y-5">
                      {Object.entries(projectsByWorkspace).map(([wsName, projects]) => (
                        <div key={wsName} className="space-y-3">
                          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <FolderKanban className="h-4 w-4 text-[var(--muted-foreground)]" />
                            {wsName}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                            {projects.map((p) => {
                              const checked = selectedProjectIds.includes(p.id);
                              return (
                                <label
                                  key={p.id}
                                  className={cn(
                                    "flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border px-3 py-1.5 transition-all duration-200 outline-none",
                                    checked
                                      ? "border-blue-500 bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                                      : "border-[var(--border)] bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedProjectIds(prev => [...prev, p.id]);
                                      } else {
                                        setSelectedProjectIds(prev => prev.filter(id => id !== p.id));
                                      }
                                    }}
                                    className="h-4.5 w-4.5 rounded border-[var(--border)] bg-transparent text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                  />
                                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{p.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-[13px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {exportType === "project" ? "3. Chọn cột thông tin" : "2. Chọn cột thông tin"}
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md">
                      Đã chọn {selectedActiveExportColumnIds.length}/{activeExportColumns.length}
                    </span>
                    <div className="flex gap-1 bg-[var(--muted)] p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() =>
                          setAllExportColumnsForType(activeExportColumns.map((column) => column.id))
                        }
                        className="rounded-md px-3 py-1.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--background)] shadow-sm transition-all"
                      >
                        Tất cả
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllExportColumnsForType([])}
                        className="rounded-md px-3 py-1.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--background)] shadow-sm transition-all"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid max-h-64 grid-cols-1 gap-2.5 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 sm:grid-cols-2 shadow-inner">
                  {activeExportColumns.map((column) => {
                    const checked = selectedActiveExportColumnIds.includes(column.id);
                    return (
                      <label
                        key={column.id}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2 transition-all duration-200 outline-none focus-within:ring-2 focus-within:ring-blue-500",
                          checked
                            ? "border-blue-500 bg-[var(--card)] text-[var(--foreground)] shadow-sm ring-1 ring-blue-500/30"
                            : "border-[var(--border)] bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => toggleExportColumn(column.id, event.target.checked)}
                          className="h-4.5 w-4.5 rounded border-[var(--border)] bg-transparent text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{column.label}</span>
                        {column.important && (
                          <span className="shrink-0 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            Quan trọng
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-7 flex items-center justify-end gap-3 pt-5 border-t border-[var(--border)]">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsExportModalOpen(false)}
                disabled={isExporting}
                className="font-bold h-11 px-6 hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                disabled={isExporting || selectedActiveExportColumnIds.length === 0}
                onClick={handleExportReport}
                className="font-bold h-11 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 px-8 rounded-lg shadow-md shadow-blue-500/20 transition-all hover:-translate-y-0.5"
              >
                {isExporting ? "Đang xử lý..." : "Bắt đầu xuất"}
                <Download className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
