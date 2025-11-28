
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useSession } from '../context/SessionContext';
import { db } from '../services/db';
import { geminiService } from '../services/geminiService';
import { ChatMessage, DiaryEntry, EntryMode, Mood } from '../types';
import { Sparkles, Send, Loader2, MessageSquare, Save, RotateCcw, Clock, History as HistoryIcon, ChevronDown, X, Play } from 'lucide-react';
import { useTranslation } from '../services/translations';
import { useNavigate } from 'react-router-dom';
import { FilterState } from '../components/FilterPanel';
import { markdownService } from '../services/markdown';
import { SpeechInput } from '../components/SpeechInput';
import { TextToSpeech } from '../components/TextToSpeech';

const AskGemini: React.FC = () => {
  const { user } = useAuth();
  const { aiConfig } = useConfig();
  const { askHistory, setAskHistory, clearSession } = useSession();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // UI States
  const [showRecents, setShowRecents] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [previousSessions, setPreviousSessions] = useState<DiaryEntry[]>([]);

  useEffect(() => {
    const fetchEntries = async () => {
      if (user) {
        setLoading(true);
        try { 
            const data = await db.getEntries(user.id);
            setEntries(data);
            
            // Filter for previous Ask AI sessions (EntryMode.Chat with no title usually, or specific tag)
            // Ideally we filter by mode Chat. Note: New Entry chat also uses 'Chat', but that's fine.
            const sessions = data.filter(e => e.mode === EntryMode.Chat).sort((a,b) => b.timestamp - a.timestamp);
            setPreviousSessions(sessions);
        } catch (e) { console.error(e); } finally { setLoading(false); }
      }
    };
    fetchEntries();
  }, [user]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [askHistory, isProcessing]);

  // Event Delegation for links within generated Markdown
  useEffect(() => {
      const container = messagesContainerRef.current;
      if (!container) return;

      const handleLinkClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          const link = target.closest('a');
          if (!link) return;

          const href = link.getAttribute('href');
          if (href?.startsWith('entry:')) {
              e.preventDefault();
              const id = href.split(':')[1];
              const entry = entries.find(e => e.id === id);
              if (id) {
                  navigate('/history', { state: { entryId: id, date: entry?.timestamp || 0 } });
              }
          } else if (href?.startsWith('graph:')) {
              e.preventDefault();
              const params = href.split(':')[1];
              handleGraphPattern(params);
          }
      };

      container.addEventListener('click', handleLinkClick);
      return () => container.removeEventListener('click', handleLinkClick);
  }, [entries]);

  const handleSendMessage = async () => {
      if (!input.trim() || isProcessing || !user) return;
      const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
      const newHistory = [...askHistory, userMsg];
      setAskHistory(newHistory);
      setInput('');
      setIsProcessing(true);

      try {
          const total = entries.length;
          const avgSentiment = entries.reduce((acc, e) => acc + e.analysis.sentimentScore, 0) / (total || 1);
          const moodCounts = entries.reduce((acc, e) => { acc[e.analysis.mood] = (acc[e.analysis.mood] || 0) + 1; return acc; }, {} as Record<string, number>);
          const statsStr = `Total Entries: ${total}. Avg Sentiment: ${avgSentiment.toFixed(2)}. Moods: ${JSON.stringify(moodCounts)}.`;

          const response = await geminiService.chatWithData(newHistory, userMsg.text, entries, statsStr, user.preferences, aiConfig);
          setAskHistory(prev => [...prev, { role: 'model', text: response, timestamp: Date.now() }]);
      } catch (e) { console.error(e); setAskHistory(prev => [...prev, { role: 'model', text: "Error analyzing memories.", timestamp: Date.now() }]); } finally { setIsProcessing(false); }
  };

  const handleGraphPattern = (paramsString: string) => {
      const appliedFilters: FilterState = {
          startDate: '', endDate: '', text: '',
          selectedMoods: [], selectedTags: [], selectedEntities: [], 
          selectedEntityTypes: [],
          selectedCountries: [], selectedCities: [], media: []
      };

      const params = paramsString.split(',');
      params.forEach(p => {
          const [key, val] = p.split('=').map(s => s.trim());
          if (!key || !val) return;

          switch(key) {
              case 'mood': appliedFilters.selectedMoods.push(val); break;
              case 'tag': appliedFilters.selectedTags.push(val); break;
              case 'entity': appliedFilters.selectedEntities.push(val); break;
              case 'entityType': appliedFilters.selectedEntityTypes.push(val); break;
              case 'country': appliedFilters.selectedCountries.push(val); break;
              case 'city': appliedFilters.selectedCities.push(val); break;
              case 'startDate': appliedFilters.startDate = val; break;
              case 'endDate': appliedFilters.endDate = val; break;
          }
      });

      navigate('/graph', { state: { appliedFilters } });
  };

  const renderMessageContent = (text: string) => {
      let processed = text.replace(/\[\[ENTRY:([^|]+)\|([^\]]+)\]\]/g, '[$2](entry:$1)');
      processed = processed.replace(/\[\[GRAPH:([^|]+)\|([^\]]+)\]\]/g, '[$1](graph:$2)');

      return (
          <div 
            className="prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-slate-800 dark:prose-headings:text-slate-100 prose-ul:my-2 prose-li:my-0.5 text-sm md:text-base"
            dangerouslySetInnerHTML={{ __html: markdownService.render(processed) }} 
          />
      );
  };

  const handleSaveSession = async () => {
      if (!user || askHistory.length === 0) return;
      setIsProcessing(true);
      try {
          // Flatten history for analysis
          const content = JSON.stringify(askHistory);
          const transcript = askHistory.map(m => `${m.role}: ${m.text}`).join('\n');
          const analysis = await geminiService.analyzeEntry(transcript, user.preferences, aiConfig);
          
          const entry: DiaryEntry = {
              id: crypto.randomUUID(),
              userId: user.id,
              timestamp: Date.now(),
              content,
              mode: EntryMode.Chat,
              analysis: { ...analysis, manualTags: [...(analysis.manualTags || []), 'AskAI'] },
              images: [],
              audio: []
          };
          
          await db.saveEntry(entry);
          
          // Refresh previous sessions
          const data = await db.getEntries(user.id);
          setPreviousSessions(data.filter(e => e.mode === EntryMode.Chat).sort((a,b) => b.timestamp - a.timestamp));
          setEntries(data); // Refresh main entries for context too

          alert(t('sessionSaved'));
      } catch (e) {
          console.error(e);
          alert("Failed to save session");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleNewSession = () => {
      if (askHistory.length > 0) {
          if (!confirm(t('confirmReset'))) return;
      }
      clearSession('ask');
  };

  const loadSession = (entry: DiaryEntry) => {
      try {
          const history = JSON.parse(entry.content);
          if (Array.isArray(history)) {
              setAskHistory(history);
              setShowHistoryModal(false);
              setShowRecents(false);
          }
      } catch (e) {
          alert("Could not load malformed session data.");
      }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in gap-4 relative">
        {/* Header & Toolbar */}
        <div className="shrink-0 flex flex-col gap-2 bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400"><Sparkles size={24} /></div>
                <div><h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('askTitle')}</h1><p className="text-sm text-slate-500 dark:text-slate-400">{t('askDesc')}</p></div>
                <div className="ml-auto text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full hidden md:block">{t('contextLoaded', { count: entries.length.toString() })}</div>
             </div>
             
             {/* Toolbar */}
             <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                <button onClick={handleSaveSession} disabled={isProcessing || askHistory.length === 0} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 rounded-lg transition-colors disabled:opacity-50">
                    <Save size={14} /> {t('saveSession')}
                </button>
                <button onClick={handleNewSession} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <RotateCcw size={14} /> {t('newSession')}
                </button>
                
                <div className="relative">
                    <button onClick={() => setShowRecents(!showRecents)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <Clock size={14} /> {t('recents')} <ChevronDown size={12} />
                    </button>
                    {showRecents && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-2">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 px-2">Last 10 Sessions</h4>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                                {previousSessions.slice(0, 10).map(s => (
                                    <button key={s.id} onClick={() => loadSession(s)} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs truncate">
                                        <div className="font-bold text-slate-700 dark:text-slate-300">{new Date(s.timestamp).toLocaleDateString()}</div>
                                        <div className="text-slate-500 truncate">{s.analysis.summary}</div>
                                    </button>
                                ))}
                                {previousSessions.length === 0 && <div className="text-xs text-slate-400 px-2 py-2">No saved sessions.</div>}
                            </div>
                        </div>
                    )}
                </div>

                <button onClick={() => setShowHistoryModal(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <HistoryIcon size={14} /> {t('historySession')}
                </button>
             </div>
        </div>

        <div className="flex-1 bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm relative flex flex-col shadow-sm">
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                {askHistory.length === 0 && <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center opacity-60"><MessageSquare size={48} className="mb-4" /><p className="text-lg">{t('askPlaceholder')}</p></div>}
                {askHistory.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[95%] lg:max-w-[85%] p-5 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'}`}>
                            <div className="flex items-start gap-2">
                                <div className="flex-1">
                                    {msg.role === 'model' ? renderMessageContent(msg.text) : msg.text}
                                </div>
                                <div className="mt-1 opacity-70 shrink-0">
                                    <TextToSpeech text={msg.text} size={14} className={msg.role === 'user' ? 'text-white/70 hover:text-white hover:bg-white/20' : ''} />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {isProcessing && <div className="flex justify-start"><div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl rounded-bl-none flex items-center gap-2 shadow-sm"><Loader2 size={16} className="animate-spin text-indigo-500" /><span className="text-sm text-slate-500 dark:text-slate-400">AI is thinking...</span></div></div>}
                <div ref={chatEndRef} />
            </div>
            <div className="shrink-0 p-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 backdrop-blur-sm">
                <div className="flex gap-2">
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={t('chatPlaceholder')} disabled={isProcessing || loading} className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50" />
                    <SpeechInput onSpeechResult={(text) => setInput(prev => prev + " " + text)} />
                    <button onClick={handleSendMessage} disabled={isProcessing || !input.trim() || loading} className="p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors disabled:opacity-50"><Send size={20} /></button>
                </div>
            </div>
        </div>

        {/* History Modal */}
        {showHistoryModal && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Ask AI History</h3>
                        <button onClick={() => setShowHistoryModal(false)}><X size={20} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                        {previousSessions.map(s => (
                            <div key={s.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex justify-between items-center group">
                                <div>
                                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">{new Date(s.timestamp).toLocaleString()}</div>
                                    <p className="text-sm text-slate-500 line-clamp-2 max-w-md">{s.analysis.summary}</p>
                                    <div className="flex gap-2 mt-2">
                                        {s.analysis.manualTags?.map(tag => <span key={tag} className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">#{tag}</span>)}
                                    </div>
                                </div>
                                <button onClick={() => loadSession(s)} className="p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-900/50">
                                    <Play size={16} />
                                </button>
                            </div>
                        ))}
                        {previousSessions.length === 0 && <div className="text-center p-8 text-slate-500">No history found.</div>}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default AskGemini;
