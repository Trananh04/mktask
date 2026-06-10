import { OrganizationAnalytics } from "@/components/organizations/OrganizationAnalytics";
import { TokenManager } from "@/lib/api";
import { SEO } from "@/components/common/SEO";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function DashboarPage() {
  const orgId = TokenManager.getCurrentOrgId();
  const router = useRouter();
  const { getCurrentUser } = useAuth();
  const user = getCurrentUser();
  const canViewDashboard =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "MANAGER";

  useEffect(() => {
    if (!canViewDashboard) {
      router.replace("/projects");
    }
  }, [canViewDashboard, router]);

  if (!canViewDashboard) return null;

  return (
    <>
      <SEO title="Dashboard" />
      <div className="dashboard-container">
        <OrganizationAnalytics organizationId={orgId} />
      </div>
    </>
  );
}
