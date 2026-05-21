import ProjectsContent from "@/components/projects/ProjectsContent";
import { TokenManager } from "@/lib/api";
import { SEO } from "@/components/common/SEO";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

export default function ProjectsPage() {
  const { t } = useTranslation("projects");
  const [orgId, setOrgId] = useState<string | null>(() => TokenManager.getCurrentOrgId());

  useEffect(() => {
    const syncOrgId = () => setOrgId(TokenManager.getCurrentOrgId());

    syncOrgId();
    window.addEventListener("organizationChanged", syncOrgId);
    window.addEventListener("storage", syncOrgId);

    return () => {
      window.removeEventListener("organizationChanged", syncOrgId);
      window.removeEventListener("storage", syncOrgId);
    };
  }, []);

  return (
    <>
      <SEO title={t("title")} />
      <ProjectsContent
        contextType="organization"
        contextId={orgId}
        title={t("title")}
        description={t("description")}
        emptyStateTitle={t("empty_state_title")}
        emptyStateDescription={t("empty_state_description")}
        enablePagination={true}
        generateProjectLink={(project) => `/${project.workspace?.slug || "workspaces"}/${project.slug}`}
      />
    </>
  );
}

