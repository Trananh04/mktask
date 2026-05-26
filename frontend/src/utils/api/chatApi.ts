import api from "@/lib/api";

export interface ChatUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  parentMessageId?: string | null;
  content: string;
  isPinned?: boolean;
  pinnedAt?: string | null;
  pinnedById?: string | null;
  createdAt: string;
  sender: ChatUser;
  parentMessage?: Pick<ChatMessage, "id" | "content" | "senderId" | "sender"> | null;
  mentions?: Array<{ userId: string; user: ChatUser }>;
  reactions?: Array<{ messageId: string; userId: string; type: string; user?: ChatUser }>;
  attachments?: ChatAttachment[];
}

export interface ChatAttachment {
  id?: string;
  fileName: string;
  mimeType: string;
  size: number;
  url?: string | null;
  storageKey?: string | null;
  projectId?: string | null;
  workspaceId?: string | null;
}

export interface ChatReadReceipt {
  conversationId: string;
  userId: string;
  lastReadAt: string;
  user: ChatUser;
}

export interface ChatConversation {
  id: string;
  type: "PROJECT" | "WORKSPACE" | "DIRECT";
  organizationId: string;
  projectId?: string | null;
  workspaceId?: string | null;
  updatedAt: string;
  project?: {
    id: string;
    name: string;
    slug: string;
    avatar?: string | null;
    color?: string | null;
    workspace: {
      id: string;
      name: string;
      slug: string;
      organizationId: string;
    };
  } | null;
  workspace?: {
    id: string;
    name: string;
    slug: string;
    avatar?: string | null;
    color?: string | null;
    organizationId: string;
  } | null;
  members: Array<{ userId: string; user: ChatUser }>;
  messages: ChatMessage[];
  unreadCount?: number;
}

export interface ChatUnreadSummary {
  unreadCount: number;
  conversationCount: number;
}

export interface ChatUnreadEvent {
  conversationId: string;
  organizationId: string;
  message: ChatMessage;
}

export const chatApi = {
  listConversations: async (organizationId?: string) => {
    const response = await api.get<ChatConversation[]>("/chat/conversations", {
      params: organizationId ? { organizationId } : undefined,
    });
    return response.data;
  },

  listContacts: async (organizationId: string) => {
    const response = await api.get<Array<{ user: ChatUser }>>("/chat/contacts", {
      params: { organizationId },
    });
    return response.data.map((contact) => contact.user);
  },

  getUnreadSummary: async (organizationId?: string) => {
    const response = await api.get<ChatUnreadSummary>("/chat/unread-summary", {
      params: organizationId ? { organizationId } : undefined,
    });
    return response.data;
  },

  createDirectConversation: async (organizationId: string, participantId: string) => {
    const response = await api.post<ChatConversation>("/chat/direct-conversations", {
      organizationId,
      participantId,
    });
    return response.data;
  },

  openWorkspaceConversation: async (workspaceId: string) => {
    const response = await api.post<ChatConversation>(
      `/chat/workspaces/${encodeURIComponent(workspaceId)}/conversation`
    );
    return response.data;
  },

  listMessages: async (conversationId: string, limit = 60, cursor?: string) => {
    const response = await api.get<ChatMessage[]>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
      { params: { limit, ...(cursor ? { cursor } : {}) } }
    );
    return response.data;
  },

  searchMessages: async (conversationId: string, query: string) => {
    const response = await api.get<ChatMessage[]>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages/search`,
      { params: { q: query } }
    );
    return response.data;
  },

  sendMessage: async (
    conversationId: string,
    content: string,
    options: {
      parentMessageId?: string;
      mentionedUserIds?: string[];
      attachments?: ChatAttachment[];
    } = {}
  ) => {
    const response = await api.post<ChatMessage>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
      { content, ...options }
    );
    return response.data;
  },

  markConversationRead: async (conversationId: string) => {
    const response = await api.post(
      `/chat/conversations/${encodeURIComponent(conversationId)}/read`
    );
    return response.data;
  },

  getReadReceipts: async (conversationId: string) => {
    const response = await api.get<ChatReadReceipt[]>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/read-receipts`
    );
    return response.data;
  },

  toggleReaction: async (messageId: string, type = "HEART") => {
    const response = await api.post<ChatMessage>(
      `/chat/messages/${encodeURIComponent(messageId)}/reactions`,
      { type }
    );
    return response.data;
  },

  togglePin: async (messageId: string) => {
    const response = await api.post<ChatMessage>(
      `/chat/messages/${encodeURIComponent(messageId)}/pin`
    );
    return response.data;
  },

  createTaskFromMessage: async (messageId: string) => {
    const response = await api.post(`/chat/messages/${encodeURIComponent(messageId)}/create-task`, {});
    return response.data;
  },

  uploadAttachment: async (file: File): Promise<ChatAttachment> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/uploads/upload/chat", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      url: response.data.url,
      storageKey: response.data.key,
    };
  },
};
