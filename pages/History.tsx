
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { db } from '../services/db';
import { geminiService } from '../services/geminiService';
import { DiaryEntry, EntryMode, ChatMessage, Mood, CatalogEntry, AnalysisResult } from '../types';
import { Trash2, MapPin, Smile, Search, Sparkles, Edit2, Filter, Image as ImageIcon, Volume2, Square, MessageCircle, FileText, X, User, Book, Video, Lightbulb, Flag, Map as MapIcon } from 'lucide-react';
import { useTranslation } from '../services/translations';
import { FilterPanel, FilterState } from '../components/FilterPanel';
import { searchService } from '../services/searchService';
import { markdownService } from '../services/markdown';
import { useLocation } from 'react-router-dom';
import { EntryEditor } from '../components/EntryEditor';
import { MediaGallery } from '../components/MediaGallery';
import { appConfig } from '../config/appConfig';

declare global {
    interface Window {
        mermaid: any;
    }
}

const History: React.FC = () => {
  const { user } = useAuth();
  const { aiConfig } = useConfig();
  const { t } = useTranslation();
  const location = useLocation();
  
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [targetEntryId, setTargetEntryId] = useState<string | null>(null);
  
  const [filterIds, setFilterIds] = useState<string[] | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
      startDate: '',
      endDate: '',
      text: '',
      selectedMoods: [],
      selectedTags: [],
      selectedEntities: [],
      selectedEntityTypes: [],
      selectedCountries: [],
      selectedCities: [],
      media: []
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
      const saved = localStorage.getItem(appConfig.storageKeys.HISTORY_SIDEBAR_WIDTH);
      return saved ? parseInt(saved, 10) : appConfig.ui.defaultHistorySidebarWidth;
  });
  const isResizing = useRef(false);

  useEffect(() => {
    const fetchEntries = async () => {
        if (user) {
            setLoading(true);
            try {
                const data = await db.getEntries(user.id);
                setEntries(data);
                if (data.length > 0 && !selectedEntry) setSelectedEntry(data[0]);
            } catch (e) { console.error(e); } 
            finally { setLoading(false); }
        }
    };
    fetchEntries();
  }, [user]);

  // Handle Navigation State
  useEffect(() => {
      const state = location.state as { filterTag?: string; filterMood?: string; filterEntity?: string; entryId?: string; date?: number; entryIds?: string[] } | null;
      if (state?.filterTag) { setFilters(prev => ({ ...prev, selectedTags: [state.filterTag!] })); setShowFilters(true); setFilterIds(null); }
      if (state?.filterMood) { setFilters(prev => ({ ...prev, selectedMoods: [state.filterMood!] })); setShowFilters(true); setFilterIds(null); }
      if (state?.filterEntity) { setFilters(prev => ({ ...prev, selectedEntities: [state.filterEntity!] })); setShowFilters(true); setFilterIds(null); }
      if (state?.entryId && state?.date) {
          const d = new Date(state.date);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          setFilters(prev => ({ ...prev, startDate: dateStr, endDate: dateStr }));
          setShowFilters(true);
          setTargetEntryId(state.entryId);
          setFilterIds(null);
      }
      if (state?.entryIds && Array.isArray(state.entryIds)) {
          setFilterIds(state.entryIds);
          setFilters({ startDate: '', endDate: '', text: '', selectedMoods: [], selectedTags: [], selectedEntities: [], selectedEntityTypes: [], selectedCountries: [], selectedCities: [], media: [] });
      }
  }, [location.state]);

  // Select target entry
  useEffect(() => {
    if (targetEntryId && entries.length > 0) {
        const found = entries.find(e => e.id === targetEntryId);
        if (found) { setSelectedEntry(found); setTargetEntryId(null); }
    }
  }, [entries, targetEntryId]);

  // Mermaid & Links
  useEffect(() => {
    if (selectedEntry && !isEditing && window.mermaid) {
       window.mermaid.initialize({ startOnLoad: false, theme: 'default' });
       setTimeout(() => { window.mermaid.run({ querySelector: '.mermaid' }); }, 200);
    }
    const handleInternalLink = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const link = target.closest('a');
        if (link && link.getAttribute('href')?.startsWith('entry:')) {
            e.preventDefault();
            const id = link.getAttribute('href')?.split(':')[1];
            const entry = entries.find(en => en.id === id);
            if (entry) setSelectedEntry(entry);
        }
    };
    const container = document.getElementById('history-content-container');
    if (container) container.addEventListener('click', handleInternalLink);
    return () => { if (container) container.removeEventListener('click', handleInternalLink); };
  }, [selectedEntry, isEditing, entries]);

  // Reset editing
  useEffect(() => {
    setIsEditing(false);
    setIsSpeaking(false);
    window.speechSynthesis.cancel();
  }, [selectedEntry?.id]);

  // Resizing Logic
  const startResizing = useCallback(() => {
      isResizing.current = true;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
  }, []);
  const stopResizing = useCallback(() => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
  }, []);
  const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX; 
      if (newWidth > appConfig.ui.minSidebarWidth && newWidth < appConfig.ui.maxSidebarWidth) setSidebarWidth(newWidth);
  }, []);
  useEffect(() => { localStorage.setItem(appConfig.storageKeys.HISTORY_SIDEBAR_WIDTH, sidebarWidth.toString()); }, [sidebarWidth]);

  // Filters
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    entries.forEach(e => e.analysis.manualTags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [entries]);
  
  const availableEntities = useMemo(() => {
      const entities = new Set<string>();
      entries.forEach(e => e.analysis.entities?.forEach(ent => {
          // Filter entities based on Selected Entity Types if any are selected
          if (filters.selectedEntityTypes.length > 0) {
              if (!filters.selectedEntityTypes.includes(ent.type)) return;
          }
          entities.add(ent.name);
      }));
      return Array.from(entities).sort();
  }, [entries, filters.selectedEntityTypes]);

  const availableCountries = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => { if (e.country) s.add(e.country); });
    return Array.from(s).sort();
  }, [entries]);
  const availableCities = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => { if (e.city) s.add(e.city); });
    return Array.from(s).sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (filterIds) result = result.filter(e => filterIds.includes(e.id));
    return searchService.filterEntries(result, filters);
  }, [entries, filters, filterIds]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const entryToDelete = entries.find(e => e.id === id);
    const summary = entryToDelete?.analysis.summary ? `"${entryToDelete.analysis.summary.substring(0, 60)}..."` : 'this entry';
    if (confirm(`${t('deleteConfirm')}\n\n${summary}`)) {
      try {
          await db.deleteEntry(id);
          const updated = entries.filter(ent => ent.id !== id);
          setEntries(updated);
          if (selectedEntry?.id === id) setSelectedEntry(updated.length > 0 ? updated[0] : null);
      } catch (e) { alert("Failed to delete entry"); }
    }
  };

  const saveEdit = async (data: any) => {
    if (!selectedEntry) return;
    
    let newAnalysis: AnalysisResult = { ...selectedEntry.analysis };
    
    try {
      // Attempt to re-analyze, but fall back to existing analysis if it fails (e.g. offline/error)
      newAnalysis = await geminiService.analyzeEntry(data.content, user?.preferences || 'English', aiConfig);
    } catch (error) {
      console.warn("AI analysis failed, preserving old analysis with new tags.", error);
    }

    try {
      newAnalysis.manualTags = data.tags;

      if (newAnalysis.entities && newAnalysis.entities.length > 0 && user) {
          const currentCatalog = await db.getCatalog(user.id);
          for (const entity of newAnalysis.entities) {
              const exists = currentCatalog.some(item => item.name.toLowerCase() === entity.name.toLowerCase());
              if (!exists) {
                  const catalogItem: CatalogEntry = {
                      id: crypto.randomUUID(),
                      userId: user.id,
                      sourceEntryId: selectedEntry.id,
                      name: entity.name,
                      type: entity.type,
                      description: `Extracted from entry on ${new Date(selectedEntry.timestamp).toLocaleDateString()}`,
                      tags: [],
                      timestamp: Date.now()
                  };
                  await db.saveCatalogEntry(catalogItem);
              }
          }
      }

      const updatedEntry: DiaryEntry = {
        ...selectedEntry,
        timestamp: data.date.getTime(),
        content: data.content,
        mode: EntryMode.Manual,
        analysis: newAnalysis,
        location: data.location,
        country: data.locationDetails.country,
        city: data.locationDetails.city,
        address: data.locationDetails.address,
        image: data.images.length > 0 ? data.images[0] : undefined,
        images: data.images,
        audio: data.audio
      };

      await db.saveEntry(updatedEntry);
      setEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e).sort((a,b) => b.timestamp - a.timestamp));
      setSelectedEntry(updatedEntry);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save entry:", error);
      alert("Failed to save changes to database.");
    }
  };

  const speakEntry = () => {
      if (!selectedEntry) return;
      if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); return; }
      let textToSpeak = "";
      if (selectedEntry.mode === EntryMode.Manual) { textToSpeak = selectedEntry.content.replace(/[#*_`]/g, ''); } 
      else { try { const history: ChatMessage[] = JSON.parse(selectedEntry.content); textToSpeak = history.map(m => m.text).join(". "); } catch(e) { textToSpeak = "Conversation content." } }
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const userLang = user?.preferences?.language || 'English';
      utterance.lang = userLang === 'French' ? 'fr-FR' : 'en-US'; // Simplified map
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
  };

  const getMoodColor = (mood: Mood) => {
    switch (mood) {
        case Mood.Joyful: return 'bg-yellow-400';
        case Mood.Happy: return 'bg-green-400';
        case Mood.Neutral: return 'bg-slate-400';
        case Mood.Sad: return 'bg-blue-400';
        case Mood.Anxious: return 'bg-orange-400';
        case Mood.Angry: return 'bg-red-400';
        case Mood.Reflective: return 'bg-purple-400';
        case Mood.Tired: return 'bg-indigo-300';
        default: return 'bg-slate-400';
    }
  };

  const getEntityIcon = (type: string) => {
      switch(type) {
          case 'Person': return <User size={12} />;
          case 'Location': return <MapIcon size={12} />;
          case 'Event': return <Flag size={12} />;
          case 'Concept': return <Lightbulb size={12} />;
          case 'Book': return <Book size={12} />;
          case 'Movie': return <Video size={12} />;
          default: return <Sparkles size={12} />;
      }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">{t('loading')}</div>;

  return (
    <div className="h-full flex flex-col md:flex-row-reverse gap-0 relative overflow-hidden">
      {/* Sidebar List */}
      <div style={{ width: window.innerWidth >= 768 ? sidebarWidth : '100%' }} className="flex flex-col gap-3 shrink-0 h-full md:border-l border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 md:pl-2">
        <div className="p-2">
            <div className="md:hidden mb-2">
                <button onClick={() => setShowFilters(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"><Filter size={16} /> {t('filterTitle')}</button>
            </div>
            <div className="hidden md:block relative">
                {filterIds ? (
                    <div className="mb-2 p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm flex justify-between items-center">
                        <span>{filterIds.length} Selected</span>
                        <button onClick={() => setFilterIds(null)} className="hover:bg-indigo-200 dark:hover:bg-indigo-800 p-1 rounded"><X size={14}/></button>
                    </div>
                ) : (
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                        <input type="text" placeholder={t('searchPlaceholder')} value={filters.text} onChange={e => setFilters({...filters, text: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-9 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500" />
                        <button onClick={() => setShowFilters(!showFilters)} className={`absolute right-2 top-2 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${showFilters ? 'text-indigo-500' : 'text-slate-400'}`}><Filter size={16} /></button>
                    </div>
                )}
            </div>
        </div>
        <FilterPanel filters={filters} setFilters={setFilters} availableTags={availableTags} availableEntities={availableEntities} availableCountries={availableCountries} availableCities={availableCities} isOpen={showFilters} onClose={() => setShowFilters(false)} />
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 pl-2 pb-2 custom-scrollbar">
          {filteredEntries.map(entry => (
            <div key={entry.id} onClick={() => !isEditing && setSelectedEntry(entry)} className={`p-3 rounded-xl border cursor-pointer transition-all hover:border-indigo-500/50 group ${selectedEntry?.id === entry.id ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-500/50 shadow-md' : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'} ${isEditing ? 'pointer-events-none opacity-50' : ''}`}>
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {entry.mode === EntryMode.Chat ? <MessageCircle size={12} className="text-purple-400" /> : <FileText size={12} className="text-blue-400" />}
                </div>
                <div className={`w-2 h-2 rounded-full ${getMoodColor(entry.analysis.mood)}`} title={entry.analysis.mood} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 leading-relaxed">{entry.analysis.summary}</p>
              <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                  {(entry.images?.length || 0) > 0 && (<div className="flex items-center gap-0.5 text-[10px] text-slate-400"><ImageIcon size={10} /> {entry.images?.length}</div>)}
                  {(entry.audio?.length || 0) > 0 && (<div className="flex items-center gap-0.5 text-[10px] text-slate-400"><Volume2 size={10} /> {entry.audio?.length}</div>)}
                  {entry.city && (<div className="flex items-center gap-0.5 text-[10px] text-slate-400 truncate max-w-[80px]"><MapPin size={10} /> {entry.city}</div>)}
              </div>
            </div>
          ))}
          {filteredEntries.length === 0 && <div className="flex flex-col items-center justify-center h-20 text-slate-500 text-sm"><p>{t('noEntries')}</p></div>}
        </div>
      </div>

      <div onMouseDown={startResizing} className="hidden md:flex w-2 bg-transparent hover:bg-indigo-500/20 dark:hover:bg-indigo-400/20 cursor-col-resize items-center justify-center group transition-colors z-10"><div className="h-8 w-1 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-indigo-500 dark:group-hover:bg-indigo-400 transition-colors" /></div>

      {/* Detail / Edit View */}
      <div className="flex-1 min-h-0 h-full flex flex-col bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-r-none overflow-hidden backdrop-blur-md shadow-2xl">
        {selectedEntry ? (
          <>
            {isEditing ? (
                <div className="h-full overflow-hidden p-4">
                    <EntryEditor 
                        initialEntry={selectedEntry}
                        onSave={saveEdit} 
                        onCancel={() => setIsEditing(false)}
                    />
                </div>
            ) : (
                <>
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex justify-between items-start">
                        <div className="flex-1">
                            <div className="flex items-center gap-4 mb-3">
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{new Date(selectedEntry.timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
                                <button onClick={speakEntry} className={`p-2 rounded-full transition-colors ${isSpeaking ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600'}`} title={isSpeaking ? t('stopReading') : t('readAloud')}>
                                    {isSpeaking ? <Square size={16} fill="currentColor" /> : <Volume2 size={16} />}
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 text-sm font-medium"><Smile size={14} /> {t('mood_' + selectedEntry.analysis.mood)}</span>
                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 text-sm">Score: {selectedEntry.analysis.sentimentScore.toFixed(2)}</span>
                                {selectedEntry.location && (<a href={`https://www.google.com/maps/search/?api=1&query=${selectedEntry.location.lat},${selectedEntry.location.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20 text-sm transition-colors"><MapPin size={14} /> {selectedEntry.city ? `${selectedEntry.city}, ${selectedEntry.country}` : 'Location'}</a>)}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditing(true)} className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 rounded-xl transition-colors" title={t('edit')}><Edit2 size={18} /></button>
                            <button onClick={(e) => handleDelete(selectedEntry.id, e)} className="p-2.5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-xl transition-colors" title={t('delete')}><Trash2 size={18} /></button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="flex flex-wrap gap-2 mb-8">
                            {selectedEntry.analysis.entities?.map((ent, i) => (
                                <span key={`ent-${i}`} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-500/30">
                                    {getEntityIcon(ent.type)} {ent.name}
                                </span>
                            ))}
                            {selectedEntry.analysis.manualTags?.map((t, i) => (<span key={`manual-${i}`} className="text-xs font-medium px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-500/30">#{t}</span>))}
                        </div>
                        
                        <div className="mb-8 p-5 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 dark:from-indigo-900/20 dark:to-purple-900/20 dark:border-indigo-500/20 rounded-xl flex gap-4">
                            <div className="mt-1 text-indigo-600 dark:text-indigo-400"><Sparkles size={20} /></div>
                            <div>
                                <h5 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider mb-1">{t('aiInsight')}</h5>
                                <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{selectedEntry.analysis.summary}</p>
                            </div>
                        </div>

                        {/* Unified Media Gallery */}
                        <div className="mb-8">
                            <MediaGallery 
                                images={selectedEntry.images && selectedEntry.images.length > 0 ? selectedEntry.images : (selectedEntry.image ? [selectedEntry.image] : [])} 
                                audio={selectedEntry.audio} 
                            />
                        </div>
                        
                        <div id="history-content-container" className="prose dark:prose-invert max-w-none leading-relaxed text-lg" dangerouslySetInnerHTML={{ __html: selectedEntry.mode === EntryMode.Manual ? markdownService.render(selectedEntry.content) : '' }} />
                        {selectedEntry.mode === EntryMode.Chat && (
                            <div className="space-y-6">
                                {(() => {
                                    try {
                                        const history: ChatMessage[] = JSON.parse(selectedEntry.content);
                                        return history.map((msg, idx) => (
                                            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                                <span className="text-xs text-slate-500 mb-1 capitalize opacity-70">{msg.role === 'user' ? 'You' : 'Gemini'}</span>
                                                <div className={`px-5 py-3 rounded-2xl max-w-[85%] shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 rounded-bl-sm'}`}>{msg.text}</div>
                                            </div>
                                        ));
                                    } catch(e) { return null; }
                                })()}
                            </div>
                        )}
                    </div>
                </>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-full mb-4"><Search size={32} className="opacity-50" /></div>
            <p className="text-lg font-medium">{t('searchPlaceholder')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
