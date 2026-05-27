import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface ChatContextType {
  isChatOpen: boolean;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    // Return a default value when context is not available
    return {
      isChatOpen: false,
      toggleChat: () => {},
      openChat: () => {},
      closeChat: () => {},
    };
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleChat = () => {
    setIsChatOpen((prev) => !prev);
  };

  const openChat = () => {
    setIsChatOpen(true);
  };

  const closeChat = () => {
    setIsChatOpen(false);
  };

  useEffect(() => {
    // Apply body class for layout shift when chat is open
    if (typeof document !== "undefined") {
      document.body.classList.toggle("chat-open", isChatOpen);
    }

    return () => {
      if (typeof document !== "undefined") {
        document.body.classList.remove("chat-open");
      }
    };
  }, [isChatOpen]);

  return (
    <ChatContext.Provider value={{ isChatOpen, toggleChat, openChat, closeChat }}>
      {children}
    </ChatContext.Provider>
  );
}

export default ChatProvider;
