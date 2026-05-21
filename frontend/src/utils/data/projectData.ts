export const PROJECT_CATEGORIES = [
  {
    id: "operational",
    label: "Vận hành",
    color: "#3B82F6", // Blue
    description: "Vận hành và bảo trì hằng ngày",
  },
  {
    id: "technical",
    label: "Kỹ thuật",
    color: "#8B5CF6", // Purple
    description: "Dự án phát triển và kỹ thuật",
  },
  {
    id: "strategic",
    label: "Chiến lược",
    color: "#10B981", // Green
    description: "Lập kế hoạch và chiến lược dài hạn",
  },
  {
    id: "hiring",
    label: "Tuyển dụng",
    color: "#F59E0B", // Yellow
    description: "Tuyển dụng và xây dựng đội nhóm",
  },
  {
    id: "financial",
    label: "Tài chính",
    color: "#EF4444", // Red
    description: "Ngân sách và kế hoạch tài chính",
  },
  {
    id: "neutral",
    label: "Chung",
    color: "#6B7280", // Gray
    description: "Dự án chung hoặc chưa phân loại",
  },
  {
    id: "innovation",
    label: "Đổi mới",
    color: "#6366F1", // Indigo
    description: "Sáng tạo và sáng kiến đổi mới",
  },
  {
    id: "community",
    label: "Cộng đồng",
    color: "#EC4899", // Pink
    description: "Cộng đồng và hoạt động gắn kết",
  },
  {
    id: "sustainability",
    label: "Bền vững",
    color: "#14B8A6", // Teal
    description: "Dự án môi trường và phát triển bền vững",
  },
  {
    id: "marketing",
    label: "Marketing",
    color: "#F97316", // Orange
    description: "Chiến dịch marketing và tiếp cận",
  },
  {
    id: "research",
    label: "Nghiên cứu",
    color: "#06B6D4", // Cyan
    description: "Dự án nghiên cứu và phân tích",
  },
  {
    id: "growth",
    label: "Tăng trưởng",
    color: "#65A30D", // Lime
    description: "Sáng kiến tăng trưởng và mở rộng",
  },
];

export const roles = [
  {
    id: "0",
    name: "OWNER",
    description: "Có thể quản lý tất cả",
    variant: "default" as const,
  },
  {
    id: "1",
    name: "MANAGER",
    description: "Có thể quản lý dự án và thành viên",
    variant: "default" as const,
  },
  {
    id: "2",
    name: "MEMBER",
    description: "Có thể truy cập và làm việc trong dự án",
    variant: "default" as const,
  },
  {
    id: "3",
    name: "VIEWER",
    description: "Chỉ có thể xem nội dung dự án",
    variant: "secondary" as const,
  },
];

export const ACTION_TYPES = [
  { value: "setPriority", label: "Đặt độ ưu tiên" },
  { value: "assignTo", label: "Phân công cho" },
  { value: "addLabels", label: "Thêm nhãn" },
  { value: "markAsSpam", label: "Đánh dấu spam" },
  { value: "autoReply", label: "Tự động trả lời" },
];

export const EMAIL_FIELDS = [
  { value: "subject", label: "Tiêu đề" },
  { value: "from", label: "Từ" },
  { value: "to", label: "Đến" },
  { value: "cc", label: "CC" },
  { value: "body", label: "Nội dung" },
];

export const EMAIL_OPERATORS = [
  { value: "contains", label: "Chứa" },
  { value: "equals", label: "Bằng" },
  { value: "matches", label: "Khớp" },
  { value: "startsWith", label: "Bắt đầu bằng" },
  { value: "endsWith", label: "Kết thúc bằng" },
];
