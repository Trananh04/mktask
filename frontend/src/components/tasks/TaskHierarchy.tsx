import { useState } from "react";
import { Task } from "@/types/tasks";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import { Button } from "@/components/ui";
import ConfirmationModal from "@/components/modals/ConfirmationModal";
import { formatDateForDisplay } from "@/utils/date";

interface TaskHierarchyProps {
  task: Task;
  allTasks: Task[];
  onCreateSubtask: (parentId: string, subtaskData: any) => void;
  onConvertToSubtask: (taskId: string, parentId: string) => void;
  onPromoteToParent: (taskId: string) => void;
  onMoveSubtask: (taskId: string, newParentId: string) => void;
}

export default function TaskHierarchy({
  task,
  allTasks,
  onCreateSubtask,
  onConvertToSubtask,
  onPromoteToParent,
}: TaskHierarchyProps) {
  const [showCreateSubtask, setShowCreateSubtask] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [subtaskData, setSubtaskData] = useState({
    title: "",
    description: "",
    assigneeId: "",
    priority: "MEDIUM",
    dueDate: "",
    type: "SUBTASK",
  });
  const [taskToPromote, setTaskToPromote] = useState<Task | null>(null);
  const subtasks = allTasks.filter((t) => t.parentTaskId === task.id);
  const parentTask = task.parentTaskId ? allTasks.find((t) => t.id === task.parentTaskId) : null;
  const potentialParents = allTasks.filter(
    (t) => t.id !== task.id && t.parentTaskId !== task.id && !subtasks.some((st) => st.id === t.id)
  );

  const getTaskProgress = (taskWithSubtasks: Task) => {
    const taskSubtasks = allTasks.filter((t) => t.parentTaskId === taskWithSubtasks.id);
    if (taskSubtasks.length === 0) return 0;

    const completedSubtasks = taskSubtasks.filter((t) => t.status.category === "DONE").length;
    return Math.round((completedSubtasks / taskSubtasks.length) * 100);
  };

  const handleCreateSubtask = () => {
    if (subtaskData.title.trim()) {
      onCreateSubtask(task.id, subtaskData);
      setSubtaskData({
        title: "",
        description: "",
        assigneeId: "",
        priority: "MEDIUM",
        dueDate: "",
        type: "SUBTASK",
      });
      setShowCreateSubtask(false);
    }
  };

  const handlePromoteTask = (subtask: Task) => {
    onPromoteToParent(subtask.id);
    setTaskToPromote(null);
  };

  const getTaskTypeIcon = (task: Task) => {
    if (task.parentTaskId) return "📝";
    if (allTasks.some((t) => t.parentTaskId === task.id)) return "📁";
    return "📋";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGHEST":
        return "text-red-600";
      case "HIGH":
        return "text-orange-600";
      case "MEDIUM":
        return "text-yellow-600";
      case "LOW":
        return "text-green-600";
      case "LOWEST":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      LOWEST: "Thấp nhất",
      LOW: "Thấp",
      MEDIUM: "Trung bình",
      HIGH: "Cao",
      HIGHEST: "Cao nhất",
    };
    return labels[priority] || priority;
  };

  return (
    <div className="space-y-6">
      {/* Parent Task */}
      {parentTask && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Công việc cha</h3>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-lg">{getTaskTypeIcon(parentTask)}</span>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {parentTask.slug}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">{parentTask.title}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tiến độ: {getTaskProgress(parentTask)}%
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100`}
                >
                  {parentTask.status.name}
                </span>
                {parentTask.assignee && <UserAvatar user={parentTask.assignee} size="xs" />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Task Actions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Phân cấp công việc</h3>
          <div className="flex space-x-2">
            {!task.parentTaskId && (
              <Button variant="outline" onClick={() => setShowCreateSubtask(true)}>
                Tạo công việc con
              </Button>
            )}
            {task.parentTaskId && (
              <Button variant="outline" onClick={() => onPromoteToParent(task.id)}>
                Đưa lên công việc cha
              </Button>
            )}
            {!task.parentTaskId && (
              <Button variant="outline" onClick={() => setShowConvertModal(true)}>
                Chuyển thành công việc con
              </Button>
            )}
          </div>
        </div>

        {/* Current Task Info */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-lg">{getTaskTypeIcon(task)}</span>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900 dark:text-white">{task.slug}</span>
                  <span className="text-gray-600 dark:text-gray-400">{task.title}</span>
                </div>
                <div className="flex items-center space-x-4 mt-1">
                  <span className={`text-sm ${getPriorityColor(task.priority)}`}>
                    {getPriorityLabel(task.priority)} ưu tiên
                  </span>
                  {subtasks.length > 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {subtasks.length} công việc con - {getTaskProgress(task)}% hoàn thành
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100`}
              >
                {task.status.name}
              </span>
              {task.assignee && <UserAvatar user={task.assignee} size="xs" />}
            </div>
          </div>
        </div>
      </div>

      {/* Subtasks */}
      {subtasks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Công việc con ({subtasks.length})
          </h3>
          <div className="space-y-2">
            {subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">📝</span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {subtask.slug}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">{subtask.title}</span>
                    </div>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className={`text-xs ${getPriorityColor(subtask.priority)}`}>
                        {getPriorityLabel(subtask.priority)}
                      </span>
                      {subtask.dueDate && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Hạn: {formatDateForDisplay(subtask.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        subtask.status.category === "DONE"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {subtask.status.name}
                    </span>
                    {subtask.assignee && <UserAvatar user={subtask.assignee} size="xs" />}
                  </div>
                  <button
                    onClick={() => setTaskToPromote(subtask)}
                    className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 p-1"
                    title="Đưa lên công việc cha"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Subtask Modal */}
      {showCreateSubtask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Tạo công việc con
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tiêu đề *
                </label>
                <input
                  type="text"
                  value={subtaskData.title}
                  onChange={(e) => setSubtaskData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Nhập tiêu đề công việc con..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mô tả
                </label>
                <textarea
                  value={subtaskData.description}
                  onChange={(e) =>
                    setSubtaskData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Nhập mô tả công việc con..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Độ ưu tiên
                </label>
                <select
                  value={subtaskData.priority}
                  onChange={(e) =>
                    setSubtaskData((prev) => ({ ...prev, priority: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="LOWEST">Thấp nhất</option>
                  <option value="LOW">Thấp</option>
                  <option value="MEDIUM">Trung bình</option>
                  <option value="HIGH">Cao</option>
                  <option value="HIGHEST">Cao nhất</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hạn hoàn thành
                </label>
                <input
                  type="date"
                  value={subtaskData.dueDate}
                  onChange={(e) => setSubtaskData((prev) => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="secondary" onClick={() => setShowCreateSubtask(false)}>
                Hủy
              </Button>
              <Button onClick={handleCreateSubtask} disabled={!subtaskData.title.trim()}>
                Tạo công việc con
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Subtask Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Chuyển thành công việc con
            </h3>

            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Chọn công việc cha để chuyển công việc này thành công việc con.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Công việc cha
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  onChange={(e) => {
                    if (e.target.value) {
                      onConvertToSubtask(task.id, e.target.value);
                      setShowConvertModal(false);
                    }
                  }}
                >
                  <option value="">Chọn công việc cha...</option>
                  {potentialParents.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.slug} - {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="secondary" onClick={() => setShowConvertModal(false)}>
                Hủy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Promote Task Confirmation */}
      {taskToPromote && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setTaskToPromote(null)}
          onConfirm={() => handlePromoteTask(taskToPromote)}
          title="Đưa lên công việc cha"
          message={`Bạn có chắc muốn đưa "${taskToPromote.title}" lên thành công việc cha? Công việc này sẽ được gỡ khỏi công việc cha hiện tại.`}
          confirmText="Xác nhận"
          cancelText="Hủy"
          type="info"
        />
      )}
    </div>
  );
}
