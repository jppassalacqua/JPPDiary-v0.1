
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { DiaryEntry } from '../types';
import { Search, X, Calendar, FileText } from 'lucide-react';
import { useTranslation } from '../services/translations';

interface EntryPickerProps {
  onSelect: (entry: DiaryEntry) => void;
  onClose: () => void;
}

export const EntryPicker: React.FC<EntryPickerProps> = ({ onSelect, onClose }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<DiaryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEntries = async () => {
      if (user) {
        try {
          const data = await db.getEntries(user.id);
          setEntries(data);
          setFilteredEntries(data);
        } catch (e) {
          console.error("Failed to load entries for picker", e);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchEntries();
  }, [user]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const filtered = entries.filter(e => 
      e.analysis.summary.toLowerCase().includes(term) || 
      e.content.toLowerCase().includes(term) ||
      new Date(e.timestamp).toLocaleDateString().includes(term)
    );
    setFilteredEntries(filtered);
  }, [searchTerm, entries]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
          <h3 className="font-bold text-slate-800 dark:text-slate-200">Link Entry</h3>
          <button onClick={onClose} className="p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading ? (
            <div className="text-center py-8 text-slate-500">{t('loading')}</div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No entries found.</div>
          ) : (
            <div className="space-y-2">
              {filteredEntries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => onSelect(entry)}
                  className="w-full text-left p-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800 transition-all group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      <Calendar size={12} />
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] text-slate-400 group-hover:text-indigo-400">{entry.mode}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 line-clamp-1 flex items-center gap-2">
                    <FileText size={14} className="text-slate-400 shrink-0" />
                    {entry.analysis.summary}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
