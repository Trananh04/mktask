import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb as ShadcnBreadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { useWorkspace } from "@/contexts/workspace-context";

// Helper: Convert slug-like text into Title Case
const formatSegment = (segment: string) => {
  // Decode URI-encoded characters first
  try {
    segment = decodeURIComponent(segment);
  } catch {
    // ignore decoding errors
  }
  return segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

// Helper: Detect if a segment is a UUID
const isUUID = (segment: string) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
};

// Helper: Extract UUID from taskId (format: uuid-slug)
const extractUuid = (taskId: string) => {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = taskId.match(uuidPattern);
  return match ? match[0] : taskId;
};

// System page segments that are not project slugs
const SYSTEM_PAGES = ['tasks', 'settings', 'members', 'calendar', 'activities'];

interface BreadcrumbItem {
  name: string;
  href?: string;
  current: boolean;
}

// Simple cache to avoid redundant API calls
const projectNameCache = new Map<string, string>();

export default function Breadcrumb() {
  const pathname = usePathname();
  const { workspaceTree } = useWorkspace();
  const [currentPath, setCurrentPath] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  // Sync with actual window location (handles pushState)
  useEffect(() => {
    const updatePath = () => {
      setCurrentPath(window.location.pathname);
    };
    
    // Initial sync
    updatePath();
    
    // Listen to popstate (back/forward)
    window.addEventListener('popstate', updatePath);
    
    // Monkey-patch history.pushState and replaceState to detect URL changes
    const originalPushState = window.history.pushState;
    window.history.pushState = function(...args) {
      originalPushState.apply(this, args);
      updatePath();
    };

    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      updatePath();
    };
    
    return () => {
      window.removeEventListener('popstate', updatePath);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  // Use currentPath (from window.location) instead of pathname (from Next.js)
  const pathToUse = currentPath || pathname;

  const buildBreadcrumbFromSegments = useCallback(async (segments: string[]) => {
    const baseItems: BreadcrumbItem[] = [];
    const workspaceSegment = segments[0];

    if (workspaceTree && workspaceTree.length > 0 && workspaceSegment) {
      const workspace = workspaceTree.find(w => w.slug === workspaceSegment);
      if (workspace && workspace.path) {
        const ancestorIds = workspace.path.split('/').filter(Boolean);
        if (ancestorIds[ancestorIds.length - 1] === workspace.id) {
          ancestorIds.pop();
        }

        ancestorIds.forEach(id => {
          const ancestor = workspaceTree.find(w => w.id === id);
          if (ancestor) {
            baseItems.push({
              name: ancestor.name,
              href: `/${ancestor.slug}`,
              current: false,
            });
          }
        });
      }
    }

    // Fetch real project name if segment[1] looks like a project slug
    let projectName: string | null = null;
    if (segments.length >= 2) {
      const projectSlug = segments[1];
      if (!SYSTEM_PAGES.includes(projectSlug)) {
        // Check cache first
        if (projectNameCache.has(projectSlug)) {
          projectName = projectNameCache.get(projectSlug) || null;
        } else {
          try {
            // Correct endpoint: /projects/by-slug/:slug
            const response = await api.get(`/projects/by-slug/${encodeURIComponent(projectSlug)}`);
            if (response.data?.name) {
              projectName = response.data.name;
              projectNameCache.set(projectSlug, projectName as string);
            }
          } catch {
            // silently fall back to slug formatting
          }
        }
      }
    }

    const items = segments.map((seg, idx) => {
      const href = "/" + segments.slice(0, idx + 1).join("/");
      let displayName = formatSegment(seg);

      if (idx === 0 && workspaceTree && workspaceTree.length > 0) {
        const ws = workspaceTree.find(w => w.slug === seg);
        if (ws) displayName = ws.name;
      }

      // Use fetched project name for segment index 1 (project slug position)
      if (idx === 1 && projectName) {
        displayName = projectName;
      }

      return {
        name: displayName,
        href,
        current: idx === segments.length - 1,
      };
    });

    setBreadcrumbs([...baseItems, ...items]);
  }, [workspaceTree]);

  useEffect(() => {
    if (!pathToUse) {
      setBreadcrumbs([]);
      return;
    }

    // Skip breadcrumb for certain paths
    if (
      pathToUse === "/dashboard" ||
      pathToUse === "/dashboard/" ||
      pathToUse === "/tasks" ||
      pathToUse === "/tasks/" ||
      pathToUse === "/settings" ||
      pathToUse === "/settings/"
    ) {
      setBreadcrumbs([]);
      return;
    }

    const segments = pathToUse.split("/").filter((seg) => seg.length > 0);

    // Check if this is a task detail page
    // Patterns: /tasks/[slug], /[workspace]/tasks/[slug], /[workspace]/[project]/tasks/[slug]
    const taskSegmentIndex = segments.findIndex((seg, idx) => seg === 'tasks' && idx < segments.length - 1);

    if (taskSegmentIndex !== -1 && taskSegmentIndex < segments.length - 1) {
      const taskIdOrSlug = segments[taskSegmentIndex + 1];

      const fetchTaskBreadcrumb = async () => {
        try {
          const response = await api.get(`/tasks/key/${encodeURIComponent(taskIdOrSlug)}`);
          const task = response.data;

          const items: BreadcrumbItem[] = [];

          const urlWorkspace = taskSegmentIndex >= 1 && segments[0] !== 'tasks' ? segments[0] : null;
          const urlProject = taskSegmentIndex >= 2 && segments[1] !== 'tasks' ? segments[1] : null;

          const wsSlug = urlWorkspace || task.project?.workspace?.slug;
          const wsName = task.project?.workspace?.name;

          const pgSlug = urlProject || task.project?.slug;
          const pgName = task.project?.name;

          // Add workspace
          if (wsSlug) {
            items.push({
              name: wsName || formatSegment(wsSlug),
              href: `/${wsSlug}`,
              current: false,
            });
          }

          // Add project
          if (pgSlug && wsSlug) {
            items.push({
              name: pgName || formatSegment(pgSlug),
              href: `/${wsSlug}/${pgSlug}`,
              current: false,
            });
          }

          if (pgSlug && wsSlug) {
            items.push({
              name: 'Tasks',
              href: `/${wsSlug}/${pgSlug}/tasks`,
              current: false,
            });
          }

          // Add task (current)
          const taskSlug = task.slug || taskIdOrSlug;
          items.push({
            name: decodeURIComponent(taskSlug).replace(/-/g, ' '),
            current: true,
          });

          setBreadcrumbs(items);
        } catch (error) {
          console.error('Failed to fetch task data for breadcrumb:', error);
          buildBreadcrumbFromSegments(segments);
        }
      };
      fetchTaskBreadcrumb();
      return;
    }

    // Default: build breadcrumb from URL segments (with project name lookup)
    buildBreadcrumbFromSegments(segments);
  }, [pathToUse, buildBreadcrumbFromSegments, workspaceTree]);

  if (
    !pathToUse ||
    pathToUse === "/dashboard" ||
    pathToUse === "/dashboard/" ||
    pathToUse === "/tasks" ||
    pathToUse === "/tasks/" ||
    pathToUse === "/settings" ||
    pathToUse === "/settings/" ||
    breadcrumbs.length === 0
  ) {
    return null;
  }

  return (
    <div className="breadcrumb-container">
      <div className="">
        <ShadcnBreadcrumb>
          <BreadcrumbList className="breadcrumb-nav">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard" className="breadcrumb-link">
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="breadcrumb-separator">
              <ChevronRight className="breadcrumb-separator-icon" />
            </BreadcrumbSeparator>
            {breadcrumbs.map((item, idx) => (
              <React.Fragment key={item.href || idx}>
                <BreadcrumbItem className="breadcrumb-item">
                  {item.current ? (
                    <BreadcrumbPage className="breadcrumb-current">
                      <span className="breadcrumb-current-text">{item.name}</span>
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={item.href!} className="breadcrumb-link">
                        <span className="breadcrumb-link-text">{item.name}</span>
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {idx < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator className="breadcrumb-separator">
                    <ChevronRight className="breadcrumb-separator-icon" />
                  </BreadcrumbSeparator>
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </ShadcnBreadcrumb>
      </div>
    </div>
  );
}
