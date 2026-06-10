import WorkspacesPageContent from "@/components/workspace/WorkspacesPageContent";
import { TokenManager } from "@/lib/api";
import { SEO } from "@/components/common/SEO";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

export default function WorkspacesPage() {
  const { t } = useTranslation("workspaces");
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
      {orgId ? (
        <WorkspacesPageContent organizationId={orgId} />
      ) : null}
    </>
  );
}
