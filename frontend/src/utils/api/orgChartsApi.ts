import api from "@/lib/api";
import { ChartDataResponse, ChartScope, ChartType } from "@/types";

type OrganizationChartFilters = {
  workspaceId?: string;
  projectId?: string;
  minMemberCount?: number;
  scope?: ChartScope;
};

// Chart type enum matching backend

export const orgChartsApi = {
  /**
   * Get multiple chart data types in a single request
   */
  getMultipleCharts: async (
    orgId: string,
    chartTypes: ChartType[],
    filters: OrganizationChartFilters = {}
  ): Promise<ChartDataResponse> => {
    try {
      const params = new URLSearchParams();
      chartTypes.forEach((type) => params.append("types", type));

      // Append filters
      if (filters.workspaceId) params.append("workspaceId", filters.workspaceId);
      if (filters.projectId) params.append("projectId", filters.projectId);
      if (filters.scope) params.append("scope", filters.scope);

      const response = await api.get(`/organizations/${orgId}/charts?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error("Get multiple charts error:", error);
      throw error;
    }
  },

  /**
   * Get single chart data type
   */
  getSingleChart: async (
    orgId: string,
    chartType: ChartType,
    filters: OrganizationChartFilters = {}
  ): Promise<any> => {
    try {
      const results = await orgChartsApi.getMultipleCharts(orgId, [chartType], filters);
      return results[chartType];
    } catch (error) {
      console.error(`Get ${chartType} chart error:`, error);
      throw error;
    }
  },

  /**
   * Get all available charts
   */
  getAllCharts: async (
    orgId: string,
    filters: OrganizationChartFilters = {}
  ): Promise<ChartDataResponse> => {
    try {
      const allChartTypes = Object.values(ChartType);
      return await orgChartsApi.getMultipleCharts(orgId, allChartTypes, filters);
    } catch (error) {
      console.error("Get all charts error:", error);
      throw error;
    }
  },
};
