
import React from 'react';
import { FileAudio, Video as VideoIcon } from 'lucide-react';

interface MediaGalleryProps {
  images?: string[];
  audio?: string[];
  className?: string;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({ images = [], audio = [], className = '' }) => {
  const hasMedia = images.length > 0 || audio.length > 0;

  if (!hasMedia) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Audio Section - Compact List */}
      {audio.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {audio.map((src, idx) => (
            <div key={`audio-${idx}`} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 min-w-[200px]">
              <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-full text-indigo-600 dark:text-indigo-400">
                <FileAudio size={16} />
              </div>
              <audio src={src} controls className="h-8 w-40 md:w-56" />
            </div>
          ))}
        </div>
      )}

      {/* Visual Section - Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((src, idx) => {
            const isVideo = src.startsWith('data:video');
            return (
              <div key={`img-${idx}`} className="relative group aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black shadow-sm">
                {isVideo ? (
                  <div className="w-full h-full relative">
                    <video src={src} controls className="w-full h-full object-contain" />
                    <div className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white pointer-events-none">
                      <VideoIcon size={14} />
                    </div>
                  </div>
                ) : (
                  <img 
                    src={src} 
                    alt={`Attachment ${idx + 1}`} 
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
                    loading="lazy"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
