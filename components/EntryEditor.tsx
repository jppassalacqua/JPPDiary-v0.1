
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { DiaryEntry, EntryMode, ChatMessage } from '../types';
import { Save, X, Loader2, ImagePlus, PenTool, Camera, Volume2, Trash2 } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { TagInput } from './TagInput';
import { AudioRecorder } from './AudioRecorder';
import { DrawingCanvas } from './DrawingCanvas';
import { CameraCapture } from './CameraCapture';
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

  // Media State
  const [images, setImages] = useState<string[]>([]);
  const [audio, setAudio] = useState<string[]>([]);
  
  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  // Data for Autocomplete
  const [existingEntries, setExistingEntries] = useState<DiaryEntry[]>([]);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Autosave (only if autosaveKey is present and not editing an existing entry)
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
          // Clear draft if successful and in creation mode
          if (autosaveKey && user) db.clearDraft(user.id);
      } catch (e) {
          console.error(e);
      } finally {
          setIsSaving(false);
      }
  };

  // Media Handlers
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
          Array.from(files).forEach((file: File) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                  if (reader.result) setImages(prev => [...prev, reader.result as string]);
              };
              reader.readAsDataURL(file);
          });
      }
      e.target.value = ''; // Reset input
  };

  const removeImage = (index: number) => {
      setImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeAudio = (index: number) => {
      setAudio(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full gap-4 relative animate-fade-in">
        {/* Modals */}
        {isDrawing && (
            <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
                <div className="w-full max-w-4xl h-[80vh]">
                    <DrawingCanvas onSave={(base64) => { setImages(p => [...p, base64]); setIsDrawing(false); }} onClose={() => setIsDrawing(false)} />
                </div>
            </div>
        )}
        {isCameraOpen && (
            <CameraCapture onCapture={(base64) => setImages(p => [...p, base64])} onClose={() => setIsCameraOpen(false)} />
        )}

        {/* Header: Date/Location + Actions */}
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

            {/* Audio Manager */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Audio ({audio.length})</label>
                <div className="mb-3"><AudioRecorder onSave={(base64) => setAudio(p => [...p, base64])} /></div>
                {audio.length > 0 && (
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                        {audio.map((src, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                                <audio src={src} controls className="h-6 w-24" />
                                <button onClick={() => removeAudio(idx)} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Image Manager (Full Width on mobile, span 2 on md) */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 col-span-1 md:col-span-2">
                <div className="flex justify-between items-center mb-4">
                    <label className="text-xs font-bold text-slate-500 uppercase">Images ({images.length})</label>
                    <div className="flex gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm">
                            <ImagePlus size={14} className="text-indigo-500" /><span className="text-xs font-medium text-slate-700 dark:text-slate-300">Upload</span>
                            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </label>
                        <button onClick={() => setIsDrawing(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm">
                            <PenTool size={14} className="text-purple-500" /><span className="text-xs font-medium text-slate-700 dark:text-slate-300">Draw</span>
                        </button>
                        <button onClick={() => setIsCameraOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm">
                            <Camera size={14} className="text-emerald-500" /><span className="text-xs font-medium text-slate-700 dark:text-slate-300">Camera</span>
                        </button>
                    </div>
                </div>
                
                {images.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {images.map((src, idx) => (
                            <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-black">
                                <img src={src} alt="attachment" className="w-full h-full object-cover" />
                                <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-xs">
                        No images attached
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
