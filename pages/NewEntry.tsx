
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { db } from '../services/db';
import { geminiService } from '../services/geminiService';
import { ChatMessage, EntryMode, DiaryEntry, CatalogEntry } from '../types';
import { Save, Send, Loader2, MessageCircle, PenLine, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../services/translations';
import { EntryEditor } from '../components/EntryEditor';
import { AudioRecorder } from '../components/AudioRecorder';

const NewEntry: React.FC = () => {
  const { user } = useAuth();
  const { aiConfig } = useConfig();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const locationObj = useLocation();
  const [mode, setMode] = useState<EntryMode>(EntryMode.Manual);
  
  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [initialDate, setInitialDate] = useState<Date | undefined>(undefined);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const state = locationObj.state as { date?: number } | null;
      if (state?.date) setInitialDate(new Date(state.date));
  }, [locationObj.state]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isProcessing]);

  const handleSendMessage = async () => {
    if (isProcessing || !chatInput.trim()) return;

    const newUserMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
    const nextHistory = [...chatHistory, newUserMsg];
    setChatHistory(nextHistory);
    const messageToSend = chatInput;
    setChatInput('');
    setIsProcessing(true);

    const response = await geminiService.chat(
        chatHistory, 
        messageToSend, 
        user?.preferences?.systemPrompt, 
        user?.preferences || 'English', 
        user?.bio,
        'Diary',
        aiConfig
    );
    
    setChatHistory(prev => [...prev, { role: 'model', text: response.text, timestamp: Date.now(), sentimentScore: response.sentimentScore }]);
    setIsProcessing(false);
  };

  const handleAudioSaveChat = (base64: string) => { setChatInput("[Audio Attached]"); };

  const saveChatEntry = async () => {
      if (chatHistory.length === 0) return alert("Conversation is empty!");
      await performSave({
          content: JSON.stringify(chatHistory),
          tags: manualTags,
          date: new Date(),
          location: undefined,
          locationDetails: {},
          images: [],
          audio: []
      });
  };

  const performSave = async (data: any) => {
      if (!user) return;
      setIsProcessing(true);
      try {
          let contentToAnalyze = mode === EntryMode.Manual ? data.content : chatHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
          const analysis = await geminiService.analyzeEntry(contentToAnalyze, user.preferences, aiConfig);
          analysis.manualTags = data.tags;

          const newEntryId = crypto.randomUUID();
          if (analysis.entities && analysis.entities.length > 0) {
            const currentCatalog = await db.getCatalog(user.id);
            for (const entity of analysis.entities) {
                if (!currentCatalog.some(item => item.name.toLowerCase() === entity.name.toLowerCase())) {
                    await db.saveCatalogEntry({
                        id: crypto.randomUUID(), userId: user.id, sourceEntryId: newEntryId, name: entity.name, type: entity.type, description: `Extracted from entry`, tags: [], timestamp: Date.now()
                    });
                }
            }
          }

          await db.saveEntry({
              id: newEntryId, userId: user.id, timestamp: data.date.getTime(), content: data.content, mode: mode, location: data.location,
              country: data.locationDetails.country, city: data.locationDetails.city, address: data.locationDetails.address,
              image: data.images.length > 0 ? data.images[0] : undefined, images: data.images, audio: data.audio, analysis: analysis
          });
          navigate('/');
      } catch (e) { console.error(e); alert("Failed to save entry."); } finally { setIsProcessing(false); }
  };

  const handleExportChat = () => {
      if (chatHistory.length === 0) { alert(t('noChatHistory')); return; }
      const blob = new Blob([JSON.stringify(chatHistory, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `chat_export_${new Date().toISOString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col gap-4 relative">
      <div className="shrink-0 flex items-center gap-3 bg-white/80 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                <button onClick={() => setMode(EntryMode.Manual)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === EntryMode.Manual ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                    <PenLine size={16} /> {t('manualEntry')}
                </button>
                <button onClick={() => setMode(EntryMode.Chat)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === EntryMode.Chat ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                    <MessageCircle size={16} /> {t('aiCompanion')}
                </button>
            </div>
      </div>

      <div className="flex-1 bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm relative flex flex-col shadow-sm">
        {mode === EntryMode.Manual ? (
            <div className="h-full p-4 overflow-y-auto custom-scrollbar">
                <EntryEditor onSave={performSave} saveLabel={t('saveAnalyze')} autosaveKey={user?.id} initialEntry={initialDate ? { timestamp: initialDate.getTime() } as any : undefined} />
            </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
               {chatHistory.length === 0 && <div className="text-center text-slate-500 mt-10"><p>{t('chatStart')}</p></div>}
               {chatHistory.map((msg, idx) => (
                 <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 rounded-bl-none'}`}>{msg.text}</div>
                 </div>
               ))}
               {isProcessing && <div className="flex justify-start animate-fade-in"><div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl rounded-bl-none flex items-center gap-1.5"><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></div><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></div></div></div>}
               <div ref={chatEndRef} />
            </div>
            
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                 <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {manualTags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md flex items-center gap-1">#{tag} <button onClick={() => setManualTags(t => t.filter(x => x !== tag))}><X size={10}/></button></span>
                    ))}
                    <input type="text" placeholder="+ Tag" className="bg-transparent text-xs outline-none w-16" onKeyDown={(e) => { if(e.key === 'Enter') { const val = e.currentTarget.value.trim(); if(val) setManualTags(p => [...p, val]); e.currentTarget.value = ''; } }} />
                 </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isProcessing && handleSendMessage()} placeholder={isProcessing ? "AI is replying..." : t('chatPlaceholder')} disabled={isProcessing} className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50" />
                <button onClick={handleSendMessage} disabled={isProcessing || !chatInput.trim()} className="p-3 bg-indigo-600 rounded-xl text-white hover:bg-indigo-50 disabled:opacity-50 transition-colors">{isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}</button>
              </div>
              <div className="flex justify-between items-center">
                  <div className="flex gap-2"><AudioRecorder onSave={handleAudioSaveChat} /></div>
                  <div className="flex gap-2">
                      <button onClick={handleExportChat} disabled={isProcessing} className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 uppercase">{t('exportChat')}</button>
                      <button onClick={saveChatEntry} disabled={isProcessing} className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 uppercase"><Save size={14} /> Save Chat</button>
                  </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewEntry;
