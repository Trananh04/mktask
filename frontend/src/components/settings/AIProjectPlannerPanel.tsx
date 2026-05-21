"use client";

import { useEffect, useMemo, useState } from "react";
import { HiSparkles, HiCheckCircle, HiExclamationTriangle } from "react-icons/hi2";
import { aiProjectPlannerApi, ProjectPlan } from "@/utils/api/aiProjectPlannerApi";
import { workspaceApi } from "@/utils/api/workspaceApi";

const SAMPLE_DESCRIPTION =
  "Tôi muốn xây dựng website bán hàng gồm đăng nhập, quản lý sản phẩm, giỏ hàng, thanh toán, trang quản trị và báo cáo doanh thu.";

export default function AIProjectPlannerPanel() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [description, setDescription] = useState("");
  const [plan, setPlan] = useState<ProjectPlan | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const taskCount = useMemo(
    () => plan?.projects.reduce((total, project) => total + project.tasks.length, 0) || 0,
    [plan]
  );

  useEffect(() => {
    let isMounted = true;
    workspaceApi
      .getWorkspaces()
      .then((items) => {
        if (!isMounted) return;
        setWorkspaceId((current) => current || items[0]?.id || "");
      })
      .catch(() => setError("Không tải được khu vực dự án mặc định."));
    return () => {
      isMounted = false;
    };
  }, []);

  const handlePlan = async () => {
    setError("");
    setMessage("");
    setPlan(null);
    if (!workspaceId) {
      setError("Chưa có khu vực dự án mặc định. Vui lòng chạy thiết lập hệ thống trước.");
      return;
    }
    if (!description.trim()) {
      setError("Bạn cần nhập mô tả dự án.");
      return;
    }
    setIsPlanning(true);
    try {
      const nextPlan = await aiProjectPlannerApi.plan(workspaceId, description.trim());
      setPlan(nextPlan);
      setMessage("AI đã tạo bản nháp kế hoạch. Hãy kiểm tra trước khi tạo thật.");
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Không tạo được kế hoạch.");
    } finally {
      setIsPlanning(false);
    }
  };

  const handleApply = async () => {
    if (!plan || !workspaceId) return;
    setError("");
    setMessage("");
    setIsApplying(true);
    try {
      const result = await aiProjectPlannerApi.apply(workspaceId, plan, true);
      setMessage(
        `Đã tạo ${result.createdProjects.length} dự án và ${result.createdTasks.length} công việc.`
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Không áp dụng được kế hoạch.");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <section className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--card-radius)] p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-blue-600 text-white flex items-center justify-center">
            <HiSparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Lập kế hoạch dự án bằng AI
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Nhập mô tả, AI sẽ chia dự án, tạo task và gợi ý người phụ trách.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-[var(--foreground)]">Mô tả dự án</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={SAMPLE_DESCRIPTION}
            className="min-h-32 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm leading-6"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDescription(SAMPLE_DESCRIPTION)}
            className="px-3 py-2 rounded-md bg-[var(--accent)] text-sm text-[var(--foreground)]"
          >
            Điền ví dụ
          </button>
          <button
            type="button"
            onClick={handlePlan}
            disabled={isPlanning}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-60"
          >
            {isPlanning ? "Đang lập kế hoạch..." : "Tạo bản nháp"}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!plan || isApplying}
            className="px-4 py-2 rounded-md bg-black text-white text-sm disabled:opacity-40"
          >
            {isApplying ? "Đang tạo..." : "Tạo dự án và công việc"}
          </button>
        </div>

        {message && (
          <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            <HiCheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <HiExclamationTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {plan && (
          <div className="rounded-md border border-[var(--border)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">{plan.summary}</h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {plan.projects.length} dự án, {taskCount} công việc
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {plan.projects.map((project) => (
                <div key={project.id} className="border-t border-[var(--border)] pt-4">
                  <h4 className="font-semibold text-[var(--foreground)]">{project.name}</h4>
                  {project.description && (
                    <p className="text-sm text-[var(--muted-foreground)] mt-1">
                      {project.description}
                    </p>
                  )}
                  <div className="mt-3 grid gap-2">
                    {project.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm"
                      >
                        <div className="font-medium text-[var(--foreground)]">{task.title}</div>
                        <div className="text-[var(--muted-foreground)]">
                          {task.assigneeName
                            ? `Gợi ý: ${task.assigneeName}`
                            : "Chưa có người phù hợp"}
                          {task.estimateHours ? ` · ${task.estimateHours} giờ` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {plan.warnings.length > 0 && (
              <div className="mt-4 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                {plan.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
