
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { DiaryEntry } from '../types';
import { Tag, Hash, Plus, Edit2, Trash2, Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../services/translations';

const TagsView: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Rename State
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<{tag: string, count: number} | null>(null);

  useEffect(() => {
    const fetchEntries = async () => {
      if (user) {
        setLoading(true);
        const data = await db.getEntries(user.id);
        setEntries(data);
        setLoading(false);
      }
    };
    fetchEntries();
  }, [user]);

  // Aggregate tags from Entries + User Preferences
  const tagStats = useMemo(() => {
    const stats: Record<string, number> = {};
    const processedTags = new Set<string>();

    // 1. Count from entries
    entries.forEach(entry => {
      const allTags = [
        ...(entry.analysis.manualTags || [])
      ];
      const uniqueEntryTags = new Set(allTags);
      uniqueEntryTags.forEach(tag => {
        const normalized = tag; 
        stats[normalized] = (stats[normalized] || 0) + 1;
        processedTags.add(normalized);
      });
    });

    // 2. Add saved tags from preferences (count 0 if unused)
    if (user?.preferences?.savedTags) {
        user.preferences.savedTags.forEach(tag => {
            if (!processedTags.has(tag)) {
                stats[tag] = 0;
            }
        });
    }
    
    return Object.entries(stats)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => {
          // Sort by count DESC, then alpha
          if (b.count !== a.count) return b.count - a.count;
          return a.tag.localeCompare(b.tag);
      });
  }, [entries, user?.preferences?.savedTags]);

  const handleAddTag = async () => {
    if (!user || !newTagInput.trim()) return;
    const tagToAdd = newTagInput.trim();
    
    // Check if exists
    if (tagStats.some(t => t.tag.toLowerCase() === tagToAdd.toLowerCase())) {
        setNewTagInput('');
        return;
    }

    try {
        const currentSaved = user.preferences.savedTags || [];
        await updateProfile({
            preferences: {
                ...user.preferences,
                savedTags: [...currentSaved, tagToAdd]
            }
        });
        setNewTagInput('');
    } catch (e) {
        console.error("Failed to add tag", e);
    }
  };

  const handleRenameClick = (tag: string) => {
      setEditingTag(tag);
      setRenameInput(tag);
  };

  const confirmRename = async () => {
      if (!user || !editingTag || !renameInput.trim() || renameInput === editingTag) {
          setEditingTag(null);
          return;
      }

      setProcessing(true);
      const oldTag = editingTag;
      const newTag = renameInput.trim();

      try {
          // 1. Update Entries
          const entriesToUpdate = entries.filter(e => 
             e.analysis.manualTags?.includes(oldTag)
          );

          let updateCount = 0;
          for (const entry of entriesToUpdate) {
              const updatedEntry = { ...entry };
              
              // Update manual tags
              if (updatedEntry.analysis.manualTags?.includes(oldTag)) {
                  updatedEntry.analysis.manualTags = updatedEntry.analysis.manualTags.map(t => t === oldTag ? newTag : t);
              }
              
              await db.saveEntry(updatedEntry);
              updateCount++;
          }

          // 2. Update User Preferences (Saved Tags)
          let currentSaved = user.preferences.savedTags || [];
          if (currentSaved.includes(oldTag)) {
              currentSaved = currentSaved.map(t => t === oldTag ? newTag : t);
              // Dedupe if newTag already existed in saved
              currentSaved = Array.from(new Set(currentSaved));
              
              await updateProfile({
                  preferences: {
                      ...user.preferences,
                      savedTags: currentSaved
                  }
              });
          }

          // 3. Refresh Local State
          const newData = await db.getEntries(user.id);
          setEntries(newData);
          alert(t('tagRenamed', { count: updateCount.toString() }));

      } catch (e) {
          console.error("Rename failed", e);
          alert("Rename failed.");
      } finally {
          setProcessing(false);
          setEditingTag(null);
      }
  };

  const confirmDelete = (tag: string, count: number) => {
      setDeleteTarget({ tag, count });
  };

  const executeDelete = async () => {
      if (!user || !deleteTarget) return;
      const { tag } = deleteTarget;

      setProcessing(true);
      try {
          // 1. Remove from Entries
          const entriesToUpdate = entries.filter(e => 
             e.analysis.manualTags?.includes(tag)
          );

          for (const entry of entriesToUpdate) {
              const updatedEntry = { ...entry };
              if (updatedEntry.analysis.manualTags) {
                  updatedEntry.analysis.manualTags = updatedEntry.analysis.manualTags.filter(t => t !== tag);
              }
              await db.saveEntry(updatedEntry);
          }

          // 2. Remove from Preferences
          let currentSaved = user.preferences.savedTags || [];
          if (currentSaved.includes(tag)) {
              currentSaved = currentSaved.filter(t => t !== tag);
              await updateProfile({
                  preferences: {
                      ...user.preferences,
                      savedTags: currentSaved
                  }
              });
          }

          // 3. Refresh
          const newData = await db.getEntries(user.id);
          setEntries(newData);
          // Toast or success message could be added here, but the modal closes and list updates which is clear feedback.

      } catch (e) {
          console.error("Delete failed", e);
          alert("Delete failed.");
      } finally {
          setProcessing(false);
          setDeleteTarget(null);
      }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">{t('loading')}</div>;

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-12 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <Hash size={32} />
            </div>
            <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('tagsTitle')}</h1>
            <p className="text-slate-500 dark:text-slate-400">{t('tagsDescription')}</p>
            </div>
        </div>

        {/* Add Tag Input */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm">
            <input 
                type="text" 
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                placeholder={t('enterTagName')}
                className="bg-transparent border-none focus:ring-0 text-sm px-3 text-slate-800 dark:text-slate-200 w-40 md:w-64"
            />
            <button 
                onClick={handleAddTag}
                disabled={!newTagInput.trim()}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
                <Plus size={18} />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
           <p className="text-sm font-semibold text-slate-500 uppercase">{t('totalTags')}</p>
           <h2 className="text-4xl font-bold text-slate-900 dark:text-white mt-2">{tagStats.length}</h2>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm relative">
        {processing && (
            <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl">
                <Loader2 size={40} className="text-indigo-600 animate-spin mb-2" />
                <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{t('processing')}</p>
            </div>
        )}

        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
            <Tag size={18} /> Manage Tags
        </h3>
        
        {tagStats.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
                <p>No tags found. Add one above or write an entry!</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tagStats.map(({ tag, count }) => (
                    <div 
                        key={tag}
                        className={`group flex items-center justify-between pl-4 pr-2 py-2 border rounded-xl transition-colors ${
                            editingTag === tag 
                            ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-500/30'
                            : 'bg-slate-50 hover:bg-white border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 dark:hover:bg-slate-800'
                        }`}
                    >
                        {editingTag === tag ? (
                            <div className="flex items-center gap-2 w-full">
                                <input 
                                    type="text" 
                                    value={renameInput}
                                    onChange={e => setRenameInput(e.target.value)}
                                    autoFocus
                                    className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-500 rounded px-2 py-1 text-sm focus:outline-none"
                                />
                                <button onClick={confirmRename} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded"><Check size={16} /></button>
                                <button onClick={() => setEditingTag(null)} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded"><X size={16} /></button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">#{tag}</span>
                                    {count > 0 && (
                                        <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400">
                                            {count}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleRenameClick(tag)}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                                        title={t('renameTag')}
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button 
                                        onClick={() => confirmDelete(tag, count)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                        title={t('deleteTag')}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full">
                <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400 mb-4">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t('deleteTag')}</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                        {t('deleteTagConfirm', { count: deleteTarget.count.toString() })}
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setDeleteTarget(null)}
                            className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button 
                            onClick={executeDelete}
                            className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
                        >
                            {t('delete')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default TagsView;
