export const questions = [
  {
    id: 1,
    question: "Hôm nay bạn dùng mktask cho mục đích gì?",
    options: [
      { id: 1, text: "Công việc", value: "work" },
      { id: 2, text: "Cá nhân", value: "personal" },
      { id: 3, text: "Học tập", value: "school" },
      { id: 4, text: "Tổ chức phi lợi nhuận", value: "nonprofits" },
    ],
    svg: "",
  },
  {
    id: 2,
    question: "Vai trò hiện tại của bạn là gì?",
    options: [
      { id: 1, text: "Chủ doanh nghiệp", value: "businessOwner" },
      { id: 2, text: "Trưởng nhóm", value: "teamLeader" },
      { id: 3, text: "Thành viên nhóm", value: "teamMember" },
      { id: 4, text: "Freelancer", value: "freelancer" },
      { id: 5, text: "Giám đốc", value: "director" },
      { id: 6, text: "Lãnh đạo cấp cao", value: "cLevel" },
      { id: 7, text: "VP", value: "vp" },
    ],
    svg: "",
  },
  {
    id: 4,
    question: "Công ty của bạn có bao nhiêu người?",
    options: [
      { id: 1, text: "1-19", value: "1-19" },
      { id: 2, text: "20-49", value: "20-49" },
      { id: 3, text: "50-99", value: "50-99" },
      { id: 4, text: "100-250", value: "100-250" },
      { id: 5, text: "251-500", value: "251-500" },
      { id: 6, text: "501-1500", value: "501-1500" },
      { id: 7, text: "1500+", value: "1500+" },
    ],
    svg: "",
  },
  {
    id: 5,
    question: "Câu cuối: bạn muốn quản lý nội dung nào trước?",
    options: [
      { id: 1, text: "Giáo dục", value: "education" },
      { id: 2, text: "Bán hàng và CRM", value: "salesAndCRM" },
      { id: 3, text: "Thiết kế và sáng tạo", value: "designAndCreative" },
      { id: 4, text: "Quản lý sản phẩm", value: "productManagement" },
      { id: 5, text: "IT", value: "it" },
      { id: 6, text: "Nhân sự và tuyển dụng", value: "hrAndRecruiting" },
      { id: 7, text: "Phát triển phần mềm", value: "softwareDevelopment" },
      { id: 8, text: "Pháp lý", value: "legal" },
      { id: 9, text: "Xây dựng", value: "construction" },
      { id: 14, text: "Marketing", value: "marketing" },
      { id: 15, text: "Khác", value: "other" },
    ],
    svg: "",
  },
];

interface BaseQuestion {
  id: string | number;
  question: string;
}

interface OptionQuestion extends BaseQuestion {
  options: { id: number; text: string; value: string }[];
  svg?: string;
  type?: "option";
}

interface InputQuestion extends BaseQuestion {
  description: string;
  inputLabel: string;
  placeholder: string;
  type: "input";
}

export type QuestionType = OptionQuestion | InputQuestion;
