
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { db } from '../services/db';
import { geminiService } from '../services/geminiService';
import { ChatMessage, EntryMode, DiaryEntry, Mood, CatalogEntry } from '../types';
import { Mic, Send, Save, FileText, Loader2, Sparkles, Upload, X, Check, Database, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../services/translations';
import { AudioRecorder } from '../components/AudioRecorder';

const Interview: React.FC = () => {
  const { user } = useAuth();
  const { aiConfig } = useConfig();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'chat' | 'import'>('chat');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [importText, setImportText] = useState('');
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [analyzingCatalog, setAnalyzingCatalog] = useState(false);
  const [proposedItems, setProposedItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, isProcessing]);

  const handleSendMessage = async () => {
    if (isProcessing || !chatInput.trim()) return;
    const newUserMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
    setChatHistory(prev => [...prev, newUserMsg]);
    setChatInput('');
    setIsProcessing(true);

    const response = await geminiService.chat(
        [...chatHistory, newUserMsg], 
        newUserMsg.text, 
        user?.preferences?.systemPrompt, 
        user?.preferences || 'English', 
        user?.bio, 
        'Interview',
        aiConfig
    );
    
    setChatHistory(prev => [...prev, { role: 'model', text: response.text, timestamp: Date.now(), sentimentScore: response.sentimentScore }]);
    setIsProcessing(false);
  };

  const handleAudioSave = (base64: string) => {
      setChatHistory(prev => [...prev, { role: 'user', text: "[Audio Recording]", timestamp: Date.now() }]);
      setTimeout(() => setChatHistory(prev => [...prev, { role: 'model', text: "Audio received.", timestamp: Date.now() }]), 1000);
  };

  const handleSaveEntry = async () => {
    if (!user) return;
    let contentToAnalyze = mode === 'import' ? importText : chatHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
    if (!contentToAnalyze.trim()) return alert("Content empty");
    setIsProcessing(true);
    try {
        const analysis = await geminiService.analyzeEntry(contentToAnalyze, user.preferences, aiConfig);
        const newId = crypto.randomUUID();
        await db.saveEntry({
            id: newId, userId: user.id, timestamp: Date.now(), content: mode === 'import' ? importText : JSON.stringify(chatHistory),
            mode: mode === 'chat' ? EntryMode.Chat : EntryMode.Manual, analysis: { ...analysis, manualTags: [...(analysis.manualTags || []), 'Interview'] },
            image: undefined, images: [], audio: []
        });
        setSavedEntryId(newId);
        alert(t('saved'));
    } catch (e) { console.error(e); alert("Failed to save."); } finally { setIsProcessing(false); }
  };

  const handleAnalyzeCatalog = async () => {
      if (!user) return;
      let textContent = mode === 'import' ? importText : chatHistory.map(m => m.text).join("\n");
      if (!textContent.trim()) return;
      setAnalyzingCatalog(true);
      try {
          const items = await geminiService.extractCatalog(textContent, user.preferences, aiConfig);
          setProposedItems(items);
          setSelectedItems(new Set(items.map((_, i) => i)));
          setShowCatalogModal(true);
      } catch (e) { console.error(e); alert("Analysis failed"); } finally { setAnalyzingCatalog(false); }
  };

  const handleSaveCatalog = async () => {
      if (!user || !savedEntryId) return alert("Save interview first.");
      const itemsToSave = proposedItems.filter((_, i) => selectedItems.has(i));
      try {
          for (const item of itemsToSave) await db.saveCatalogEntry({ id: crypto.randomUUID(), userId: user.id, sourceEntryId: savedEntryId, name: item.name, type: item.type, description: item.description, tags: item.tags || [], timestamp: Date.now() });
          setShowCatalogModal(false); alert("Catalog updated!");
      } catch (e) { alert("Failed to save catalog items"); }
  };

  return (
    <div className="h-full flex flex-col gap-4 relative animate-fade-in">
      <div className="shrink-0 flex justify-between items-center bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4"><div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400"><Mic size={24} /></div><div><h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('interviewTitle')}</h1><p className="text-sm text-slate-500 dark:text-slate-400">{t('interviewDesc')}</p></div></div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            <button onClick={() => setMode('chat')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'chat' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}><MessageCircle size={16} /> {t('chatMode')}</button>
            <button onClick={() => setMode('import')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'import' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}><FileText size={16} /> {t('importMode')}</button>
        </div>
      </div>
      <div className="flex-1 bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm relative flex flex-col shadow-sm">
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {mode === 'chat' ? (
                  <div className="space-y-6">
                      {chatHistory.length === 0 && <div className="text-center text-slate-500 mt-10"><p>{t('interviewPlaceholder')}</p></div>}
                      {chatHistory.map((msg, idx) => (<div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 rounded-bl-none'}`}>{msg.text}</div></div>))}
                      {isProcessing && <div className="flex justify-start animate-fade-in"><div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl rounded-bl-none flex items-center gap-1.5"><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></div></div></div>}
                      <div ref={chatEndRef} />
                  </div>
              ) : (
                  <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder={t('importPlaceholder')} className="w-full h-full bg-transparent border-none focus:ring-0 resize-none text-slate-800 dark:text-slate-200" />
              )}
          </div>
          <div className="shrink-0 p-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 backdrop-blur-sm">
              {mode === 'chat' && (
                  <div className="flex gap-2 mb-4">
                      <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isProcessing && handleSendMessage()} placeholder={t('chatPlaceholder')} disabled={isProcessing} className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500" />
                      <button onClick={handleSendMessage} disabled={isProcessing || !chatInput.trim()} className="p-3 bg-indigo-600 rounded-xl text-white hover:bg-indigo-50 disabled:opacity-50">{isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}</button>
                  </div>
              )}
              <div className="flex justify-between items-center">
                  <div className="flex gap-2">{mode === 'chat' && <div className="flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-800 rounded-lg"><span className="text-xs font-bold text-slate-500 uppercase mr-1">Audio</span><AudioRecorder onSave={handleAudioSave} /></div>}</div>
                  <div className="flex gap-3">
                      {savedEntryId && <button onClick={handleAnalyzeCatalog} disabled={analyzingCatalog} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50">{analyzingCatalog ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}{t('analyzeCatalog')}</button>}
                      <button onClick={handleSaveEntry} disabled={isProcessing} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50">{isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}{t('save')}</button>
                  </div>
              </div>
          </div>
      </div>
      {showCatalogModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center"><div><h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('catalogProposal')}</h2></div><button onClick={() => setShowCatalogModal(false)}><X size={24} /></button></div>
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar"><div className="space-y-4">{proposedItems.map((item, idx) => (<div key={idx} onClick={() => { const s = new Set(selectedItems); if (s.has(idx)) s.delete(idx); else s.add(idx); setSelectedItems(s); }} className={`p-4 rounded-xl border cursor-pointer ${selectedItems.has(idx) ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 border-slate-200'}`}><div className="flex justify-between items-start mb-2"><div className="flex items-center gap-2"><div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedItems.has(idx) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-400'}`}>{selectedItems.has(idx) && <Check size={14} className="text-white" />}</div><h3 className="font-bold text-slate-900 dark:text-slate-100">{item.name}</h3><span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium uppercase">{t('cat_' + item.type)}</span></div></div><p className="text-sm text-slate-600 dark:text-slate-400 mb-2 pl-7">{item.description}</p></div>))}</div></div>
                  <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-b-2xl">
                      <div className="text-sm text-slate-500">{selectedItems.size} selected</div>
                      <div className="flex gap-3"><button onClick={() => setShowCatalogModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">{t('cancel')}</button><button onClick={handleSaveCatalog} disabled={selectedItems.size === 0} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500">{t('saveToCatalog')}</button></div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Interview;
