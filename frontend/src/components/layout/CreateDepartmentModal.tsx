import React, { useState } from "react";
import { workspaceApi } from "@/utils/api/workspaceApi";
import { TokenManager } from "@/lib/api";
import { toast } from "sonner";
import { generateSlug } from "@/utils/slugUtils";

interface CreateDepartmentModalProps {
  onClose: () => void;
  onCreated?: (workspace: any) => void;
}

export default function CreateDepartmentModal({
  onClose,
  onCreated,
}: CreateDepartmentModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Tên phòng ban không được để trống");
      return;
    }

    setIsSubmitting(true);
    try {
      const orgId = TokenManager.getCurrentOrgId();
      if (!orgId) {
        toast.error("Không xác định được tổ chức hiện tại");
        return;
      }

      const workspace = await workspaceApi.createWorkspace({
        name: name.trim(),
        description: description.trim() || undefined,
        slug: slug || generateSlug(name.trim()),
        organizationId: orgId,
        color: "#4F46E5",
      } as any);

      toast.success(`Đã tạo phòng ban "${workspace.name}" thành công!`);
      onCreated?.(workspace);
      onClose();
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Không tạo được phòng ban";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Tạo phòng ban mới
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Phòng ban dùng để nhóm các dự án theo bộ phận
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Tên phòng ban <span className="text-red-500">*</span>
            </label>
            <input
              id="dept-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="VD: Phòng Kỹ thuật, Phòng Marketing..."
              autoFocus
              className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Slug (đường dẫn URL)
            </label>
            <input
              id="dept-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="phong-ky-thuat"
              className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] font-mono outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
            />
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Chỉ dùng chữ thường, số và dấu gạch ngang
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Mô tả
            </label>
            <textarea
              id="dept-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn về phòng ban này..."
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 h-9 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 h-9 rounded-lg bg-[var(--primary)] text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Đang tạo..." : "Tạo phòng ban"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
