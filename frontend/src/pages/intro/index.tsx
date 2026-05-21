import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { SEO } from "@/components/common/SEO";

const QuizPage = () => {
  const { getCurrentUser, updateUser } = useAuth();
  const router = useRouter();
  const currentUser = getCurrentUser();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});

  const questions = [
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
      id: 3,
      question: "Đội nhóm của bạn có bao nhiêu người?",
      options: [
        { id: 1, text: "Chỉ mình tôi", value: "onlyMe" },
        { id: 2, text: "2-5", value: "2-5" },
        { id: 3, text: "6-10", value: "6-10" },
        { id: 4, text: "11-15", value: "11-15" },
        { id: 5, text: "16-25", value: "16-25" },
        { id: 6, text: "26-50", value: "26-50" },
        { id: 7, text: "51-100", value: "51-100" },
        { id: 8, text: "101-500", value: "101-500" },
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

  useEffect(() => {
    if (currentUser && currentUser?.onboardInfo) {
      setAnswers(currentUser.onboardInfo);
    }
  }, [currentUser.id]);

  const currentQuestionData = questions[currentQuestion];
  const totalQuestions = questions.length;

  const handleOptionSelect = (optionValue) => {
    setAnswers({
      ...answers,
      [currentQuestionData.id]: optionValue,
    });
  };

  const handleNext = async () => {
    if (currentQuestion === totalQuestions - 1) {
      try {
        await updateUser(currentUser.id, {
          onboardInfo: answers,
        });
        toast.success("Đã cập nhật tùy chọn thành công!");
        router.push("/organization");
      } catch {
        toast.error("Không thể cập nhật hồ sơ. Vui lòng thử lại.");
      }
    }

    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const isAnswerSelected = answers[currentQuestionData.id] !== undefined;

  return (
    <div className="h-screen bg-[var(--background)] flex flex-col">
      <SEO title="Chào mừng đến với mktask" />
      <div className="flex-1 flex">
        {/* Image section */}
        <div className="hidden lg:block w-1/2 bg-[var(--primary)] p-8">
          <div className="h-full flex items-center justify-center">
            {currentQuestionData.svg || (
              <div className="text-center text-[var(--primary-foreground)]">mktask</div>
            )}
          </div>
        </div>

        {/* Question and Options */}
        <div className="w-full lg:w-1/2 px-6 py-12 overflow-y-auto">
          {/* Progress Bar */}
          <div className="w-full bg-[var(--background)] pb-4 shadow-sm">
            <div className="max-w-6xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  Câu hỏi {currentQuestion + 1}/{totalQuestions}
                </span>
                <span className="text-sm font-medium text-[var(--foreground)]">
                  Hoàn thành {Math.round(((currentQuestion + 1) / totalQuestions) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${((currentQuestion + 1) / totalQuestions) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
          <div className="max-w-md mx-auto space-y-8">
            <div className="space-y-4">
              <h1 className="text-3xl lg:text-4xl font-bold text-[var(--foreground)] leading-tight">
                {currentQuestionData.question}
              </h1>
              <p className="text-[var(--foreground)]">
                Vui lòng chọn một tùy chọn phù hợp nhất với bạn.
              </p>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentQuestionData.options.map((option) => {
                const isSelected = answers[currentQuestionData.id] === option.value;
                return (
                  <button
                    key={option.id}
                    onClick={() => handleOptionSelect(option.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer hover:scale-[1.02] ${
                      isSelected
                        ? "border-blue-600 bg-[var(--background)] shadow-lg"
                        : "border-gray-800 bg-[var(--background)] hover:border-blue-600 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-lg">{option.text}</span>
                      {isSelected && (
                        <CheckCircle className="h-6 w-6 text-blue-500 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between pt-8">
              <button
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  currentQuestion === 0
                    ? "bg-[var(--primary)]/70 text-[var(--primary-foreground)] cursor-not-allowed"
                    : "bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] hover:shadow-md cursor-pointer"
                }`}
              >
                <ChevronLeft className="h-5 w-5" />
                Trước
              </button>

              <button
                onClick={handleNext}
                disabled={!isAnswerSelected}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  !isAnswerSelected
                    ? "bg-[var(--primary)]/70 text-[var(--primary-foreground)] cursor-not-allowed"
                    : "bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] hover:shadow-lg cursor-pointer"
                }`}
              >
                {currentQuestion === totalQuestions - 1 ? "Hoàn tất" : "Tiếp"}
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizPage;
