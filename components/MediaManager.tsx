
import React, { useRef, useState } from 'react';
import { ImagePlus, PenTool, Camera, Trash2, Paperclip, FileAudio, Video as VideoIcon, Mic } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
import { CameraCapture } from './CameraCapture';
import { DrawingCanvas } from './DrawingCanvas';
import { useTranslation } from '../services/translations';

interface MediaManagerProps {
  images: string[];
  setImages: React.Dispatch<React.SetStateAction<string[]>>;
  audio: string[];
  setAudio: React.Dispatch<React.SetStateAction<string[]>>;
}

export const MediaManager: React.FC<MediaManagerProps> = ({ images, setImages, audio, setAudio }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modal States
  const [isDrawing, setIsDrawing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // --- Processing ---
  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          const base64 = reader.result as string;
          if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            setImages(prev => [...prev, base64]);
          } else if (file.type.startsWith('audio/')) {
            setAudio(prev => [...prev, base64]);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  // --- Drag & Drop ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  // --- Removal ---
  const removeImage = (index: number) => setImages(prev => prev.filter((_, i) => i !== index));
  const removeAudio = (index: number) => setAudio(prev => prev.filter((_, i) => i !== index));

  return (
    <>
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

      {/* Main Container */}
      <div 
        className={`bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border transition-all ${
          isDragging 
            ? 'border-dashed border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
            : 'border-slate-200 dark:border-slate-800'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <Paperclip size={14} /> Attachments ({images.length + audio.length})
            {isDragging && <span className="text-indigo-500 font-normal normal-case">- Drop files here</span>}
          </label>
          
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-700 dark:text-slate-300">
              <ImagePlus size={14} className="text-indigo-500" />
              <span className="text-xs font-medium">Upload</span>
              <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*" className="hidden" onChange={handleFileInput} />
            </label>
            
            <button onClick={() => setIsDrawing(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-700 dark:text-slate-300">
              <PenTool size={14} className="text-purple-500" /><span className="text-xs font-medium">Draw</span>
            </button>
            
            <button onClick={() => setIsCameraOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-700 dark:text-slate-300">
              <Camera size={14} className="text-emerald-500" /><span className="text-xs font-medium">Camera</span>
            </button>

            <div className="inline-flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-sm">
                <AudioRecorder onSave={(base64) => setAudio(p => [...p, base64])} />
            </div>
          </div>
        </div>

        {/* Content Area */}
        {(images.length === 0 && audio.length === 0) ? (
           <div className={`text-center py-8 border-2 border-dashed rounded-lg text-slate-400 text-xs transition-colors ${isDragging ? 'border-transparent' : 'border-slate-200 dark:border-slate-700'}`}>
              {!isDragging && "Drag & drop photos, videos, or audio files here"}
           </div>
        ) : (
           <div className="space-y-4">
              {/* Audio List */}
              {audio.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {audio.map((src, idx) => (
                        <div key={`aud-${idx}`} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm animate-fade-in">
                            <FileAudio size={14} className="text-indigo-500" />
                            <audio src={src} controls className="h-6 w-24 md:w-40" />
                            <button onClick={() => removeAudio(idx)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={12}/></button>
                        </div>
                    ))}
                </div>
              )}

              {/* Visual Grid */}
              {images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {images.map((src, idx) => {
                        const isVideo = src.startsWith('data:video');
                        return (
                            <div key={`vis-${idx}`} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-black animate-fade-in shadow-sm">
                                {isVideo ? (
                                    <div className="w-full h-full relative">
                                        <video src={src} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                                            <VideoIcon size={20} className="text-white opacity-80" />
                                        </div>
                                    </div>
                                ) : (
                                    <img src={src} alt="attachment" className="w-full h-full object-cover" />
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-md z-10 transform scale-90 group-hover:scale-100">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        );
                    })}
                </div>
              )}
           </div>
        )}
      </div>
    </>
  );
};
