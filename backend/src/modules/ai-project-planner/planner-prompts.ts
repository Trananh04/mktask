export function buildPlannerPrompt(
  description: string,
  members: Array<Record<string, unknown>>,
): string {
  return `Hãy phân rã mô tả dự án sau thành kế hoạch triển khai.

Yêu cầu đầu ra JSON:
{
  "summary": "Tóm tắt ngắn bằng tiếng Việt",
  "projects": [
    {
      "id": "project-1",
      "name": "Tên project",
      "description": "Mục tiêu project",
      "tasks": [
        {
          "id": "task-1",
          "title": "Tên task",
          "description": "Mô tả task ngắn",
          "requiredSkills": ["frontend", "react"],
          "estimateHours": 4,
          "storyPoints": 2,
          "priority": "MEDIUM"
        }
      ]
    }
  ],
  "warnings": []
}

Quy tắc:
- Chỉ trả JSON hợp lệ.
- Dùng tiếng Việt cho summary, name, title, description, warnings.
- Nếu người dùng yêu cầu một dự án hoặc cung cấp một tên dự án cụ thể, chỉ tạo đúng 1 project với tên đó.
- Chỉ tạo nhiều project khi người dùng nói rõ cần nhiều dự án; mỗi project từ 5 đến 12 task.
- requiredSkills dùng keyword ngắn không dấu nếu phù hợp: frontend, backend, design, qa, devops, database, marketing, content, sales.
- priority chỉ dùng LOWEST, LOW, MEDIUM, HIGH hoặc HIGHEST.
- Không tự bịa assigneeId. Việc phân công sẽ do hệ thống mktask xử lý sau.

Thành viên hiện có để tham khảo kỹ năng:
${JSON.stringify(members, null, 2)}

Mô tả dự án:
${description}`;
}
