import api from "@/lib/api";

export interface PlannedTask {
  id: string;
  title: string;
  description?: string;
  requiredSkills: string[];
  estimateHours?: number;
  storyPoints?: number;
  priority?: string;
  assigneeId?: string;
  assigneeName?: string;
}

export interface PlannedProject {
  id: string;
  name: string;
  description?: string;
  tasks: PlannedTask[];
}

export interface ProjectPlan {
  summary: string;
  projects: PlannedProject[];
  warnings: string[];
}

export interface ApplyProjectPlanResponse {
  createdProjects: Array<{ id: string; name: string; slug: string }>;
  createdTasks: Array<{ id: string; title: string; projectId: string; assigneeId?: string }>;
  warnings: string[];
}

export interface ReportSummaryItem {
  reporterName?: string;
  taskTitle?: string;
  reportType?: string;
  status?: string;
  progressPercent?: number;
  content: string;
  blockers?: string;
}

export interface ReportStatusRequestItem {
  requesterName?: string;
  taskTitle?: string;
  requestedStatusName?: string;
  note?: string;
}

export interface ProjectReportsForSummary {
  projectId?: string;
  projectName: string;
  workspaceName?: string;
  reports: ReportSummaryItem[];
  pendingRequests?: ReportStatusRequestItem[];
}

export interface AiProjectReportSummary {
  projectId?: string;
  projectName: string;
  rewrittenSummary: string;
  progressAssessment: string;
  issues: string[];
  recommendations: string[];
  nextActions: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
}

export interface AiReportSummaryResponse {
  overallSummary: string;
  projects: AiProjectReportSummary[];
  generatedAt: string;
}

export const aiProjectPlannerApi = {
  plan: async (workspaceId: string, description: string): Promise<ProjectPlan> => {
    const response = await api.post<ProjectPlan>("/ai-project-planner/plan", {
      workspaceId,
      description,
    });
    return response.data;
  },

  apply: async (
    workspaceId: string,
    plan: ProjectPlan,
    createAssignments = true
  ): Promise<ApplyProjectPlanResponse> => {
    const response = await api.post<ApplyProjectPlanResponse>("/ai-project-planner/apply", {
      workspaceId,
      plan,
      createAssignments,
    });
    return response.data;
  },

  summarizeReports: async (data: {
    date: string;
    projects: ProjectReportsForSummary[];
  }): Promise<AiReportSummaryResponse> => {
    const response = await api.post<AiReportSummaryResponse>(
      "/ai-project-planner/summarize-reports",
      data
    );
    return response.data;
  },
};
