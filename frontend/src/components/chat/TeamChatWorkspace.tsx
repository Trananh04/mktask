import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  CheckSquare,
  FileText,
  FolderKanban,
  Heart,
  Info,
  MessageSquare,
  Paperclip,
  Pin,
  Plus,
  Reply,
  Search,
  Send,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { TokenManager } from "@/lib/api";
import { socketService } from "@/lib/socket";
import { SocketEventPayload, SocketEvents } from "@/types/socket";
import {
  ChatAttachment,
  ChatConversation,
  ChatMessage,
  ChatReadReceipt,
  ChatUnreadEvent,
  ChatUser,
  chatApi,
} from "@/utils/api/chatApi";
import { projectApi } from "@/utils/api/projectApi";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/common/PageHeader";
import { toast } from "sonner";

function displayName(user?: ChatUser | null) {
  if (!user) return "Thành viên";
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return fullName || user.email;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function resolveAvatarSrc(avatar?: string | null) {
  if (!avatar) return undefined;
  if (/^(https?:|data:|blob:)/.test(avatar)) return avatar;

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";
  const cleanAvatar = avatar.replace(/^\/+/, "");
  if (cleanAvatar.startsWith("uploads/")) {
    return `${apiBaseUrl}/${cleanAvatar}`;
  }

  return `${apiBaseUrl}/uploads/${cleanAvatar}`;
}

function getConversationPeer(conversation: ChatConversation, currentUserId?: string) {
  return conversation.members.find((member) => member.userId !== currentUserId)?.user || null;
}

function getConversationLabel(conversation: ChatConversation, currentUserId?: string) {
  if (conversation.type === "PROJECT") {
    return conversation.project?.name || "Dự án";
  }

  if (conversation.type === "WORKSPACE") {
    return conversation.workspace?.name || "Workspace";
  }

  return displayName(getConversationPeer(conversation, currentUserId));
}

function getMentionText(user: ChatUser) {
  return displayName(user).replace(/\s+/g, "");
}

function getAttachmentHref(attachment: ChatAttachment) {
  if (attachment.url?.startsWith("http")) return attachment.url;

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";
  if (attachment.url) return `${apiBaseUrl}/uploads${attachment.url}`;
  if (attachment.storageKey) return `${apiBaseUrl}/uploads/${attachment.storageKey}`;
  return "#";
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function formatConversationTime(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return new Intl.DateTimeFormat(
    "vi-VN",
    isToday
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit" }
  ).format(date);
}

function formatMessageDay(value?: string) {
  if (!value) return "Hôm nay";

  const date = new Date(value);
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (isToday) return "Hôm nay";

  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function ConversationAvatar({
  conversation,
  currentUserId,
  size = "size-11",
}: {
  conversation: ChatConversation;
  currentUserId?: string;
  size?: string;
}) {
  const peer = getConversationPeer(conversation, currentUserId);
  const label = getConversationLabel(conversation, currentUserId);

  return (
    <Avatar className={`${size} shrink-0 overflow-hidden rounded-full`}>
      <AvatarImage
        src={
          conversation.type === "PROJECT"
            ? resolveAvatarSrc(conversation.project?.avatar)
            : conversation.type === "WORKSPACE"
              ? resolveAvatarSrc(conversation.workspace?.avatar)
            : resolveAvatarSrc(peer?.avatar)
        }
        alt={label}
      />
      <AvatarFallback
        className={`flex h-full w-full items-center justify-center text-xs font-bold text-white ${
          conversation.type === "PROJECT"
            ? "bg-emerald-600"
            : conversation.type === "WORKSPACE"
              ? "bg-indigo-600"
              : "bg-sky-600"
        }`}
      >
        {conversation.type === "PROJECT" || conversation.type === "WORKSPACE" ? (
          <FolderKanban className="size-4" />
        ) : (
          initials(label)
        )}
      </AvatarFallback>
    </Avatar>
  );
}

function UserAvatar({ user, size = "size-8" }: { user?: ChatUser | null; size?: string }) {
  const label = displayName(user);

  return (
    <Avatar className={`${size} shrink-0 overflow-hidden rounded-full`}>
      <AvatarImage src={resolveAvatarSrc(user?.avatar)} alt={label} />
      <AvatarFallback className="flex h-full w-full items-center justify-center bg-slate-600 text-[11px] font-bold text-white">
        {initials(label)}
      </AvatarFallback>
    </Avatar>
  );
}

function ConversationRow({
  conversation,
  currentUserId,
  selected,
  onSelect,
}: {
  conversation: ChatConversation;
  currentUserId?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const lastMessage = conversation.messages[0];
  const unreadCount = conversation.unreadCount || 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`mb-1 flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left transition ${
        selected
          ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm"
          : "hover:bg-[var(--accent)]/70"
      }`}
    >
      <ConversationAvatar conversation={conversation} currentUserId={currentUserId} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="block min-w-0 flex-1 truncate text-sm font-semibold">
            {getConversationLabel(conversation, currentUserId)}
          </span>
          <span className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
            {formatConversationTime(lastMessage?.createdAt || conversation.updatedAt)}
          </span>
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-2">
          <span className="block min-w-0 flex-1 truncate text-xs text-[var(--muted-foreground)]">
            {lastMessage?.content ||
              (conversation.type === "PROJECT" ? "Nhóm dự án đã sẵn sàng" : "Bắt đầu nhắn tin")}
          </span>
          {unreadCount > 0 ? (
            <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary-foreground)]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : (
            selected && <span className="size-2 shrink-0 rounded-full bg-[var(--primary)]" />
          )}
        </span>
      </span>
    </button>
  );
}

function projectRoleLabel(role?: string) {
  switch (role) {
    case "OWNER":
      return "Chủ dự án";
    case "MANAGER":
      return "Quản lý";
    case "VIEWER":
      return "Người xem";
    case "MEMBER":
      return "Thành viên";
    default:
      return role;
  }
}

export default function TeamChatWorkspace() {
  const { getCurrentUser } = useAuth();
  const currentUser = getCurrentUser();
  const organizationId = TokenManager.getCurrentOrgId();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [contacts, setContacts] = useState<ChatUser[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [projectMembers, setProjectMembers] = useState<
    Array<{ userId: string; role?: string; user: ChatUser }>
  >([]);
  const [projectMemberTotal, setProjectMemberTotal] = useState(0);
  const [readReceipts, setReadReceipts] = useState<ChatReadReceipt[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || null,
    [conversations, selectedId]
  );
  const visibleConversations = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return conversations;

    return conversations.filter((conversation) =>
      getConversationLabel(conversation, currentUser?.id).toLowerCase().includes(keyword)
    );
  }, [conversations, currentUser?.id, search]);
  const projectConversations = visibleConversations.filter(
    (conversation) => conversation.type === "PROJECT"
  );
  const directConversations = visibleConversations.filter(
    (conversation) => conversation.type === "DIRECT"
  );
  const workspaceConversations = visibleConversations.filter(
    (conversation) => conversation.type === "WORKSPACE"
  );
  const latestMessages = messages.slice(-3).reverse();
  const pinnedMessages = messages.filter((message) => message.isPinned);
  const visibleMembers = useMemo(() => {
    const memberMap = new Map<string, { userId: string; role?: string; user: ChatUser }>();

    const conversationMembers =
      selectedConversation?.type === "PROJECT"
        ? projectMembers
        : selectedConversation?.type === "WORKSPACE"
          ? contacts.map((user) => ({ userId: user.id, user }))
          : selectedConversation?.members || [];

    conversationMembers.forEach((member) => {
      memberMap.set(member.userId, member);
    });
    messages.forEach((message) => {
      memberMap.set(message.senderId, {
        userId: message.senderId,
        user: message.sender,
      });
    });

    return Array.from(memberMap.values());
  }, [contacts, messages, projectMembers, selectedConversation]);
  const visibleMemberCount =
    selectedConversation?.type === "PROJECT"
      ? projectMemberTotal || visibleMembers.length
      : visibleMembers.length;

  useEffect(() => {
    let active = true;

    const loadWorkspace = async () => {
      setLoading(true);
      setError(null);
      try {
        const [loadedConversations, loadedContacts] = await Promise.all([
          chatApi.listConversations(organizationId || undefined),
          organizationId ? chatApi.listContacts(organizationId) : Promise.resolve([]),
        ]);
        if (!active) return;

        setContacts(loadedContacts);
        setConversations(loadedConversations);
        setSelectedId((current) => current || loadedConversations[0]?.id || null);
      } catch (loadError: any) {
        if (active) {
          setError(loadError?.message || "Không tải được hội thoại.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadWorkspace();
    return () => {
      active = false;
    };
  }, [organizationId]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    try {
      await chatApi.markConversationRead(conversationId);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
        )
      );
      window.dispatchEvent(new CustomEvent("chat:read", { detail: { conversationId } }));
    } catch {
      // A later read or reload will reconcile the unread badge.
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    let active = true;
    setMessageSearch("");
    setReplyingTo(null);
    setSelectedFiles([]);
    Promise.all([chatApi.listMessages(selectedId, 40), chatApi.getReadReceipts(selectedId)])
      .then(([loadedMessages, receipts]) => {
        if (!active) return;

        setMessages(loadedMessages);
        setReadReceipts(receipts);
        setHasMoreMessages(loadedMessages.length >= 40);
        void markConversationRead(selectedId);
      })
      .catch((loadError: any) => {
        if (active) setError(loadError?.message || "Không tải được tin nhắn.");
      });

    socketService.joinRoom("chat", selectedId);
    const handleMessage = (payload: SocketEventPayload<ChatMessage>) => {
      if (payload.data.conversationId !== selectedId) return;
      setMessages((current) =>
        current.some((message) => message.id === payload.data.id)
          ? current
          : [...current, payload.data]
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedId
            ? {
                ...conversation,
                updatedAt: payload.data.createdAt,
                messages: [payload.data],
              }
            : conversation
        )
      );
      void markConversationRead(selectedId);
    };
    const handleMessageUpdate = (payload: SocketEventPayload<ChatMessage>) => {
      if (payload.data.conversationId !== selectedId) return;
      setMessages((current) =>
        current.map((message) => (message.id === payload.data.id ? payload.data : message))
      );
    };

    socketService.on(SocketEvents.CHAT_MESSAGE, handleMessage);
    socketService.on(SocketEvents.CHAT_REACTION, handleMessageUpdate);
    socketService.on(SocketEvents.CHAT_PINNED, handleMessageUpdate);
    return () => {
      active = false;
      socketService.off(SocketEvents.CHAT_MESSAGE, handleMessage);
      socketService.off(SocketEvents.CHAT_REACTION, handleMessageUpdate);
      socketService.off(SocketEvents.CHAT_PINNED, handleMessageUpdate);
      socketService.leaveRoom("chat", selectedId);
    };
  }, [markConversationRead, selectedId]);

  useEffect(() => {
    const handleUnread = (event: Event) => {
      const payload = (event as CustomEvent<SocketEventPayload<ChatUnreadEvent>>).detail;
      const unread = payload?.data;
      if (!unread || unread.message.senderId === currentUser?.id) return;

      if (unread.conversationId === selectedId) {
        void markConversationRead(unread.conversationId);
        return;
      }

      const knownConversation = conversations.some(
        (conversation) => conversation.id === unread.conversationId
      );
      if (!knownConversation) {
        void chatApi
          .listConversations(organizationId || undefined)
          .then((loadedConversations) => setConversations(loadedConversations))
          .catch(() => undefined);
        return;
      }

      setConversations((current) =>
        current
          .map((conversation) =>
            conversation.id === unread.conversationId
              ? {
                  ...conversation,
                  updatedAt: unread.message.createdAt,
                  messages: [unread.message],
                  unreadCount: (conversation.unreadCount || 0) + 1,
                }
              : conversation
          )
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      );
    };

    window.addEventListener(SocketEvents.CHAT_UNREAD, handleUnread);
    return () => window.removeEventListener(SocketEvents.CHAT_UNREAD, handleUnread);
  }, [conversations, currentUser?.id, markConversationRead, organizationId, selectedId]);

  useEffect(() => {
    const projectId = selectedConversation?.projectId;
    if (selectedConversation?.type !== "PROJECT" || !projectId) {
      setProjectMembers([]);
      setProjectMemberTotal(0);
      return;
    }

    let active = true;
    projectApi
      .getProjectMembersPagination(projectId, undefined, 1, 12)
      .then((result) => {
        if (!active) return;

        const loadedMembers = result.data.flatMap((member) => {
          if (!member.user) return [];

          return [
            {
              userId: member.userId,
              role: member.role,
              user: {
                id: member.user.id,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
                email: member.user.email,
                avatar: member.user.avatar,
              },
            },
          ];
        });

        setProjectMembers(loadedMembers);
        setProjectMemberTotal(result.total);
      })
      .catch(() => {
        if (active) {
          setProjectMembers([]);
          setProjectMemberTotal(0);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const startDirectConversation = async (contact: ChatUser) => {
    if (!organizationId) return;
    setError(null);
    try {
      const conversation = await chatApi.createDirectConversation(organizationId, contact.id);
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id),
      ]);
      setSelectedId(conversation.id);
    } catch (createError: any) {
      setError(createError?.message || "Không tạo được hội thoại.");
    }
  };

  const loadOlderMessages = async () => {
    if (!selectedId || messages.length === 0) return;
    try {
      const olderMessages = await chatApi.listMessages(selectedId, 40, messages[0].id);
      setMessages((current) => [...olderMessages, ...current]);
      setHasMoreMessages(olderMessages.length >= 40);
    } catch {
      toast.error("Không tải được tin nhắn cũ.");
    }
  };

  const runMessageSearch = async () => {
    if (!selectedId) return;
    const keyword = messageSearch.trim();
    if (!keyword) {
      const loadedMessages = await chatApi.listMessages(selectedId, 40);
      setMessages(loadedMessages);
      setHasMoreMessages(loadedMessages.length >= 40);
      return;
    }

    try {
      const results = await chatApi.searchMessages(selectedId, keyword);
      setMessages(results);
      setHasMoreMessages(false);
    } catch {
      toast.error("Không tìm được tin nhắn.");
    }
  };

  const toggleReaction = async (messageId: string) => {
    try {
      const updatedMessage = await chatApi.toggleReaction(messageId, "HEART");
      setMessages((current) =>
        current.map((message) => (message.id === messageId ? updatedMessage : message))
      );
    } catch {
      toast.error("Không thả tim được tin nhắn.");
    }
  };

  const togglePin = async (messageId: string) => {
    try {
      const updatedMessage = await chatApi.togglePin(messageId);
      setMessages((current) =>
        current.map((message) => (message.id === messageId ? updatedMessage : message))
      );
    } catch {
      toast.error("Không ghim được tin nhắn.");
    }
  };

  const createTaskFromMessage = async (messageId: string) => {
    try {
      await chatApi.createTaskFromMessage(messageId);
      toast.success("Đã tạo task từ tin nhắn.");
    } catch {
      toast.error("Chỉ có thể tạo task từ chat dự án.");
    }
  };

  const getMentionedUserIds = () => {
    const lowerDraft = draft.toLowerCase();
    return visibleMembers
      .filter((member) => {
        const user = member.user;
        const display = displayName(user).toLowerCase();
        return (
          lowerDraft.includes(`@${display}`) ||
          lowerDraft.includes(`@${getMentionText(user).toLowerCase()}`) ||
          lowerDraft.includes(`@${user.email.toLowerCase()}`)
        );
      })
      .map((member) => member.userId);
  };

  const sendMessage = async () => {
    if (!selectedId || (!draft.trim() && selectedFiles.length === 0) || sending) return;
    setSending(true);
    setError(null);
    try {
      const attachments =
        selectedFiles.length > 0
          ? await Promise.all(selectedFiles.map((file) => chatApi.uploadAttachment(file)))
          : [];
      const message = await chatApi.sendMessage(selectedId, draft || "Đã gửi tệp đính kèm", {
        parentMessageId: replyingTo?.id,
        mentionedUserIds: getMentionedUserIds(),
        attachments,
      });
      setMessages((current) =>
        current.some((item) => item.id === message.id) ? current : [...current, message]
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedId
            ? { ...conversation, updatedAt: message.createdAt, messages: [message] }
            : conversation
        )
      );
      setDraft("");
      setReplyingTo(null);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (sendError: any) {
      setError(sendError?.message || "Không gửi được tin nhắn.");
    } finally {
      setSending(false);
    }
  };
  const focusConversationSearch = () => {
    setDetailsOpen(false);
    searchInputRef.current?.focus();
  };

  return (
    <section className="dashboard-container space-y-4">
      <PageHeader icon={<MessageSquare className="size-4" />} title="Trò chuyện" />
      <div className="relative grid h-[calc(100vh-170px)] min-h-[520px] max-h-[820px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--background)] shadow-sm lg:grid-cols-[330px_minmax(0,1fr)] 2xl:grid-cols-[330px_minmax(0,1fr)_320px]">
        <aside className="flex min-h-0 flex-col border-b border-[var(--border)] bg-[var(--muted)]/15 lg:border-b-0 lg:border-r">
          <div className="space-y-4 border-b border-[var(--border)] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)]">
                <Check className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold">MKTask</div>
                <div className="text-xs text-[var(--muted-foreground)]">Trò chuyện công việc</div>
              </div>
              <div className="flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]">
                <MessageSquare className="size-4" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="size-4" />
              Trò chuyện
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <Input
                ref={searchInputRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm hội thoại"
                className="h-10 rounded-md bg-[var(--background)] pl-9"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            {projectConversations.length > 0 && (
              <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase text-[var(--muted-foreground)]">
                Nhóm dự án
              </div>
            )}
            {projectConversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                currentUserId={currentUser?.id}
                selected={conversation.id === selectedId}
                onSelect={() => setSelectedId(conversation.id)}
              />
            ))}
            {workspaceConversations.length > 0 && (
              <div className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase text-[var(--muted-foreground)]">
                Workspace
              </div>
            )}
            {workspaceConversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                currentUserId={currentUser?.id}
                selected={conversation.id === selectedId}
                onSelect={() => setSelectedId(conversation.id)}
              />
            ))}
            {directConversations.length > 0 && (
              <div className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase text-[var(--muted-foreground)]">
                Trực tiếp
              </div>
            )}
            {directConversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                currentUserId={currentUser?.id}
                selected={conversation.id === selectedId}
                onSelect={() => setSelectedId(conversation.id)}
              />
            ))}
            {!loading && visibleConversations.length === 0 && (
              <p className="px-3 py-4 text-sm text-[var(--muted-foreground)]">
                Không có hội thoại phù hợp.
              </p>
            )}
          </div>
          {contacts.length > 0 && (
            <div className="border-t border-[var(--border)] p-2">
              <div className="px-2 pb-2 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                Nhắn trực tiếp
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {contacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => startDirectConversation(contact)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--accent)]"
                  >
                    <UserAvatar user={contact} />
                    <span className="min-w-0 flex-1 truncate">{displayName(contact)}</span>
                    <Plus className="size-3.5 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
        <div className="flex min-h-[560px] min-w-0 flex-col bg-[var(--background)]">
          <div className="flex h-[84px] items-center gap-3 border-b border-[var(--border)] px-5">
            {selectedConversation && (
              <ConversationAvatar
                conversation={selectedConversation}
                currentUserId={currentUser?.id}
                size="size-11"
              />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold">
                {selectedConversation
                  ? getConversationLabel(selectedConversation, currentUser?.id)
                  : "Chọn hội thoại"}
              </h2>
              {selectedConversation && (
                <p className="truncate text-xs text-[var(--muted-foreground)]">
                  {selectedConversation.type === "PROJECT"
                    ? `${selectedConversation.project?.workspace.name || "Dự án"} - nhóm dự án`
                    : selectedConversation.type === "WORKSPACE"
                      ? `${selectedConversation.workspace?.name || "Workspace"} - nhóm workspace`
                    : "Tin nhắn riêng trong công ty"}
                </p>
              )}
            </div>
            {selectedConversation && (
              <div className="hidden w-[260px] items-center gap-1 rounded-md border border-[var(--border)] px-2 md:flex">
                <Search className="size-4 text-[var(--muted-foreground)]" />
                <Input
                  value={messageSearch}
                  onChange={(event) => setMessageSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runMessageSearch();
                  }}
                  placeholder="Tìm tin nhắn"
                  className="h-9 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={focusConversationSearch}
                aria-label="Tìm hội thoại"
                title="Tìm hội thoại"
                className="rounded-md bg-[var(--background)]"
              >
                <Search />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setDetailsOpen(true)}
                aria-label="Mở thông tin hội thoại"
                title="Thông tin hội thoại"
                className="rounded-md bg-[var(--background)] 2xl:hidden"
              >
                <Info />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[var(--muted)]/10 px-4 py-6 sm:px-6">
            {hasMoreMessages && (
              <div className="mb-4 text-center">
                <Button type="button" variant="outline" size="sm" onClick={loadOlderMessages}>
                  Tải tin cũ
                </Button>
              </div>
            )}
            {selectedConversation && (
              <div className="mb-6 flex items-center gap-4">
                <span className="h-px flex-1 bg-[var(--border)]" />
                <span className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs text-[var(--muted-foreground)]">
                  {formatMessageDay(messages[messages.length - 1]?.createdAt)}
                </span>
                <span className="h-px flex-1 bg-[var(--border)]" />
              </div>
            )}
            <div className="space-y-5">
              {messages.map((message) => {
                const isOwnMessage = message.senderId === currentUser?.id;
                const heartCount =
                  message.reactions?.filter((reaction) => reaction.type === "HEART").length || 0;
                const hasReacted = Boolean(
                  message.reactions?.some(
                    (reaction) => reaction.type === "HEART" && reaction.userId === currentUser?.id
                  )
                );
                const readNames = isOwnMessage
                  ? readReceipts
                      .filter(
                        (receipt) =>
                          receipt.userId !== currentUser?.id &&
                          new Date(receipt.lastReadAt) >= new Date(message.createdAt)
                      )
                      .slice(0, 3)
                      .map((receipt) => displayName(receipt.user))
                  : [];
                return (
                  <div
                    key={message.id}
                    className={`flex items-end gap-3 ${
                      isOwnMessage ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isOwnMessage && <UserAvatar user={message.sender} />}
                    <div
                      className={`min-w-0 max-w-[min(620px,88%)] ${
                        isOwnMessage ? "text-right" : ""
                      }`}
                    >
                      {!isOwnMessage && (
                        <div className="mb-1 flex items-center gap-2 text-xs">
                          <span className="font-semibold">{displayName(message.sender)}</span>
                          <span className="text-[var(--muted-foreground)]">
                            {formatMessageTime(message.createdAt)}
                          </span>
                        </div>
                      )}
                      {isOwnMessage && (
                        <div className="mb-1 text-[11px] text-[var(--muted-foreground)]">
                          {formatMessageTime(message.createdAt)}
                        </div>
                      )}
                      <div
                        className={`min-w-0 overflow-hidden rounded-md border px-4 py-3 text-left shadow-sm ${
                          isOwnMessage
                            ? "border-transparent bg-[var(--muted)] text-[var(--foreground)]"
                            : "border-[var(--border)] bg-[var(--background)]"
                        }`}
                      >
                        {message.parentMessage && (
                          <div className="mb-2 rounded-md border-l-2 border-[var(--primary)] bg-[var(--muted)]/40 px-3 py-2 text-xs text-[var(--muted-foreground)]">
                            <div className="font-semibold">
                              {displayName(message.parentMessage.sender)}
                            </div>
                            <div className="line-clamp-2">{message.parentMessage.content}</div>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-all text-sm leading-5 sm:break-words">
                          {message.content}
                        </p>
                        {(message.attachments || []).length > 0 && (
                          <div className="mt-3 space-y-2">
                            {(message.attachments || []).map((attachment) => (
                              <a
                                key={attachment.id || attachment.storageKey || attachment.fileName}
                                href={getAttachmentHref(attachment)}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 rounded-md border border-[var(--border)] px-2 py-1.5 text-xs hover:bg-[var(--accent)]"
                              >
                                <FileText className="size-4" />
                                <span className="min-w-0 flex-1 truncate">
                                  {attachment.fileName}
                                </span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div
                        className={`mt-1 flex items-center gap-1 ${
                          isOwnMessage ? "justify-end" : "justify-start"
                        }`}
                      >
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setReplyingTo(message)}
                          aria-label="Trả lời"
                          title="Trả lời"
                          className="size-7 rounded-md"
                        >
                          <Reply className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => toggleReaction(message.id)}
                          aria-label="Thả tim"
                          title="Thả tim"
                          className={`h-7 min-w-7 rounded-md px-2 ${
                            hasReacted ? "text-red-500" : ""
                          }`}
                        >
                          <Heart className="size-3.5" />
                          {heartCount > 0 && <span className="ml-1 text-xs">{heartCount}</span>}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => togglePin(message.id)}
                          aria-label="Ghim"
                          title="Ghim"
                          className={`size-7 rounded-md ${message.isPinned ? "text-amber-500" : ""}`}
                        >
                          <Pin className="size-3.5" />
                        </Button>
                        {selectedConversation?.type === "PROJECT" && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => createTaskFromMessage(message.id)}
                            aria-label="Tạo task"
                            title="Tạo task"
                            className="size-7 rounded-md"
                          >
                            <CheckSquare className="size-3.5" />
                          </Button>
                        )}
                      </div>
                      {readNames.length > 0 && (
                        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[var(--muted-foreground)]">
                          <CheckCheck className="size-3.5" />
                          <span>Đã xem bởi {readNames.join(", ")}</span>
                        </div>
                      )}
                    </div>
                    {isOwnMessage && <UserAvatar user={message.sender} />}
                  </div>
                );
              })}
              {!loading && selectedConversation && messages.length === 0 && (
                <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
                  Chưa có tin nhắn.
                </p>
              )}
              {!selectedConversation && (
                <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
                  Chọn một hội thoại để bắt đầu.
                </p>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <div className="border-t border-[var(--border)] bg-[var(--background)] px-4 py-4 sm:px-5">
            {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
            {replyingTo && (
              <div className="mb-2 flex min-w-0 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2 text-xs">
                <Reply className="size-4 text-[var(--muted-foreground)]" />
                <span className="min-w-0 flex-1 truncate">
                  Đang trả lời {displayName(replyingTo.sender)}: {replyingTo.content}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setReplyingTo(null)}
                  aria-label="Bỏ trả lời"
                  className="size-7 rounded-md"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            )}
            {selectedFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {selectedFiles.map((file) => (
                  <span
                    key={`${file.name}-${file.size}`}
                    className="inline-flex max-w-[220px] items-center gap-2 rounded-md border border-[var(--border)] px-2 py-1 text-xs"
                  >
                    <Paperclip className="size-3.5" />
                    <span className="truncate">{file.name}</span>
                  </span>
                ))}
              </div>
            )}
            <div className="flex min-w-0 items-end gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] p-2 shadow-sm">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedConversation || sending}
                aria-label="Đính kèm file"
                title="Đính kèm file"
                className="rounded-md"
              >
                <Paperclip />
              </Button>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Nhập tin nhắn..."
                disabled={!selectedConversation || sending}
                className="min-h-10 max-h-32 min-w-0 resize-y border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button
                type="button"
                size="icon"
                onClick={sendMessage}
                disabled={!selectedConversation || (!draft.trim() && selectedFiles.length === 0) || sending}
                aria-label="Gửi tin nhắn"
                title="Gửi tin nhắn"
                className="rounded-md"
              >
                <Send />
              </Button>
            </div>
          </div>
        </div>
        <aside
          className={`absolute inset-y-0 right-0 z-20 min-h-0 w-[min(360px,100%)] flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-xl 2xl:static 2xl:flex 2xl:w-auto 2xl:shadow-none ${
            detailsOpen ? "flex" : "hidden"
          }`}
        >
          <div className="flex h-[84px] items-center justify-between border-b border-[var(--border)] px-5">
            <h3 className="text-sm font-semibold">Thông tin hội thoại</h3>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setDetailsOpen(false)}
              aria-label="Đóng thông tin hội thoại"
              className="rounded-md 2xl:hidden"
            >
              <X />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <section className="border-b border-[var(--border)] px-5 py-6 text-center">
              {selectedConversation ? (
                <ConversationAvatar
                  conversation={selectedConversation}
                  currentUserId={currentUser?.id}
                  size="mx-auto size-20"
                />
              ) : (
                <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
                  <MessageSquare className="size-7" />
                </div>
              )}
              <h3 className="mt-3 truncate text-lg font-semibold">
                {selectedConversation
                  ? getConversationLabel(selectedConversation, currentUser?.id)
                  : "Chọn hội thoại"}
              </h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {selectedConversation?.type === "PROJECT"
                  ? selectedConversation.project?.workspace.name || "Nhóm dự án"
                  : "Tin nhắn trực tiếp trong công ty"}
              </p>
              {selectedConversation && (
                <div className="mt-4 grid grid-cols-2 gap-2 text-left">
                  <div className="rounded-md border border-[var(--border)] px-3 py-2">
                    <div className="text-[11px] uppercase text-[var(--muted-foreground)]">
                      Loại
                    </div>
                    <div className="mt-1 truncate text-sm font-medium">
                      {selectedConversation.type === "PROJECT" ? "Nhóm dự án" : "Trực tiếp"}
                    </div>
                  </div>
                  <div className="rounded-md border border-[var(--border)] px-3 py-2">
                    <div className="text-[11px] uppercase text-[var(--muted-foreground)]">
                      Tin nhắn
                    </div>
                    <div className="mt-1 text-sm font-medium">{messages.length}</div>
                  </div>
                </div>
              )}
            </section>
            <section className="border-b border-[var(--border)] px-5 py-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Tin nhắn gần đây</h4>
                <button
                  type="button"
                  onClick={focusConversationSearch}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  Tìm hội thoại
                </button>
              </div>
              {latestMessages.length > 0 ? (
                <div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
                  {latestMessages.map((message) => (
                    <div key={message.id} className="flex gap-3 px-3 py-3">
                      <UserAvatar user={message.sender} size="size-9" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {displayName(message.sender)}
                          </span>
                          <span className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
                            {formatConversationTime(message.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[var(--muted-foreground)]">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">Chưa có tin nhắn.</p>
              )}
            </section>
            <section className="border-b border-[var(--border)] px-5 py-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Tin ghim</h4>
                <Pin className="size-4 text-[var(--muted-foreground)]" />
              </div>
              {pinnedMessages.length > 0 ? (
                <div className="space-y-2">
                  {pinnedMessages.map((message) => (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => togglePin(message.id)}
                      className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-left text-xs hover:bg-[var(--accent)]"
                    >
                      <div className="font-semibold">{displayName(message.sender)}</div>
                      <div className="mt-1 line-clamp-2 text-[var(--muted-foreground)]">
                        {message.content}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Chưa có tin nhắn được ghim.
                </p>
              )}
            </section>
            <section className="px-5 py-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Thành viên ({visibleMemberCount})</h4>
                <Users className="size-4 text-[var(--muted-foreground)]" />
              </div>
              {visibleMembers.length > 0 ? (
                <div className="space-y-3">
                  {visibleMembers.map((member) => (
                    <div key={member.userId} className="flex items-center gap-3">
                      <UserAvatar user={member.user} size="size-10" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {displayName(member.user)}
                        </div>
                        <div className="truncate text-xs text-[var(--muted-foreground)]">
                          {projectRoleLabel(member.role) ||
                            (member.userId === currentUser?.id ? "Bạn" : member.user.email)}
                        </div>
                      </div>
                      {member.userId === currentUser?.id && (
                        <UserRound className="size-4 text-[var(--muted-foreground)]" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Thành viên sẽ hiện khi hội thoại sẵn sàng.
                </p>
              )}
            </section>
          </div>
        </aside>
      </div>
    </section>
  );
}
