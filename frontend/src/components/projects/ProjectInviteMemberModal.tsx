import { useEffect, useMemo, useState } from "react";
import ActionButton from "../common/ActionButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { HiUserAdd } from "react-icons/hi";
import { Label, Select } from "../ui";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { projectApi } from "@/utils/api/projectApi";
import { OrganizationMember, ProjectMember } from "@/types";

interface ProjectInviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (userId: string, role: string) => Promise<void>;
  availableRoles: Array<{ id: string; name: string; description: string }>;
  projectId: string;
  organizationId: string;
}

export const ProjectInviteMemberModal = ({
  isOpen,
  onClose,
  onAddMember,
  availableRoles,
  projectId,
  organizationId,
}: ProjectInviteMemberModalProps) => {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [role, setRole] = useState("");
  const [adding, setAdding] = useState(false);
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");

  useEffect(() => {
    if (!isOpen || !organizationId || !projectId) return;

    let ignore = false;
    const fetchSelectableMembers = async () => {
      try {
        setMembersLoading(true);
        setMembersError("");
        const [orgMembers, existingProjectMembers] = await Promise.all([
          projectApi.getOrganizationMembers(organizationId),
          projectApi.getProjectMembers(projectId),
        ]);

        if (!ignore) {
          setOrganizationMembers(orgMembers);
          setProjectMembers(existingProjectMembers);
        }
      } catch (error) {
        console.error("Failed to load selectable project members:", error);
        if (!ignore) {
          setMembersError("Không thể tải danh sách nhân viên");
        }
      } finally {
        if (!ignore) {
          setMembersLoading(false);
        }
      }
    };

    fetchSelectableMembers();

    return () => {
      ignore = true;
    };
  }, [isOpen, organizationId, projectId]);

  const selectableMembers = useMemo(() => {
    const projectMemberIds = new Set(projectMembers.map((member) => member.userId));
    return organizationMembers.filter(
      (member) => member.user?.id && member.user.email && !projectMemberIds.has(member.userId)
    );
  }, [organizationMembers, projectMembers]);

  const getMemberName = (member: OrganizationMember) => {
    const fullName = `${member.user?.firstName || ""} ${member.user?.lastName || ""}`.trim();
    return fullName || member.user?.username || member.user?.email || "Nhân viên";
  };

  const resetForm = () => {
    setSelectedUserId("");
    setRole("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUserId || !role) return;

    setAdding(true);
    try {
      await onAddMember(selectedUserId, role);
      resetForm();
      onClose();
    } catch (error) {
      console.error("Failed to add project member:", error);
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div automation-id="invite-modal">
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="bg-[var(--card)] border-none rounded-[var(--card-radius)] shadow-lg max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--foreground)] flex items-center gap-2">
              <HiUserAdd className="w-5 h-5 text-[var(--primary)]" />
              Thêm thành viên vào dự án
            </DialogTitle>
            <DialogDescription className="text-[var(--muted-foreground)]">
              Chọn nhân viên có sẵn để thêm vào dự án này.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-[var(--foreground)]">Nhân viên</Label>
              <div
                id="invite-member"
                className="mt-1 max-h-52 overflow-y-auto rounded-md bg-background p-1"
              >
                {membersLoading && (
                  <p className="px-3 py-4 text-sm text-[var(--muted-foreground)]">
                    Đang tải danh sách nhân viên...
                  </p>
                )}
                {!membersLoading && membersError && (
                  <p className="px-3 py-4 text-sm text-[var(--destructive)]">{membersError}</p>
                )}
                {!membersLoading && !membersError && selectableMembers.length === 0 && (
                  <p className="px-3 py-4 text-sm text-[var(--muted-foreground)]">
                    Tất cả nhân viên đã có trong dự án.
                  </p>
                )}
                {!membersLoading &&
                  !membersError &&
                  selectableMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedUserId(member.userId)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                        selectedUserId === member.userId
                          ? "bg-[var(--primary)]/10 text-[var(--foreground)]"
                          : "hover:bg-[var(--hover-bg)]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {getMemberName(member)}
                        </span>
                        <span className="block truncate text-xs text-[var(--muted-foreground)]">
                          {member.user?.email}
                        </span>
                      </span>
                      <span
                        className={`size-4 shrink-0 rounded-full border ${
                          selectedUserId === member.userId
                            ? "border-[var(--primary)] bg-[var(--primary)]"
                            : "border-[var(--border)]"
                        }`}
                      />
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-[var(--foreground)]">Vai trò</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger
                  className="projects-workspace-button border-none mt-1"
                  onFocus={(event) => {
                    event.currentTarget.style.boxShadow = "none";
                  }}
                  onBlur={(event) => {
                    event.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <SelectValue placeholder="Chọn vai trò">
                    {role && <span className="text-[var(--foreground)]">{role}</span>}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="border-none bg-[var(--card)]">
                  {availableRoles.map((availableRole) => (
                    <SelectItem
                      key={availableRole.id}
                      value={availableRole.name}
                      className="hover:bg-[var(--hover-bg)]"
                    >
                      <div className="flex flex-col items-start py-1">
                        <span className="font-medium text-[var(--foreground)]">
                          {availableRole.name}
                        </span>
                        <span className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          {availableRole.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!role && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Vui lòng chọn vai trò cho thành viên
                </p>
              )}
            </div>

            <DialogFooter className="flex justify-end gap-3">
              <ActionButton
                secondary
                type="button"
                onClick={handleClose}
                disabled={adding}
                className="w-20"
              >
                Hủy
              </ActionButton>
              <ActionButton
                primary
                type="submit"
                disabled={adding || !selectedUserId || !role}
                className="w-32"
              >
                {adding ? "Đang thêm..." : "Thêm thành viên"}
              </ActionButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
