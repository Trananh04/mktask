export function buildPlannerPrompt(
  description: string,
  members: Array<Record<string, unknown>>,
): string {
  return `Hãy phân tích mô tả dự án dưới đây và tạo kế hoạch triển khai chi tiết, thực tế.

Yêu cầu đầu ra JSON (trả về chính xác format này, không thêm gì):
{
  "summary": "Tóm tắt ngắn (1-2 câu) về toàn bộ kế hoạch bằng tiếng Việt",
  "projects": [
    {
      "id": "project-1",
      "name": "Tên module/phần dự án",
      "description": "Mục tiêu cụ thể của module này",
      "tasks": [
        {
          "id": "task-1",
          "title": "Tên công việc cụ thể, rõ ràng, có thể thực hiện ngay",
          "description": "Mô tả chi tiết những gì cần làm và tiêu chí hoàn thành",
          "requiredSkills": ["frontend", "react"],
          "estimateHours": 8,
          "storyPoints": 3,
          "priority": "HIGH",
          "phase": "development"
        }
      ]
    }
  ],
  "warnings": []
}

QUY TẮC QUAN TRỌNG:
1. Chỉ trả JSON hợp lệ, không markdown, không giải thích.
2. Dùng tiếng Việt cho tất cả summary, name, title, description, warnings.
3. Nếu người dùng yêu cầu một dự án hoặc cung cấp một tên dự án cụ thể, chỉ tạo đúng 1 project với tên đó.
4. Chỉ tạo nhiều project khi người dùng nói rõ cần nhiều dự án (tối đa 4 project); mỗi project tối đa 20 task — ưu tiên CHẤT LƯỢNG.
5. Mỗi task phải có title cụ thể và actionable (VD: "Thiết kế UI màn hình đăng nhập", không phải "Làm UI").
6. description của task phải nêu rõ: làm gì, output là gì, hoàn thành khi nào.
7. requiredSkills: dùng keyword ngắn không dấu — frontend, backend, design, qa, devops, database, marketing, content, sales, mobile, security, analytics.
8. priority: chỉ LOWEST | LOW | MEDIUM | HIGH | HIGHEST.
9. phase (giai đoạn): planning | design | development | testing | deployment | review.
10. estimateHours: thực tế (1-40 giờ/task). storyPoints: 1-13 theo Fibonacci.
11. Phân chia task theo luồng công việc tự nhiên: từ phân tích → thiết kế → phát triển → kiểm thử → triển khai.
12. KHÔNG tự bịa assigneeId. Việc phân công do hệ thống xử lý sau.

HƯỚNG DẪN PHÂN CHIA PROJECT:
- Mỗi project nên đại diện cho một module độc lập hoặc giai đoạn chính.
- Ví dụ: "Module Xác thực", "Module Quản lý sản phẩm", "Module Thanh toán", "Hạ tầng & DevOps".

THÀNH VIÊN HIỆN CÓ (tham khảo để estimate workload):
${JSON.stringify(members, null, 2)}

MÔ TẢ DỰ ÁN:
${description}`;
}
