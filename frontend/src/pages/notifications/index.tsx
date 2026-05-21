import { useAuth } from "@/contexts/auth-context";
import NotificationScreen from "@/components/notifications/NotificationScreen";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { SEO } from "@/components/common/SEO";

export default function NotificationPage({}) {
  const { user } = useAuth();
  const { getCurrentOrganizationId } = useWorkspaceContext();
  const currentOrganizationId = getCurrentOrganizationId();

  // Show error if user or organization not found
  if (!user || !currentOrganizationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SEO title="Thông báo" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Không có quyền truy cập</h1>
          <p className="text-gray-600">
            Vui lòng đăng nhập và chọn tổ chức để xem thông báo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO title="Thông báo" />
      <NotificationScreen userId={user.id} organizationId={currentOrganizationId} />
    </>
  );
}
