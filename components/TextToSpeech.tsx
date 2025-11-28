
import React, { useState, useEffect } from 'react';
import { Volume2, Square } from 'lucide-react';

interface TextToSpeechProps {
  text: string;
  language?: string; // 'en-US', 'fr-FR', etc.
  className?: string;
  size?: number;
}

export const TextToSpeech: React.FC<TextToSpeechProps> = ({ text, language = 'en-US', className, size = 16 }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const handleEnd = () => setIsSpeaking(false);
    // Bind to the global synthesis instance to detect stops from other components
    window.speechSynthesis.addEventListener('cancel', handleEnd); 
    return () => {
        window.speechSynthesis.removeEventListener('cancel', handleEnd);
    };
  }, []);

  const cleanText = (md: string) => {
    // Simple markdown stripper for better speech
    return md
      .replace(/[*#_`]/g, '') // Remove format chars
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Keep link text, remove url
      .replace(/!\[.*?\]\(.*?\)/g, 'Image.') // Replace images
      .trim();
  };

  const toggleSpeech = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent clicks
    
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel(); // Stop any other speech
      const utterance = new SpeechSynthesisUtterance(cleanText(text));
      utterance.lang = language;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  return (
    <button
      onClick={toggleSpeech}
      className={`p-1.5 rounded-full transition-colors ${
        isSpeaking 
          ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300' 
          : 'text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800'
      } ${className || ''}`}
      title={isSpeaking ? "Stop" : "Read Aloud"}
    >
      {isSpeaking ? <Square size={size} fill="currentColor" /> : <Volume2 size={size} />}
    </button>
  );
};
