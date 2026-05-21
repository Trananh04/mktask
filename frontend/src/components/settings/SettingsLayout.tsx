import React, { useState, useEffect } from "react";

interface Organization {
  id: string;
  name: string;
  plan?: string;
}

interface SettingsLayoutProps {
  children: React.ReactNode;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export default function SettingsLayout({
  children,
  activeSection,
  onSectionChange,
}: SettingsLayoutProps) {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);

  useEffect(() => {
    const getOrganizationData = () => {
      try {
        const orgId = localStorage.getItem("currentOrganizationId");
        const currentOrg = localStorage.getItem("currentOrganizationId");

        if (currentOrg) {
          try {
            const parsedOrg = JSON.parse(currentOrg);
            setCurrentOrganization({
              id: parsedOrg.id,
              name: parsedOrg.name,
              plan: parsedOrg.plan || "Miễn phí",
            });
          } catch {
            if (orgId) {
              setCurrentOrganization({
                id: orgId,
                name: "Tổ chức đã chọn",
                plan: "Miễn phí",
              });
            }
          }
        } else if (orgId) {
          setCurrentOrganization({
            id: orgId,
            name: "Tổ chức đã chọn",
            plan: "Miễn phí",
          });
        }
      } catch (error) {
        console.error("Error getting organization from localStorage:", error);
      }
    };

    getOrganizationData();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "currentOrganizationId" || e.key === "currentOrganization") {
        getOrganizationData();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const settingsSections = [
    {
      id: "profile",
      title: "Hồ sơ",
      icon: "👤",
      description: "Thông tin cá nhân và tùy chọn",
    },
    {
      id: "account",
      title: "Tài khoản",
      icon: "⚙️",
      description: "Cài đặt và bảo mật tài khoản",
    },
    {
      id: "notifications",
      title: "Thông báo",
      icon: "🔔",
      description: "Tùy chọn email và thông báo đẩy",
    },
    {
      id: "ai-chat",
      title: "Trò chuyện AI",
      icon: "🤖",
      description: "Cấu hình và cài đặt trợ lý AI",
    },
    {
      id: "appearance",
      title: "Giao diện",
      icon: "🎨",
      description: "Tùy chọn giao diện và hiển thị",
    },
    {
      id: "organization",
      title: "Tổ chức",
      icon: "🏢",
      description: "Cài đặt và thành viên tổ chức",
    },
    {
      id: "projects",
      title: "Dự án",
      icon: "📁",
      description: "Cấu hình và mặc định của dự án",
    },
    {
      id: "integrations",
      title: "Tích hợp",
      icon: "🔌",
      description: "Tích hợp bên thứ ba và API",
    },
    {
      id: "security",
      title: "Bảo mật",
      icon: "🔒",
      description: "Cài đặt bảo mật và quyền riêng tư",
    },
    {
      id: "billing",
      title: "Thanh toán",
      icon: "💳",
      description: "Thông tin gói đăng ký và thanh toán",
    },
    {
      id: "advanced",
      title: "Nâng cao",
      icon: "⚡",
      description: "Tùy chọn cấu hình nâng cao",
    },
  ];

  return (
    <div className="settings-layout-container settings-layout-container-dark">
      <div className="settings-layout-wrapper">
        <div className="settings-layout-header">
          <h1 className="settings-layout-title settings-layout-title-dark">Cài đặt</h1>
          <p className="settings-layout-subtitle settings-layout-subtitle-dark">
            Quản lý tài khoản, tổ chức và tùy chọn của bạn
          </p>
        </div>

        <div className="settings-layout-grid">
          {/* Cài đặt Navigation */}
          <div className="settings-nav">
            <nav className="settings-nav-list">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => onSectionChange(section.id)}
                  className={`settings-nav-item ${
                    activeSection === section.id
                      ? "settings-nav-item-active settings-nav-item-active-dark"
                      : "settings-nav-item-inactive settings-nav-item-inactive-dark"
                  }`}
                >
                  <span className="settings-nav-item-icon">{section.icon}</span>
                  <div className="settings-nav-item-content">
                    <div className="settings-nav-item-title">{section.title}</div>
                    <div className="settings-nav-item-description settings-nav-item-description-dark">
                      {section.description}
                    </div>
                  </div>
                </button>
              ))}
            </nav>

            {/* Tổ chức Ngữ cảnh */}
            {currentOrganization && (
              <div className="settings-org-context settings-org-context-dark">
                <h3 className="settings-org-context-title settings-org-context-title-dark">
                  Tổ chức hiện tại
                </h3>
                <div className="settings-org-context-content">
                  <div className="settings-org-context-avatar settings-org-context-avatar-dark">
                    <span className="settings-org-context-avatar-text settings-org-context-avatar-text-dark">
                      {currentOrganization.name.charAt(0)}
                    </span>
                  </div>
                  <div className="settings-org-context-info">
                    <div className="settings-org-context-name settings-org-context-name-dark">
                      {currentOrganization.name}
                    </div>
                    <div className="settings-org-context-plan settings-org-context-plan-dark">
                      Gói {currentOrganization.plan}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cài đặt Content */}
          <div className="settings-content">
            <div className="settings-content-card settings-content-card-dark">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
