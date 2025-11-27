
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { db } from '../services/db';
import { geminiService } from '../services/geminiService';
import { ChatMessage, DiaryEntry } from '../types';
import { Sparkles, Send, Loader2, BookOpen, ArrowRight, MessageSquare } from 'lucide-react';
import { useTranslation } from '../services/translations';
import { useNavigate } from 'react-router-dom';

const AskGemini: React.FC = () => {
  const { user } = useAuth();
  const { aiConfig } = useConfig();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchEntries = async () => {
      if (user) {
        setLoading(true);
        try { setEntries(await db.getEntries(user.id)); } catch (e) { console.error(e); } finally { setLoading(false); }
      }
    };
    fetchEntries();
  }, [user]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, isProcessing]);

  const handleSendMessage = async () => {
      if (!input.trim() || isProcessing || !user) return;
      const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
      const newHistory = [...history, userMsg];
      setHistory(newHistory);
      setInput('');
      setIsProcessing(true);

      try {
          const total = entries.length;
          const avgSentiment = entries.reduce((acc, e) => acc + e.analysis.sentimentScore, 0) / (total || 1);
          const moodCounts = entries.reduce((acc, e) => { acc[e.analysis.mood] = (acc[e.analysis.mood] || 0) + 1; return acc; }, {} as Record<string, number>);
          const statsStr = `Total Entries: ${total}. Avg Sentiment: ${avgSentiment.toFixed(2)}. Moods: ${JSON.stringify(moodCounts)}.`;

          const response = await geminiService.chatWithData(newHistory, userMsg.text, entries, statsStr, user.preferences, aiConfig);
          setHistory(prev => [...prev, { role: 'model', text: response, timestamp: Date.now() }]);
      } catch (e) { console.error(e); setHistory(prev => [...prev, { role: 'model', text: "Error analyzing memories.", timestamp: Date.now() }]); } finally { setIsProcessing(false); }
  };

  const renderMessageContent = (text: string) => {
      const parts = text.split(/(\[\[ENTRY:[^\]]+\]\])/g);
      return parts.map((part, idx) => {
          const match = part.match(/^\[\[ENTRY:([^|]+)\|([^\]]+)\]\]$/);
          if (match) {
              const id = match[1];
              const label = match[2];
              return (
                  <button key={idx} onClick={() => navigate('/history', { state: { entryId: id, date: entries.find(e=>e.id===id)?.timestamp||0 } })} className="inline-flex items-center gap-1.5 mx-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium hover:bg-indigo-200">
                      <BookOpen size={12} />{label}<ArrowRight size={10} />
                  </button>
              );
          }
          return <span key={idx}>{part}</span>;
      });
  };

  return (
    <div className="h-full flex flex-col animate-fade-in gap-4 relative">
        <div className="shrink-0 flex items-center gap-4 bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
             <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400"><Sparkles size={24} /></div>
             <div><h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('askTitle')}</h1><p className="text-sm text-slate-500 dark:text-slate-400">{t('askDesc')}</p></div>
             <div className="ml-auto text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{t('contextLoaded', { count: entries.length.toString() })}</div>
        </div>
        <div className="flex-1 bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm relative flex flex-col shadow-sm">
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                {history.length === 0 && <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center opacity-60"><MessageSquare size={48} className="mb-4" /><p className="text-lg">{t('askPlaceholder')}</p></div>}
                {history.map((msg, idx) => (<div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] lg:max-w-[70%] p-5 rounded-2xl shadow-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'}`}>{msg.role === 'model' ? <div>{renderMessageContent(msg.text)}</div> : msg.text}</div></div>))}
                {isProcessing && <div className="flex justify-start"><div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl rounded-bl-none flex items-center gap-2 shadow-sm"><Loader2 size={16} className="animate-spin text-indigo-500" /><span className="text-sm text-slate-500 dark:text-slate-400">AI is thinking...</span></div></div>}
                <div ref={chatEndRef} />
            </div>
            <div className="shrink-0 p-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 backdrop-blur-sm">
                <div className="flex gap-2">
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={t('chatPlaceholder')} disabled={isProcessing || loading} className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50" />
                    <button onClick={handleSendMessage} disabled={isProcessing || !input.trim() || loading} className="p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors disabled:opacity-50"><Send size={20} /></button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default AskGemini;
