import {
  CalendarDays,
  Clock,
  CheckCircle,
  Type,
  Star,
  Tag,
  Hash,
  ListChecks,
  FileText,
  ArrowUpDown,
} from "lucide-react";

import {
  HiOutlineClipboard,
  HiOutlineLightBulb,
  HiOutlineBugAnt,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { HiOutlineViewList } from "react-icons/hi";

export const TaskPriorities = [
  { id: "LOW", name: "Thấp", value: "LOW", color: "#6b7280" },
  { id: "MEDIUM", name: "Trung bình", value: "MEDIUM", color: "#f59e0b" },
  { id: "HIGH", name: "Cao", value: "HIGH", color: "#ef4444" },
  { id: "HIGHEST", name: "Cao nhất", value: "HIGHEST", color: "#dc2626" },
];

export const labelColors = [
  { name: "Xanh dương", value: "#3B82F6" },
  { name: "Tím", value: "#8B5CF6" },
  { name: "Xanh lá", value: "#10B981" },
  { name: "Vàng", value: "#F59E0B" },
  { name: "Đỏ", value: "#EF4444" },
  { name: "Xám", value: "#6B7280" },
  { name: "Chàm", value: "#6366F1" },
  { name: "Hồng", value: "#EC4899" },
  { name: "Xanh ngọc", value: "#14B8A6" },
  { name: "Cam", value: "#F97316" },
  { name: "Xanh lơ", value: "#06B6D4" },
  { name: "Xanh chanh", value: "#65A30D" },
];

export const PRIORITY_OPTIONS = [
  {
    value: "LOW",
    label: "Thấp",
    color: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  },
  {
    value: "MEDIUM",
    label: "Trung bình",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
  },
  {
    value: "HIGH",
    label: "Cao",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
  },
  {
    value: "HIGHEST",
    label: "Cao nhất",
    color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
  },
];

export const TASK_TYPE_OPTIONS = [
  { value: "TASK", label: "Công việc" },
  { value: "BUG", label: "Bug" },
  { value: "EPIC", label: "Epic" },
  { value: "STORY", label: "Story" },
  { value: "SUBTASK", label: "Công việc con" },
];

export const DEFAULT_SORT_FIELDS = [
  { value: "listRank", label: "Thứ hạng", icon: ArrowUpDown, category: "number" },
  { value: "createdAt", label: "Ngày tạo", icon: Clock, category: "date" },
  { value: "updatedAt", label: "Ngày cập nhật", icon: CalendarDays, category: "date" },
  { value: "dueDate", label: "Hạn hoàn thành", icon: CalendarDays, category: "date" },
  { value: "dueIn", label: "Còn hạn", icon: Clock, category: "date" },
  { value: "completedAt", label: "Ngày hoàn thành", icon: CheckCircle, category: "date" },
  { value: "title", label: "Tên công việc", icon: Type, category: "text" },
  { value: "priority", label: "Độ ưu tiên", icon: Star, category: "text" },
  { value: "status", label: "Trạng thái", icon: Tag, category: "text" },
  { value: "taskNumber", label: "Mã công việc", icon: Hash, category: "number" },
  { value: "storyPoints", label: "Điểm ước lượng", icon: ListChecks, category: "number" },
  { value: "commentsCount", label: "Bình luận", icon: FileText, category: "number" },
];

export const TaskTypeIcon = {
  TASK: { label: "Công việc", icon: HiOutlineClipboard, color: "blue-500" },
  STORY: { label: "Story", icon: HiOutlineLightBulb, color: "green-500" },
  BUG: { label: "Bug", icon: HiOutlineBugAnt, color: "red-500" },
  EPIC: { label: "Epic", icon: HiOutlineSparkles, color: "purple-500" },
  SUBTASK: { label: "Công việc con", icon: HiOutlineViewList, color: "orange-500" },
} as const;

// Task Type Color mapping from Tailwind class to hex
export const TaskTypeColorMap: Record<string, string> = {
  "blue-500": "#3B82F6",
  "green-500": "#10B981",
  "red-500": "#EF4444",
  "purple-500": "#8B5CF6",
  "orange-500": "#F97316",
};

// Helper function to get hex color from task type
export const getTaskTypeHexColor = (taskType: keyof typeof TaskTypeIcon): string => {
  const color = TaskTypeIcon[taskType]?.color;
  return TaskTypeColorMap[color] || "#6B7280"; // Default gray
};
