import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { formatDateTimeForDisplay } from "@/utils/date";
import { isValidSlug } from "@/utils/slugUtils";
import {
  HiXMark,
  HiPaperAirplane,
  HiSparkles,
  HiArrowPath,
  HiStop,
  HiMicrophone,
  HiClock,
} from "react-icons/hi2";
import { useChatContext } from "@/contexts/chat-context";
import { mcpServer, extractContextFromPath } from "@/lib/mcp-server";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { BrowserAgent } from "@/lib/browser-automation/browser-agent";
import { VoiceController } from "@/lib/voice";
import { aiProjectPlannerApi, ProjectPlan } from "@/utils/api/aiProjectPlannerApi";
import { workspaceApi } from "@/utils/api/workspaceApi";
import { projectApi } from "@/utils/api/projectApi";
import { taskApi } from "@/utils/api/taskApi";

type BulkTaskDraft = {
  tasks: Array<{ title: string; description?: string }>;
  awaitingProjectPath: boolean;
};

type AutoProjectDraft = {
  description: string;
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  plannerPlan?: ProjectPlan;
  plannerWorkspaceId?: string;
  plannerApplied?: boolean;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const CHAT_MESSAGES_STORAGE_KEY = "mktask_ai_chat_messages_v1";
const CHAT_PANEL_WIDTH_STORAGE_KEY = "mktask_ai_chat_panel_width";
const CHAT_PANEL_DEFAULT_WIDTH = 420;
const CHAT_PANEL_MIN_WIDTH = 360;
const CHAT_PANEL_MAX_WIDTH = 720;

function clampPanelWidth(width: number): number {
  return Math.min(Math.max(width, CHAT_PANEL_MIN_WIDTH), CHAT_PANEL_MAX_WIDTH);
}

function sanitizeErrorMessage(msg: string): string {
  const l = msg.toLowerCase();
  if (l.includes("rate limit") || l.includes("429") || l.includes("too many requests"))
    return "Rate limit reached. Please wait a moment and try again.";
  if (l.includes("context_length") || l.includes("context length") || l.includes("maximum context") || l.includes("too long"))
    return "Conversation too long. Please clear the chat and try again.";
  if (l.includes("element") && l.includes("not found"))
    return "I had trouble interacting with the page. Please try again.";
  if (l.includes("network") || l.includes("failed to fetch") || l.includes("econnrefused"))
    return "Network error. Please check your connection.";
  return msg.replace(/^Error:\s*/i, "").replace(/^LLM API error:\s*/i, "");
}

function isProjectPlannerRequest(message: string): boolean {
  const normalized = normalizeVietnamese(message);
  const hasPlanningIntent =
    normalized.includes("lap ke hoach") ||
    normalized.includes("len ke hoach") ||
    normalized.includes("tao ke hoach") ||
    normalized.includes("chia task") ||
    normalized.includes("chia viec") ||
    normalized.includes("phan chia cong viec");
  const hasProjectContext =
    normalized.includes("du an") ||
    normalized.includes("project") ||
    normalized.includes("task") ||
    normalized.includes("cong viec") ||
    normalized.includes("website") ||
    normalized.includes("web ") ||
    normalized.includes("app ") ||
    normalized.includes("he thong");
  return hasPlanningIntent && hasProjectContext;
}

function normalizeVietnamese(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .trim();
}

function isAutoProjectCreateRequest(message: string): boolean {
  const normalized = normalizeVietnamese(message);
  const wantsProject =
    normalized.includes("tao du an") ||
    /tao\s+.+\s+du an/.test(normalized) ||
    normalized.includes("tao project") ||
    /create\s+.+\s+project/.test(normalized) ||
    normalized.includes("create project");
  const wantsTasks =
    normalized.includes("cong viec") ||
    normalized.includes("cac viec") ||
    normalized.includes("viec can lam") ||
    normalized.includes("task") ||
    normalized.includes("tasks");

  return wantsProject && wantsTasks;
}

function isProjectModalRequest(message: string): boolean {
  const normalized = normalizeVietnamese(message);
  const wantsProject =
    /(tao|them|create|new).*(du an|project)/.test(normalized) ||
    /(du an|project).*(moi|new)/.test(normalized);
  const wantsTaskPlan =
    normalized.includes("task") ||
    normalized.includes("cong viec") ||
    normalized.includes("viec can lam") ||
    normalized.includes("lap ke hoach") ||
    normalized.includes("len ke hoach") ||
    normalized.includes("chia task") ||
    normalized.includes("chia viec");

  return wantsProject && !wantsTaskPlan;
}

function extractRequestedProjectName(message: string): string | null {
  const explicitNamePatterns = [
    /(?:tên|ten)\s+(?:dự án|du an|project)\s*(?:là|la|:)\s*["“”']?([^"“”'\n,.]+)/iu,
    /(?:dự án|du an|project)\s*["“”']([^"“”'\n]+)["“”']/iu,
    /(?:tạo|tao|create)\s+(?:dự án|du an|project)\s+([^"“”'\n,.]{2,60}?)\s+(?:để|de|làm|lam|cho|về|ve|:)/iu,
  ];

  for (const pattern of explicitNamePatterns) {
    const match = message.match(pattern);
    const name = match?.[1]?.trim().replace(/\s+/g, " ");
    if (name && !/^l(à|a|àm|am)$/i.test(name)) return name;
  }

  return null;
}

function buildAutoProjectDescription(projectName: string, description: string): string {
  return [
    `Tên dự án: ${projectName.trim()}`,
    `Mô tả yêu cầu: ${description.trim()}`,
    "Yêu cầu: Tạo đúng 1 dự án với tên trên và các công việc cần làm. Giữ nguyên chính tả tên dự án.",
  ].join("\n");
}

function getPlannerErrorMessage(error: any): string {
  return sanitizeErrorMessage(
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Không lập được kế hoạch dự án."
  );
}

function parseSuggestedTasks(text: string): Array<{ title: string; description?: string }> {
  const tasks: Array<{ title: string; description?: string }> = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const normalized = line.replace(/\*\*/g, "").trim();
    const match =
      normalized.match(/^(?:[-*\u2022]\s+|\[[ xX]\]\s+)(.+)$/) ||
      normalized.match(/^\d+[\).:-]?\s+(.+)$/) ||
      normalized.match(/^(?:task|todo|viec|cong viec)\s*\d*[:.-]\s*(.+)$/i);
    if (!match) continue;

    const title = match[1]
      .replace(/\s+/g, " ")
      .replace(/^task\s*[:.-]\s*/i, "")
      .replace(/^(?:nen|can|hay)\s+/i, "")
      .trim();
    const looksLikeInstruction =
      /^(toi|ban|hay|vui long|duoi day|neu|sau day)\b/i.test(title) ||
      /[:：]$/.test(title);

    if (title.length >= 3 && !looksLikeInstruction) {
      tasks.push({ title: title.slice(0, 240) });
    }
  }

  const seen = new Set<string>();
  return tasks.filter((task) => {
    const key = normalizeVietnamese(task.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isBulkTaskCreateRequest(message: string) {
  const normalized = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    normalized.includes("tao task") ||
    normalized.includes("tao cac task") ||
    normalized.includes("tao nhieu task") ||
    normalized.includes("create tasks") ||
    normalized.includes("create these tasks")
  );
}

function isAssistantGuidanceRequest(message: string) {
  const normalized = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const guidancePhrases = [
    "huong dan",
    "cach dung",
    "cach su dung",
    "lam sao",
    "lam the nao",
    "giup toi su dung",
    "ban lam duoc gi",
    "tro ly ai",
    "toi nen",
    "nen bat dau",
    "quy trinh",
    "tinh nang",
    "how do i",
    "how to",
    "guide me",
    "help me use",
    "where should i start",
    "workflow",
    "feature",
    "what can you do",
  ];

  return guidancePhrases.some((phrase) => normalized.includes(phrase));
}

function extractProjectRoute(message: string) {
  const match = message.match(/\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)(?:\/tasks)?(?:\s|$)/);
  if (!match) return null;
  return {
    workspaceSlug: match[1],
    projectSlug: match[2],
  };
}

export default function ChatPanel() {
  const { isChatOpen, toggleChat } = useChatContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isContextManuallyCleared, setIsContextManuallyCleared] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasLoadedChatHistoryRef = useRef(false);
  const pathname = usePathname();
  const router = useRouter();
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(null);
  const { getCurrentUser } = useAuth();
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === "undefined") return CHAT_PANEL_DEFAULT_WIDTH;
    const storedWidth = Number(localStorage.getItem(CHAT_PANEL_WIDTH_STORAGE_KEY));
    return Number.isFinite(storedWidth)
      ? clampPanelWidth(storedWidth)
      : CHAT_PANEL_DEFAULT_WIDTH;
  });
  const [showHistory, setShowHistory] = useState(false);
  const [bulkTaskDraft, setBulkTaskDraft] = useState<BulkTaskDraft | null>(null);
  const [autoProjectDraft, setAutoProjectDraft] = useState<AutoProjectDraft | null>(null);
  const resizing = useRef(false);

  // Browser automation state
  const [isBrowserAgentRunning, setIsBrowserAgentRunning] = useState(false);
  const browserAgentRef = useRef<BrowserAgent | null>(null);

  // Voice input state
  const voiceControllerRef = useRef<VoiceController | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Agent status display
  const thinkingWords = useRef([
    "Thinking", "Pondering", "Analyzing", "Processing",
    "Examining", "Figuring out", "Working on it", "Looking into it",
    "On it", "Brewing ideas", "Cooking up a plan", "Strategizing", "Contemplating", "Deliberating",
  ]);
  const lastStartIndex = useRef(0);
  const [agentStatus, setAgentStatus] = useState("");
  const thinkingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const thinkingDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAgentStatus = useCallback((status: string) => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
    if (thinkingDelayRef.current) {
      clearTimeout(thinkingDelayRef.current);
      thinkingDelayRef.current = null;
    }
    if (status === "thinking") {
      setAgentStatus("");
      thinkingDelayRef.current = setTimeout(() => {
        const words = thinkingWords.current;
        let index = lastStartIndex.current;
        lastStartIndex.current = (lastStartIndex.current + 1) % words.length;
        setAgentStatus(words[index]);
        thinkingIntervalRef.current = setInterval(() => {
          index = (index + 1) % words.length;
          setAgentStatus(words[index]);
        }, 60000);
      }, 10000);
    } else {
      setAgentStatus(status);
    }
  }, []);

  const stopPanelResize = useCallback(() => {
    if (!resizing.current) return;

    resizing.current = false;
    document.body.classList.remove("select-none", "cursor-col-resize");
  }, []);

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    e.preventDefault();
    resizing.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    document.body.classList.add("select-none", "cursor-col-resize");
  };

  const handleResizeMove = useCallback((e: PointerEvent) => {
    if (!resizing.current) return;

    const viewportMax = Math.max(CHAT_PANEL_MIN_WIDTH, window.innerWidth - 64);
    const newWidth = Math.min(
      clampPanelWidth(window.innerWidth - e.clientX),
      Math.min(CHAT_PANEL_MAX_WIDTH, viewportMax)
    );
    setPanelWidth(newWidth);
    localStorage.setItem(CHAT_PANEL_WIDTH_STORAGE_KEY, String(newWidth));
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handleResizeMove);
    window.addEventListener("pointerup", stopPanelResize);
    window.addEventListener("blur", stopPanelResize);
    return () => {
      window.removeEventListener("pointermove", handleResizeMove);
      window.removeEventListener("pointerup", stopPanelResize);
      window.removeEventListener("blur", stopPanelResize);
    };
  }, [handleResizeMove, stopPanelResize]);

  useEffect(() => {
    document.documentElement.style.setProperty("--chat-panel-width", `${panelWidth}px`);
  }, [panelWidth]);

  // Initialize browser agent and clear stale history on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!browserAgentRef.current) {
        browserAgentRef.current = new BrowserAgent({
          maxIterations: 30,
          waitAfterAction: 500,
        });
      } else {
        browserAgentRef.current.reset();
      }
      // Initialize voice controller
      voiceControllerRef.current = new VoiceController({
        callbacks: {
          onStateChange: (state) => {
            setIsListening(state.isListening);
            setInterimTranscript(state.interimTranscript);
            setVoiceError(state.error);
          },
          onTranscriptReady: (fullTranscript) => {
            // Auto-send the transcribed message directly
            if (fullTranscript.trim()) {
              handleVoiceMessage(fullTranscript.trim());
            }
          },
          onError: (error) => {
            console.warn("Voice recognition error:", error);
            setIsListening(false);
          },
        },
        // 400ms delay after stopping to let API finalize word corrections
        finalizationDelay: 400,
        // Auto-stop after 2.5 seconds of silence
        silenceTimeout: 2500,
      });
    }

    // Cleanup on unmount
    return () => {
      voiceControllerRef.current?.destroy();
    };
  }, []);

  // Abort voice input on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isListening) {
        e.preventDefault();
        voiceControllerRef.current?.abort();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isListening]);

  // Abort voice input when clicking outside the chat panel
  useEffect(() => {
    if (!isListening) return;

    const handleClickOutside = (e: MouseEvent) => {
      const chatPanel = document.getElementById("chat-panel");
      if (chatPanel && !chatPanel.contains(e.target as Node)) {
        voiceControllerRef.current?.abort();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isListening]);

  // Auto-resize textarea function
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = "auto";

      // Calculate new height based on content
      const newHeight = Math.min(textarea.scrollHeight, 120); // Max height of 120px
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  // Handle input change with auto-resize
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
      // Adjust height after state update
      setTimeout(adjustTextareaHeight, 0);
    },
    [adjustTextareaHeight]
  );

  // Load messages from session storage (improved logic)
  const loadMessagesFromHistory = useCallback(() => {
    try {
      // Only load if we don't have any messages yet
      if (messages.length > 0) {
        hasLoadedChatHistoryRef.current = true;
        return false;
      }

      const storedMessages = localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY);
      if (storedMessages) {
        const parsedMessages: Message[] = JSON.parse(storedMessages).map((message: Message) => ({
          ...message,
          timestamp: new Date(message.timestamp),
          isStreaming: false,
        }));

        if (parsedMessages.length > 0) {
          setMessages(parsedMessages);
          hasLoadedChatHistoryRef.current = true;
          return true;
        }
      }

      const storedHistory = sessionStorage.getItem("mcp_conversation_history");
      if (storedHistory) {
        const chatHistory: ChatMessage[] = JSON.parse(storedHistory);

        // Only load if we have substantial history (more than just a greeting)
        if (chatHistory.length > 2) {
          const convertedMessages: Message[] = chatHistory.map((msg, index) => ({
            role: msg.role === "system" ? "assistant" : msg.role,
            content: msg.content,
            timestamp: new Date(Date.now() - (chatHistory.length - index) * 1000),
            isStreaming: false,
          }));

          setMessages(convertedMessages);
          hasLoadedChatHistoryRef.current = true;
          return true;
        }
      }
    } catch (error) {
      console.warn("Failed to load messages from session storage:", error);
    }
    hasLoadedChatHistoryRef.current = true;
    return false;
  }, [messages.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasLoadedChatHistoryRef.current) return;

    if (messages.length === 0) {
      localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY);
      return;
    }

    localStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Initialize services on mount
  useEffect(() => {
    // Get current user
    const currentUser = getCurrentUser();
    const token = localStorage.getItem("access_token");
    const currentOrgId = localStorage.getItem("currentOrganizationId");

    setUser(currentUser);
    setCurrentOrganizationId(currentOrgId);

    if (token && currentUser) {
      // Initialize MCP server with context
      const pathContext = extractContextFromPath(pathname);

      mcpServer.initialize({
        currentUser: {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.email,
        },
        ...pathContext,
      });

      // Load existing conversation history
      loadMessagesFromHistory();
    }
  }, [pathname, getCurrentUser, loadMessagesFromHistory]);

  // Update context when path changes (unless manually cleared)
  useEffect(() => {
    if (user && !isContextManuallyCleared) {
      const pathContext = extractContextFromPath(pathname);
      mcpServer.updateContext(pathContext);
    }
  }, [pathname, user, isContextManuallyCleared]);

  if (
    currentOrganizationId !== null &&
    currentOrganizationId !== localStorage.getItem("currentOrganizationId") &&
    messages.length > 2
  ) {
    const newOrgId = localStorage.getItem("currentOrganizationId");
    setCurrentOrganizationId(newOrgId);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "⚠️ Tổ chức changed. My previous responses may no longer apply to the correct workspace or projects.",
        timestamp: new Date(),
      },
    ]);
  }
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Chat history: include all user messages with timestamps for grouping
  const chatHistoryItems = useMemo(
    () => messages
      .map((message, idx) => ({ ...message, originalIndex: idx }))
      .filter((message) => message.role === "user")
      .slice(-15)
      .reverse(),
    [messages]
  );

  // Helper: get relative date label
  const getDateLabel = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Hôm nay';
    if (days === 1) return 'Hôm qua';
    if (days < 7) return `${days} ngày trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Listen for workspace/project creation events
  useEffect(() => {
    const handleWorkspaceCreated = (event: CustomEvent) => {
      const { workspaceSlug, workspaceName } = event.detail;

      // Navigate to the new workspace
      if (isValidSlug(workspaceSlug)) {
        router.push(`/${workspaceSlug}`);
      }

      // Add a system message indicating navigation
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `✅ Navigated to workspace: ${workspaceName}`,
          timestamp: new Date(),
        },
      ]);
    };

    const handleProjectCreated = (event: CustomEvent) => {
      const { workspaceSlug, projectSlug, projectName } = event.detail;

      // Navigate to the new project
      if (isValidSlug(workspaceSlug) && isValidSlug(projectSlug)) {
        router.push(`/${workspaceSlug}/${projectSlug}`);
      }

      // Add a system message indicating navigation
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `✅ Navigated to project: ${projectName}`,
          timestamp: new Date(),
        },
      ]);
    };
    // Add event listeners
    if (typeof window !== "undefined") {
      window.addEventListener("aiWorkspaceCreated", handleWorkspaceCreated as EventListener);
      window.addEventListener("aiProjectCreated", handleProjectCreated as EventListener);

      return () => {
        window.removeEventListener("aiWorkspaceCreated", handleWorkspaceCreated as EventListener);
        window.removeEventListener("aiProjectCreated", handleProjectCreated as EventListener);
      };
    }
  }, [router]);

  // Handle browser automation
  const handleBrowserAutomation = async (message: string) => {
    if (!browserAgentRef.current) return;

    setIsBrowserAgentRunning(true);

    try {
      const result = await browserAgentRef.current.executeTask(message, undefined, handleAgentStatus);

      let cleanMessage = result.message || "";
      if (cleanMessage.startsWith("DONE:")) {
        cleanMessage = cleanMessage.substring(5).trim() || "Done!";
      } else if (cleanMessage.startsWith("ASK:")) {
        cleanMessage = cleanMessage.substring(4).trim();
      } else if (cleanMessage.startsWith("Error: LLM API error: ")) {
        cleanMessage = cleanMessage.replace("Error: LLM API error: ", "").trim();
      } else if (cleanMessage.startsWith("Error: ")) {
        cleanMessage = cleanMessage.substring(7).trim();
      } else if (cleanMessage.startsWith("Action failed: ")) {
        cleanMessage = cleanMessage.substring(15).trim();
      }
      cleanMessage = sanitizeErrorMessage(cleanMessage);

      const resultMessage: Message = {
        role: "assistant",
        content: cleanMessage,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, resultMessage]);
    } catch (error: any) {
      const rawMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Failed to process request";
      const errorMessage: Message = {
        role: "assistant",
        content: sanitizeErrorMessage(rawMessage),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
        thinkingIntervalRef.current = null;
      }
      if (thinkingDelayRef.current) {
        clearTimeout(thinkingDelayRef.current);
        thinkingDelayRef.current = null;
      }
      setAgentStatus("");
      setIsBrowserAgentRunning(false);
    }
  };

  const resolvePlannerWorkspaceId = async (): Promise<string> => {
    const storedWorkspaceId = localStorage.getItem("currentWorkspaceId");
    if (storedWorkspaceId) return storedWorkspaceId;

    const orgId = workspaceApi.getCurrentOrganization();
    const workspaces = orgId
      ? await workspaceApi.getWorkspacesByOrganization(orgId)
      : await workspaceApi.getWorkspaces();
    const workspace = workspaces[0];
    if (!workspace?.id) {
      throw new Error("Không tìm thấy workspace. Hãy tạo hoặc chọn workspace trước.");
    }
    return workspace.id;
  };

  const createProjectAndTasksFromAi = async (projectName: string, description: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const workspaceId = await resolvePlannerWorkspaceId();
      const plan = await aiProjectPlannerApi.plan(
        workspaceId,
        buildAutoProjectDescription(projectName, description)
      );
      const firstProject = plan.projects[0];
      if (!firstProject) {
        throw new Error("AI chưa tạo được danh sách công việc cho dự án này.");
      }

      const singleProjectPlan: ProjectPlan = {
        ...plan,
        projects: [
          {
            ...firstProject,
            name: projectName.trim(),
          },
        ],
      };

      const result = await aiProjectPlannerApi.apply(workspaceId, singleProjectPlan, false);
      setAutoProjectDraft(null);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Đã tạo dự án ${projectName.trim()} và ${result.createdTasks.length} công việc.`,
          timestamp: new Date(),
        },
      ]);
      if (result.warnings.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: result.warnings.join("\n"),
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: getPlannerErrorMessage(error),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoProjectCreateIntent = async (message: string) => {
    if (autoProjectDraft) {
      const projectName = message.trim();
      if (!projectName) return true;
      await createProjectAndTasksFromAi(projectName, autoProjectDraft.description);
      return true;
    }

    if (!isAutoProjectCreateRequest(message)) return false;

    const projectName = extractRequestedProjectName(message);
    if (projectName) {
      await createProjectAndTasksFromAi(projectName, message);
      return true;
    }

    setAutoProjectDraft({ description: message });
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "Bạn muốn đặt tên dự án là gì?",
        timestamp: new Date(),
      },
    ]);
    return true;
  };

  const handleProjectModalIntent = (message: string) => {
    if (!isProjectModalRequest(message)) return false;

    window.dispatchEvent(new CustomEvent("ai:open-new-project-modal"));
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "Đã mở cửa sổ tạo dự án mới.",
        timestamp: new Date(),
      },
    ]);
    return true;
  };

  const handleProjectPlanning = async (message: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const workspaceId = await resolvePlannerWorkspaceId();
      const plan = await aiProjectPlannerApi.plan(workspaceId, message);
      const taskCount = plan.projects.reduce((total, project) => total + project.tasks.length, 0);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Tôi đã lập bản nháp kế hoạch: ${plan.projects.length} dự án, ${taskCount} công việc. Kiểm tra bên dưới rồi bấm “Tạo dự án và công việc” nếu ổn.`,
          timestamp: new Date(),
          plannerPlan: plan,
          plannerWorkspaceId: workspaceId,
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: getPlannerErrorMessage(error),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyProjectPlan = async (messageIndex: number) => {
    const target = messages[messageIndex];
    if (!target?.plannerPlan || !target.plannerWorkspaceId || target.plannerApplied || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await aiProjectPlannerApi.apply(
        target.plannerWorkspaceId,
        target.plannerPlan,
        false
      );
      setMessages((prev) =>
        prev.map((message, index) =>
          index === messageIndex
            ? {
              ...message,
              plannerApplied: true,
              content: `${message.content}\n\nĐã tạo ${result.createdProjects.length} dự án và ${result.createdTasks.length} công việc.`,
            }
            : message
        )
      );
      if (result.warnings.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: result.warnings.join("\n"),
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: getPlannerErrorMessage(error),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const findLatestSuggestedTasks = () => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== "assistant") continue;
      const tasks = parseSuggestedTasks(message.content);
      if (tasks.length > 1) return tasks;
    }
    return [];
  };

  const getDefaultStatusId = async (projectId: string) => {
    const response = await taskApi.getTaskStatusByProject({ projectId });
    const statuses = response.data || [];
    const defaultStatus =
      statuses.find((status) => status.isDefault) ||
      statuses.find((status) => status.category === "TODO") ||
      statuses.find((status) => /todo|to do|backlog|open|chưa|mới/i.test(status.name)) ||
      statuses[0];

    if (!defaultStatus?.id) {
      throw new Error("Dự án này chưa có trạng thái task mặc định.");
    }
    return defaultStatus.id;
  };

  const createBulkTasksFromDraft = async (routeText: string) => {
    const route = extractProjectRoute(routeText);
    if (!route || !bulkTaskDraft?.tasks.length) return false;

    setIsLoading(true);
    setError(null);
    try {
      const project = await projectApi.getProjectBySlug(route.projectSlug, true, route.workspaceSlug);
      const statusId = await getDefaultStatusId(project.id);
      const result = await taskApi.bulkCreateTasks({
        projectId: project.id,
        statusId,
        tasks: bulkTaskDraft.tasks.map((task) => ({
          title: task.title,
          description: task.description,
          type: "TASK",
          priority: "MEDIUM",
        })),
      });

      setBulkTaskDraft(null);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Đã tạo ${result.created ?? bulkTaskDraft.tasks.length} task trong dự án ${project.name}.`,
          timestamp: new Date(),
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: sanitizeErrorMessage(
            error?.response?.data?.message ||
            error?.response?.data?.error ||
            error?.message ||
            "Không tạo được các task này."
          ),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }

    return true;
  };

  const handleBulkTaskCreateIntent = async (message: string) => {
    if (bulkTaskDraft?.awaitingProjectPath && extractProjectRoute(message)) {
      return createBulkTasksFromDraft(message);
    }

    if (!isBulkTaskCreateRequest(message)) return false;

    const tasks = bulkTaskDraft?.tasks.length ? bulkTaskDraft.tasks : findLatestSuggestedTasks();
    if (tasks.length <= 1) return false;

    setBulkTaskDraft({ tasks, awaitingProjectPath: true });
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `Mình đã nhận ${tasks.length} task. Bạn muốn tạo vào project nào? Gửi đường dẫn dạng /mekong/web-bn-sch/tasks hoặc /mekong/web-bn-sch.`,
        timestamp: new Date(),
      },
    ]);
    return true;
  };

  const handleAssistantGuidance = async (message: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await mcpServer.processMessage(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: sanitizeErrorMessage(response),
          timestamp: new Date(),
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: sanitizeErrorMessage(
            error?.response?.data?.message ||
            error?.response?.data?.error ||
            error?.message ||
            "I could not load the mktask guide right now."
          ),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const processUserMessage = async (message: string) => {
    if (handleProjectModalIntent(message)) {
      return;
    }
    if (await handleAutoProjectCreateIntent(message)) {
      return;
    }
    if (await handleBulkTaskCreateIntent(message)) {
      return;
    }
    if (isProjectPlannerRequest(message)) {
      await handleProjectPlanning(message);
      return;
    }
    if (isAssistantGuidanceRequest(message)) {
      await handleAssistantGuidance(message);
      return;
    }
    await handleBrowserAutomation(message);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || isBrowserAgentRunning) return;

    const userMessage: Message = {
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    await processUserMessage(userMessage.content);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Voice input handlers
  const handleToggleVoice = () => {
    if (!voiceControllerRef.current) return;

    if (isListening) {
      // Stop listening — onTranscriptReady will auto-send if there's text
      voiceControllerRef.current.stopListening();
    } else {
      // Xóa any previous errors and start listening
      setVoiceError(null);
      setInterimTranscript("");
      voiceControllerRef.current.startListening();
    }
  };

  /** Handle a voice message — adds it to chat and sends through the automation pipeline. */
  const handleVoiceMessage = async (message: string) => {
    if (!message.trim() || isLoading || isBrowserAgentRunning) return;

    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    await processUserMessage(message);
  };

  const handleStopAgent = () => {
    browserAgentRef.current?.stop();
  };

  const clearChat = () => {
    setMessages([]);
    setAutoProjectDraft(null);
    setBulkTaskDraft(null);
    localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY);
    sessionStorage.removeItem("mcp_conversation_history");
    mcpServer.clearHistory();
    browserAgentRef.current?.reset();
  };

  const clearContext = async () => {
    try {
      // Xóa the context both locally and on backend
      await mcpServer.clearContext();

      // Set flag to prevent automatic context extraction from URL
      setIsContextManuallyCleared(true);
      setAutoProjectDraft(null);
      setBulkTaskDraft(null);

      // Also clear the history to ensure clean context
      mcpServer.clearHistory();

      // Xóa the local messages but keep the context clear message
      setMessages([
        {
          role: "system",
          content:
            "🔄 Ngữ cảnh cleared. You are now in global mode - specify workspace and project for your next actions.",
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error("Failed to clear context:", error);
      setError("Failed to clear context. Please try again.");
    }
  };

  // Improved sync logic that only runs on mount/chat open, not during active messaging
  useEffect(() => {
    const syncWithMcpHistory = () => {
      try {
        // Skip sync if context was manually cleared or if user is actively messaging
        if (isContextManuallyCleared || isLoading) {
          return;
        }

        const mcpHistory = mcpServer.getHistory();

        // Only sync if we have significant history and no current streaming
        if (mcpHistory.length > 2 && !messages.some((m) => m.isStreaming)) {
          const currentHistoryLength = messages.filter(
            (m) => m.role !== "system" || !m.content.includes("Ngữ cảnh cleared")
          ).length;

          // Only sync if there's a meaningful difference (more than 1 message gap)
          if (Math.abs(mcpHistory.length - currentHistoryLength) > 1) {
            const syncedMessages: Message[] = mcpHistory.map((msg: ChatMessage, index: number) => ({
              role: msg.role === "system" ? "assistant" : msg.role,
              content: msg.content,
              timestamp:
                messages[index]?.timestamp ||
                new Date(Date.now() - (mcpHistory.length - index) * 1000),
              isStreaming: false,
            }));

            // Preserve system messages from manual context clearing
            const systemMessages = messages.filter(
              (m) => m.role === "system" && m.content.includes("Ngữ cảnh cleared")
            );
            setMessages([...systemMessages, ...syncedMessages]);
          }
        }
      } catch (error) {
        console.warn("Failed to sync with MCP history:", error);
      }
    };

    // Only sync on initial load when chat opens, not continuously
    if (isChatOpen && user && !isContextManuallyCleared && !isLoading) {
      const timeout = setTimeout(syncWithMcpHistory, 500); // Longer delay to avoid conflicts
      return () => clearTimeout(timeout);
    }
  }, [isChatOpen, user]); // Removed messages.length to prevent continuous triggering

  return (
    <>
      {/* Chat Panel - positioned below header */}
      <div
        id="chat-panel"
        className={`fixed top-0 right-0 bottom-0 bg-[var(--background)] border-l border-[var(--border)] z-40 transform transition-transform duration-300 ease-in-out flex flex-col ${isChatOpen ? "translate-x-0" : "translate-x-full"
          }`}
        style={{ width: `${panelWidth}px` }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize AI chat panel"
          onPointerDown={handleResizeStart}
          className="absolute left-0 top-0 bottom-0 z-50 w-3 -translate-x-1.5 cursor-col-resize touch-none bg-transparent hover:bg-blue-500/25"
        />
        {/* Chat Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--background)]">
          <div className="flex items-center gap-2">
            <HiSparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-primary">Trợ lý AI</h2>
          </div>
          <div className="flex items-center gap-1">
            {/* History Button */}
            {messages.length > 0 && (
              <button
                onClick={() => setShowHistory((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-all duration-200 ${
                  showHistory
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
                }`}
                title="Lịch sử chat"
              >
                <HiClock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lịch sử</span>
              </button>
            )}
            {/* Context Reset Button */}
            <button
              onClick={clearContext}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] rounded-md transition-all duration-200"
              title="Xóa ngữ cảnh trò chuyện hiện tại"
            >
              <HiArrowPath className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ngữ cảnh</span>
            </button>
            {/* Clear Chat Button */}
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 rounded-md transition-all duration-200"
                title="Xóa toàn bộ hội thoại"
              >
                Xóa
              </button>
            )}
            {/* Close Button */}
            <button
              onClick={toggleChat}
              className="p-1.5 rounded-md hover:bg-[var(--accent)] transition-all duration-200 ml-1"
              title="Đóng"
            >
              <HiXMark className="w-5 h-5 text-[var(--muted-foreground)]" />
            </button>
          </div>
        </div>

        {/* Chat History Panel - Enhanced UX */}
        {showHistory && (
          <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--background)]">
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider">Lịch sử trò chuyện</span>
              <span className="text-xs text-[var(--muted-foreground)]">{chatHistoryItems.length} tin nhắn</span>
            </div>
            <div
              className="overflow-y-auto px-4 pb-3"
              style={{ maxHeight: '240px', scrollbarWidth: 'thin' }}
            >
              {chatHistoryItems.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <p className="text-xs text-[var(--muted-foreground)] text-center">Chưa có lịch sử chat.<br />Hãy gửi tin nhắn đầu tiên!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {chatHistoryItems.map((item, index) => {
                    const prevItem = chatHistoryItems[index + 1];
                    const currentLabel = getDateLabel(new Date(item.timestamp));
                    const prevLabel = prevItem ? getDateLabel(new Date(prevItem.timestamp)) : null;
                    const showDateSeparator = currentLabel !== prevLabel;

                    return (
                      <React.Fragment key={`history-${index}-${String(item.timestamp)}`}>
                        {showDateSeparator && (
                          <div className="flex items-center gap-2 py-1">
                            <div className="flex-1 h-px bg-[var(--border)]" />
                            <span className="text-[10px] text-[var(--muted-foreground)] font-medium shrink-0">{currentLabel}</span>
                            <div className="flex-1 h-px bg-[var(--border)]" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setInputValue(item.content);
                            setShowHistory(false);
                            setTimeout(() => textareaRef.current?.focus(), 50);
                          }}
                          className="group w-full text-left rounded-lg border border-[var(--border)] px-3 py-2.5 hover:bg-[var(--accent)] hover:border-[var(--primary)]/30 transition-all duration-150"
                          title="Nhấp để dùng lại tin nhắn này"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-[var(--foreground)] line-clamp-2 leading-relaxed flex-1">{item.content}</p>
                            <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 mt-0.5">
                              {new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-[var(--primary)] font-medium">↑ Nhấp để điền vào ô chat</span>
                          </div>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-6 chatgpt-scrollbar"
          style={{
            scrollbarWidth: "none" /* Firefox */,
            msOverflowStyle: "none" /* Internet Explorer 10+ */,
          }}
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-[var(--muted)] max-w-sm">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-400 flex items-center justify-center">
                  <HiSparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-primary mb-2">
                  Xin chào! Tôi là trợ lý AI của mktask
                </h3>
                <p className="text-sm mb-4 text-gray-600 dark:text-gray-400">
                  Tôi có thể giúp bạn quản lý công việc, dự án và không gian làm việc
                </p>
                <div className="text-left bg-[var(--accent)] rounded-lg p-4">
                  <p className="text-sm font-medium mb-2 text-[var(--muted-foreground)]">
                    Thử các lệnh sau:
                  </p>
                  <ul className="text-sm space-y-1.5 text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                      "Tạo công việc tên là [tên]"
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                      "Hiển thị các công việc ưu tiên cao"
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                      "Đánh dấu [công việc] là đã xong"
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                      "Tạo không gian làm việc tên là [tên]"
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                      "Liệt kê các dự án của tôi"
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                      "Mở không gian làm việc [tên]"
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div key={index} className="group">
                  {message.role === "user" ? (
                    // User Message - Right aligned like
                    <div className="flex justify-end mb-4">
                      <div className="flex items-start gap-3 max-w-[80%]">
                        <div className="bg-[#1E2939] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                          <div className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#1E2939] text-sm font-medium flex-shrink-0">
                          {user?.firstName?.[0]?.toUpperCase() +
                            user?.lastName?.[0]?.toUpperCase() || "U"}
                        </div>
                      </div>
                    </div>
                  ) : message.role === "system" ? (
                    // System Message - Centered
                    <div className="flex justify-center mb-4">
                      <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 text-sm max-w-[90%]">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    // Assistant Message - Left aligned like
                    <div className="flex justify-start mb-4">
                      <div className="flex items-start gap-3 max-w-[85%]">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-400 flex items-center justify-center flex-shrink-0">
                          <HiSparkles className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
                          <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
                            {message.content}
                            {message.isStreaming && (
                              <span className="inline-block w-2 h-4 ml-1 bg-blue-600 animate-pulse rounded" />
                            )}
                          </div>
                          {message.plannerPlan && (
                            <div className="mt-3 space-y-3 text-sm">
                              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
                                <div className="font-semibold text-gray-900 dark:text-gray-100">
                                  {message.plannerPlan.summary}
                                </div>
                                <div className="mt-2 space-y-3">
                                  {message.plannerPlan.projects.map((project) => (
                                    <div key={project.id} className="border-t border-gray-100 dark:border-gray-800 pt-2">
                                      <div className="font-medium text-gray-900 dark:text-gray-100">
                                        {project.name}
                                      </div>
                                      {project.description && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                          {project.description}
                                        </div>
                                      )}
                                      <div className="mt-2 space-y-1">
                                        {project.tasks.slice(0, 8).map((task) => (
                                          <div key={task.id} className="rounded-md bg-gray-50 dark:bg-gray-800 px-2 py-1.5">
                                            <div className="font-medium">{task.title}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                              {task.assigneeName
                                                ? `Gợi ý: ${task.assigneeName}`
                                                : "Chưa có người phù hợp"}
                                              {task.estimateHours ? ` · ${task.estimateHours} giờ` : ""}
                                            </div>
                                          </div>
                                        ))}
                                        {project.tasks.length > 8 && (
                                          <div className="text-xs text-gray-500 dark:text-gray-400">
                                            Còn {project.tasks.length - 8} công việc khác
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {message.plannerPlan.warnings.length > 0 && (
                                  <div className="mt-3 rounded-md bg-yellow-50 border border-yellow-200 p-2 text-xs text-yellow-800">
                                    {message.plannerPlan.warnings.join("\n")}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleApplyProjectPlan(index)}
                                disabled={message.plannerApplied || isLoading}
                                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:bg-gray-300 disabled:text-gray-600"
                              >
                                {message.plannerApplied
                                  ? "Đã tạo dự án và công việc"
                                  : isLoading
                                    ? "Đang xử lý..."
                                    : "Tạo dự án và công việc"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Timestamp - appears on hover */}
                  {message.timestamp && (
                    <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 -mt-2 mb-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDateTimeForDisplay(message.timestamp, {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {(isBrowserAgentRunning || isLoading) && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-400 flex items-center justify-center flex-shrink-0">
                    <HiSparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    {(agentStatus || isLoading) && <span className="text-sm text-gray-500 dark:text-gray-400 italic thinking-fade" key={agentStatus || "loading"}>{agentStatus || "Đang xử lý"}...</span>}
                    <div className="flex items-center gap-0.5 h-4">
                      <span className="w-1 bg-gray-400 rounded-sm animate-pulse" style={{ animationDuration: "1.2s", animationDelay: "0s", height: "40%" }} />
                      <span className="w-1 bg-gray-400 rounded-sm animate-pulse" style={{ animationDuration: "1.2s", animationDelay: "0.2s", height: "60%" }} />
                      <span className="w-1 bg-gray-400 rounded-sm animate-pulse" style={{ animationDuration: "1.2s", animationDelay: "0.4s", height: "80%" }} />
                      <span className="w-1 bg-gray-400 rounded-sm animate-pulse" style={{ animationDuration: "1.2s", animationDelay: "0.6s", height: "60%" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}

          {error && (
            <div className="mx-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-600 dark:text-red-400 text-sm">!</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input Area - Fixed at bottom with auto-expanding textarea */}
        <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--background)] p-4">
          {/* Interim transcript display (shown while listening) */}
          {isListening && interimTranscript && (
            <div className="mb-2 px-1">
              <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                {interimTranscript}
              </span>
            </div>
          )}

          {/* Voice error display */}
          {voiceError && (
            <div className="mb-2 px-1">
              <span className="text-xs text-red-500 dark:text-red-400">
                {voiceError}
              </span>
            </div>
          )}

          {/* Cancel hint while listening */}
          {isListening && (
            <div className="mb-1 px-1">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono">Esc</kbd> to cancel
              </span>
            </div>
          )}

          <div className="flex gap-3 items-end">
            {/* Microphone button */}
            <button
              onClick={handleToggleVoice}
              disabled={isLoading || isBrowserAgentRunning}
              className={`p-3 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${isListening
                  ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                  : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                }`}
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              <HiMicrophone className="w-4 h-4" />
            </button>

            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder={
                !user
                  ? "Please log in to use AI assistant..."
                  : isListening
                    ? "Listening..."
                    : "Message Trợ lý AI..."
              }
              disabled={isLoading || isBrowserAgentRunning || !user || isListening}
              rows={1}
              className="flex-1 px-4 py-3 bg-[var(--muted)] border-[var(--border)] focus:ring-1 focus:ring-[var(--border)] focus:border-transparent transition-all duration-200 rounded-xl shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
              style={{
                minHeight: "48px",
                maxHeight: "120px",
                lineHeight: "1.5",
                height: "48px",
              }}
            />
            {isBrowserAgentRunning || isLoading ? (
              <button
                onClick={handleStopAgent}
                disabled={isLoading && !isBrowserAgentRunning}
                className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md flex-shrink-0"
              >
                <HiStop className="w-4 h-4" />
              </button>
            ) : isListening ? (
              <button
                onClick={() => voiceControllerRef.current?.stopListening()}
                className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md flex-shrink-0 animate-pulse"
                title="Stop listening and send"
              >
                <HiStop className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading || !user}
                className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md disabled:shadow-none flex-shrink-0"
              >
                <HiPaperAirplane className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Global styles for content squeeze and hidden scrollbars */}
      <style jsx global>{`
        body.chat-open .flex-1.overflow-y-scroll {
          margin-right: var(--chat-panel-width, ${CHAT_PANEL_DEFAULT_WIDTH}px) !important;
          transition: margin-right 300ms ease-in-out;
        }

        .flex-1.overflow-y-scroll {
          transition: margin-right 300ms ease-in-out;
        }

        /* Hide scrollbars completely */
        .chatgpt-scrollbar::-webkit-scrollbar {
          display: none;
        }

        /* Smooth scrolling */
        .chatgpt-scrollbar {
          scroll-behavior: smooth;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* Internet Explorer 10+ */
        }

        .thinking-fade {
          animation: fade-swap 4s ease-in-out infinite;
        }
        @keyframes fade-swap {
          0%, 90%, 100% { opacity: 1; }
          95% { opacity: 0; }
        }
      `}</style>
    </>
  );
}
