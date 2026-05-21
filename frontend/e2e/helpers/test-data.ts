import { request } from '@playwright/test';

const API_BASE_URL = 'http://localhost:3000';

export async function createTestProject(authToken: string, organizationId?: string) {
  const apiContext = await request.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  // Fetch first workspace for the organization; create one if missing
  let workspaceId: string | undefined;
  if (organizationId) {
    try {
      const workspacesResponse = await apiContext.get(`/api/workspaces?organizationId=${organizationId}`);
      console.log('Workspaces response:', {
        status: workspacesResponse.status(),
        ok: workspacesResponse.ok(),
        url: workspacesResponse.url(),
      });

      if (workspacesResponse.ok()) {
        const raw = await workspacesResponse.json();
        console.log('Workspaces data:', JSON.stringify(raw).substring(0, 500));
        const workspaces = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
        if (workspaces.length > 0) {
          workspaceId = workspaces[0].id;
          console.log('Selected workspaceId:', workspaceId);
        } else {
          console.warn('No workspaces found in response; creating one for E2E');

          const timestamp = Date.now();
          const workspacePayload = {
            name: `E2E Workspace ${timestamp}`,
            slug: `e2e-workspace-${timestamp}`,
            organizationId,
          };

          const createWorkspaceResponse = await apiContext.post('/api/workspaces', {
            data: workspacePayload,
          });

          if (!createWorkspaceResponse.ok()) {
            const body = await createWorkspaceResponse.text();
            throw new Error(
              `Failed to create workspace for tests: ${createWorkspaceResponse.status()} - ${body.substring(0, 200)}`,
            );
          }

          const createdWorkspace = await createWorkspaceResponse.json();
          workspaceId = createdWorkspace?.id;
          console.log('Created workspaceId:', workspaceId);
        }
      } else {
        const text = await workspacesResponse.text();
        console.error('Workspaces fetch failed:', workspacesResponse.status(), text.substring(0, 200));
      }
    } catch (err) {
      console.error('Failed to fetch/create workspace:', err);
    }
  }

  if (!workspaceId) {
    throw new Error('No workspaceId available for test project creation');
  }

  const timestamp = Date.now();
  const projectData: any = {
    name: `E2E Test Project ${timestamp}`,
    slug: `e2e-test-project-${timestamp}`,
    color: '#3498db',
    description: 'Auto-generated test project',
    status: 'ACTIVE',
    priority: 'MEDIUM',
  };

  if (workspaceId) {
    projectData.workspaceId = workspaceId;
  }

  const response = await apiContext.post('/api/projects', {
    data: projectData,
  });

  if (!response.ok()) {
    const text = await response.text();
    console.error('Failed to create project:', {
      status: response.status(),
      url: response.url(),
      body: text.substring(0, 500),
    });
    throw new Error(`Failed to create test project: ${response.status()} - ${text.substring(0, 200)}`);
  }

  const contentType = response.headers()['content-type'] || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    console.error('Non-JSON response:', {
      status: response.status(),
      url: response.url(),
      contentType,
      body: text.substring(0, 500),
    });
    throw new Error(`Expected JSON response but got ${contentType}`);
  }

  const project = await response.json();
  await apiContext.dispose();

  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
  };
}

export async function getAuthContext(storageStatePath: string): Promise<{ token: string; organizationId?: string }> {
  const fs = await import('fs');
  const storageState = JSON.parse(fs.readFileSync(storageStatePath, 'utf-8'));

  let token: string | undefined;
  let organizationId: string | undefined;

  const tokenCookie = storageState.cookies?.find((c: any) =>
    ['token', 'auth_token', 'access_token'].includes(c.name)
  );
  if (tokenCookie) {
    token = tokenCookie.value;
  }

  const origins = storageState.origins || [];
  for (const origin of origins) {
    const localStorage = origin.localStorage || [];
    if (!token) {
      const tokenItem = localStorage.find((item: any) =>
        ['token', 'auth_token', 'access_token'].includes(item.name)
      );
      if (tokenItem) token = tokenItem.value;
    }

    const orgItem = localStorage.find((item: any) => item.name === 'currentOrganizationId');
    if (orgItem) organizationId = orgItem.value;
  }

  if (!token) {
    throw new Error('Auth token not found in storage state');
  }

  return { token, organizationId };
}

export const getAuthToken = async (storageStatePath: string): Promise<string> => {
  const ctx = await getAuthContext(storageStatePath);
  return ctx.token;
};
