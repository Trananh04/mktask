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
};
