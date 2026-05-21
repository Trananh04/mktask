import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useOrganization } from "@/contexts/organization-context";
import { useAuth } from "@/contexts/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import { OrganizationRole } from "@/types";
import { LoginContent } from "@/components/login/LoginContent";
import { questions, QuestionType } from "@/utils/data/newUserQuestions";
import { invitationApi } from "@/utils/api/invitationsApi";
import ActionButton from "@/components/common/ActionButton";
import { SEO } from "@/components/common/SEO";
import { InvitationModal } from "@/components/notifications/InvitationModal";
import { ModeToggle } from "@/components/header/ModeToggle";
import api from "@/lib/api";

const extendedQuestions: QuestionType[] = [
  ...questions,
  {
    id: "organizationName",
    question: "Tên tổ chức của bạn là gì?",
    description: "Đây sẽ là tên tổ chức đầu tiên của bạn.",
    inputLabel: "Tên tổ chức",
    placeholder: "Nhập tên tổ chức",
    type: "input" as const,
  },
];

function IntroQuestions({ onComplete }: { onComplete: () => void }) {
  const { getCurrentUser, updateUser } = useAuth();
  const { createOrganization } = useOrganization();
  const router = useRouter();
  const currentUser = getCurrentUser();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    if (currentUser && currentUser?.onboardInfo) {
      setAnswers(currentUser?.onboardInfo);
    }
  }, [currentUser.id]);

  const currentQuestionData = extendedQuestions[currentQuestion];
  const totalQuestions = extendedQuestions.length;
  const isLastQuestion = currentQuestion === totalQuestions - 1;

  const handleOptionSelect = (optionValue) => {
    setAnswers({
      ...answers,
      [currentQuestionData.id]: optionValue,
    });
  };

  const handleInputChange = (value: string) => {
    setAnswers({
      ...answers,
      [currentQuestionData.id]: value,
    });
  };

  const handleNext = async () => {
    if (isLastQuestion) {
      setIsSubmitting(true);
      try {
        await Promise.all([
          updateUser(currentUser.id, {
            onboardInfo: answers,
          }),
          createOrganizationAndHandleRedirect(),
        ]);

        toast.success("Đã tạo hồ sơ và tổ chức thành công!");
        router.reload();
        onComplete();
      } catch (error: any) {
        console.error("Error:", error);
        toast.error(error?.message || "Không thể hoàn tất thiết lập. Vui lòng thử lại.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const createOrganizationAndHandleRedirect = async () => {
    const orgName = answers["organizationName"];

    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

    try {
      const result = await createOrganization({
        name: orgName.trim(),
        slug,
        description: "Tổ chức được tạo trong quá trình thiết lập ban đầu",
        settings: {
          allowInvites: true,
          requireEmailVerification: false,
          defaultRole: OrganizationRole.MEMBER,
          features: {
            timeTracking: false,
            customFields: false,
            automation: false,
            integrations: false,
          },
        },
        // Pass workspace and project data if provided
        ...(workspaceName.trim() && {
          defaultWorkspace: {
            name: workspaceName.trim(),
          },
        }),
        ...(projectName.trim() && {
          defaultProject: {
            name: projectName.trim(),
          },
        }),
      });
      return result;
    } catch (error: any) {
      throw new Error(error?.message || "Không thể tạo tổ chức");
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const isAnswerSelected =
    answers[currentQuestionData.id] !== undefined && answers[currentQuestionData.id] !== "";

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SEO title="Thiết lập tổ chức" />
      <div className="login-container">
        <div className="login-content-panel hidden md:block">
          <LoginContent />
        </div>
        <div className="login-form-mode-toggle">
          <ModeToggle />
        </div>
        {/* Question and Options */}
        <div className="w-full lg:w-1/2 px-6 py-12 overflow-y-auto">
          <div className="w-full bg-[var(--background)] pb-4 flex justify-end items-end">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Câu hỏi {currentQuestion + 1}/{totalQuestions}
            </span>
          </div>
          <div className="px-[10%] space-y-8">
            <div className="space-y-4">
              <h1 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-[var(--foreground)] leading-tight">
                {currentQuestionData.question}
              </h1>
              <p className="text-[var(--foreground)] text-sm">
                {currentQuestionData.type === "input"
                  ? currentQuestionData.description
                  : "Vui lòng chọn một tùy chọn phù hợp nhất với bạn."}
              </p>
            </div>

            {/* Options or Input based on question type */}
            {currentQuestionData.type === "input" ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-sm font-medium">{currentQuestionData.inputLabel}</Label>
                  <Input
                    type="text"
                    value={answers[currentQuestionData.id] || ""}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={currentQuestionData.placeholder}
                    className="border-[var(--border)] bg-[var(--background)] p-4 text-lg"
                    autoFocus
                    required
                  />
                </div>

                {/* Workspace and Project Section - Only show on organization name question */}
                {currentQuestionData.id === "organizationName" && (
                  <div className="mt-6 pt-6 border-t border-[var(--border)] space-y-6">
                    <div className="space-y-4">
                      <Label className="text-sm font-medium text-[var(--foreground)]">
                        Tên không gian làm việc
                      </Label>
                      <Input
                        type="text"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        placeholder="VD: Không gian chính"
                        className="border-[var(--border)] bg-[var(--background)] p-4 text-lg"
                      />
                    </div>

                    <div className="space-y-4">
                      <Label className="text-sm font-medium text-[var(--foreground)]">
                        Tên dự án
                      </Label>
                      <Input
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="VD: Dự án đầu tiên"
                        className="border-[var(--border)] bg-[var(--background)] p-4 text-lg"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentQuestionData.options.map((option) => {
                  const isSelected = answers[currentQuestionData.id] === option.value;
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleOptionSelect(option.value)}
                      className={`p-2 pl-4 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-gray-600 bg-[var(--background)] shadow-lg"
                          : "border-gray-800 bg-[var(--background)] hover:border-gray-600 hover:shadow-md"
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
            )}

            <div className="flex justify-between pt-8">
              <button
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
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
                disabled={!isAnswerSelected || isSubmitting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  !isAnswerSelected || isSubmitting
                    ? "bg-[var(--primary)]/70 text-[var(--primary-foreground)] cursor-not-allowed"
                    : "bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] hover:shadow-lg cursor-pointer"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white"></div>
                    Đang thiết lập...
                  </>
                ) : isLastQuestion ? (
                  "Hoàn tất thiết lập"
                ) : (
                  "Tiếp"
                )}
                {!isLastQuestion && <ChevronRight className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateOrganizationPage() {
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [hasPendingInvites, setHasPendingInvites] = useState(false);
  const [orgCreationBlocked, setOrgCreationBlocked] = useState(false);
  const { getCurrentUser } = useAuth();
  const currentUser = getCurrentUser();

  useEffect(() => {
    // Check if org creation is allowed
    api.get("/auth/registration-status")
      .then((res) => {
        if (res.data?.allowOrgCreation === false && !res.data?.hasDefaultOrganization) {
          setOrgCreationBlocked(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (currentUser) {
      checkPendingInvitations();
    }
  }, [currentUser]);

  const checkPendingInvitations = async () => {
    if (!currentUser?.id) return;

    try {
      const invitations = await invitationApi.getUserInvitations({
        status: "PENDING",
      });
      setHasPendingInvites(invitations.length > 0);
      setShowInvitationModal(invitations.length > 0);
    } catch (error) {
      console.error("Failed to fetch invitations:", error);
    }
  };

  const handleQuestionComplete = () => {
    if (hasPendingInvites) {
      setShowInvitationModal(true);
    }
  };

  const handleInvitationsProcessed = () => {
    setShowInvitationModal(false);
  };

  if (orgCreationBlocked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <div className="max-w-md text-center space-y-4 p-8">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            Tạo tổ chức đang bị tắt
          </h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Quản trị viên đang giới hạn việc tạo tổ chức.
            Vui lòng liên hệ quản trị viên để được gán vào một tổ chức.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <IntroQuestions onComplete={handleQuestionComplete} />
      {currentUser && (
        <InvitationModal
          userId={currentUser.id}
          isOpen={showInvitationModal}
          onAccept={handleInvitationsProcessed}
        />
      )}
    </>
  );
}
