
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { DiaryEntry, EntryMode, ChatMessage } from '../types';
import { Save, X, Loader2 } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { TagInput } from './TagInput';
import { MediaManager } from './MediaManager';
import { EntryMetadata } from './EntryMetadata';
import { useTranslation } from '../services/translations';

interface EntryEditorProps {
  initialEntry?: DiaryEntry;
  initialContent?: string;
  onSave: (data: any) => Promise<void>;
  onCancel?: () => void;
  saveLabel?: string;
  autosaveKey?: string; // If provided, enables draft saving for new entries
}

export const EntryEditor: React.FC<EntryEditorProps> = ({ 
  initialEntry, 
  initialContent = '', 
  onSave, 
  onCancel, 
  saveLabel,
  autosaveKey 
}) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  // Content State
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>([]);
  
  // Metadata State (Passed to EntryMetadata)
  const [date, setDate] = useState<Date>(new Date());
  const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [locationDetails, setLocationDetails] = useState<{address?: string, city?: string, country?: string}>({});

  // Media State (Unified)
  const [images, setImages] = useState<string[]>([]); // Stores Images AND Videos (Base64)
  const [audio, setAudio] = useState<string[]>([]);
  
  // UI State
  const [isSaving, setIsSaving] = useState(false);
  
  // Data for Autocomplete
  const [existingEntries, setExistingEntries] = useState<DiaryEntry[]>([]);

  // Initialization
  useEffect(() => {
    const init = async () => {
        if (initialEntry) {
            // Edit Mode
            let text = initialEntry.content;
            if (initialEntry.mode === EntryMode.Chat) {
                try {
                    const history: ChatMessage[] = JSON.parse(initialEntry.content);
                    text = history.map(msg => `**${msg.role === 'user' ? 'User' : 'Gemini'}:** ${msg.text}`).join('\n\n');
                } catch (e) { text = initialEntry.content; }
            }
            setContent(text);
            setTags(initialEntry.analysis.manualTags || []);
            setDate(new Date(initialEntry.timestamp));
            setLocation(initialEntry.location);
            setLocationDetails({
                address: initialEntry.address,
                city: initialEntry.city,
                country: initialEntry.country
            });
            
            // Handle legacy single image vs new array
            if (initialEntry.images && initialEntry.images.length > 0) {
                setImages(initialEntry.images);
            } else if (initialEntry.image) {
                setImages([initialEntry.image]);
            } else {
                setImages([]);
            }
            
            setAudio(initialEntry.audio || []);
        } else {
            // Create Mode
            if (initialContent) setContent(initialContent);
            if (autosaveKey && user) {
                const draft = db.getDraft(user.id);
                if (draft && !initialContent) setContent(draft);
            }
        }

        if (user) {
            const data = await db.getEntries(user.id);
            setExistingEntries(data);
        }
    };
    init();
  }, [initialEntry, user]);

  // Autosave
  useEffect(() => {
      if (autosaveKey && user && !initialEntry) {
          const timer = setTimeout(() => {
              db.saveDraft(user.id, content);
          }, 1000);
          return () => clearTimeout(timer);
      }
  }, [content, autosaveKey, user, initialEntry]);

  // Handlers
  const handleSave = async () => {
      setIsSaving(true);
      try {
          await onSave({
              content,
              tags,
              date,
              location,
              locationDetails,
              images,
              audio
          });
          if (autosaveKey && user) db.clearDraft(user.id);
      } catch (e) {
          console.error(e);
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="flex flex-col h-full gap-4 relative animate-fade-in">
        {/* Header */}
        <div className="flex flex-col xl:flex-row gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex-1">
                <EntryMetadata 
                    entryDate={date}
                    setEntryDate={setDate}
                    location={location}
                    setLocation={setLocation}
                    locationDetails={locationDetails}
                    setLocationDetails={setLocationDetails}
                    existingEntries={existingEntries}
                />
            </div>
            
            <div className="flex xl:flex-col justify-end gap-2 items-end xl:w-32">
                <button 
                    onClick={handleSave} 
                    disabled={isSaving || !content.trim()} 
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors shadow-sm disabled:opacity-50"
                >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    <span className="hidden sm:inline xl:inline">{saveLabel || t('save')}</span>
                </button>
                {onCancel && (
                    <button onClick={onCancel} className="w-full p-2.5 flex items-center justify-center text-slate-500 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                        <X size={18} />
                        <span className="hidden sm:inline xl:hidden ml-2">{t('cancel')}</span>
                    </button>
                )}
            </div>
        </div>

        {/* Content Editor */}
        <div className="flex-1 min-h-[300px] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
            <RichTextEditor initialValue={content} onChange={setContent} placeholder="Write your entry..." />
        </div>

        {/* Bottom Grid: Tags & Media */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Tags Section */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">{t('tags')}</label>
                <TagInput tags={tags} onChange={setTags} />
            </div>

            {/* Unified Media Manager */}
            <div className="col-span-1 md:col-span-2">
                <MediaManager 
                    images={images} 
                    setImages={setImages} 
                    audio={audio} 
                    setAudio={setAudio} 
                />
            </div>
        </div>
    </div>
  );
};
