import { useEffect } from "react";
import { useRouter } from "next/router";
import { projectApi } from "@/utils/api/projectApi";
import { ApiAuthError, safeRedirect } from "@/lib/api";

export default function LegacyProjectRedirectPage() {
  const router = useRouter();
  const { projectSlug } = router.query;

  useEffect(() => {
    const redirectToCanonicalRoute = async () => {
      if (!router.isReady || typeof projectSlug !== "string") return;
      try {
        const project = await projectApi.getProjectBySlug(projectSlug, true);
        const workspaceSlug = project?.workspace?.slug;
        if (workspaceSlug && project?.slug) {
          await router.replace(`/${workspaceSlug}/${project.slug}`);
          return;
        }
      } catch (error) {
        console.error("Failed to resolve legacy project route:", error);
        if (error instanceof ApiAuthError) {
          safeRedirect("/login");
          return;
        }
      }
      await router.replace("/404");
    };

    void redirectToCanonicalRoute().catch((error) => {
      console.error("Unexpected legacy project redirect error:", error);
      if (error instanceof ApiAuthError) {
        safeRedirect("/login");
        return;
      }
      void router.replace("/404");
    });
  }, [router, projectSlug]);

  return null;
}
