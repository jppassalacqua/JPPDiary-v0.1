
import React, { createContext, useContext, useState } from 'react';
import { ChatMessage } from '../types';

interface SessionContextType {
  askHistory: ChatMessage[];
  setAskHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  interviewHistory: ChatMessage[];
  setInterviewHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  clearSession: (type: 'ask' | 'interview') => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [askHistory, setAskHistory] = useState<ChatMessage[]>([]);
  const [interviewHistory, setInterviewHistory] = useState<ChatMessage[]>([]);

  const clearSession = (type: 'ask' | 'interview') => {
      if (type === 'ask') setAskHistory([]);
      if (type === 'interview') setInterviewHistory([]);
  };

  return (
    <SessionContext.Provider value={{ 
        askHistory, 
        setAskHistory, 
        interviewHistory, 
        setInterviewHistory,
        clearSession
    }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within a SessionProvider');
  return context;
};
