
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface SpeechInputProps {
  onSpeechResult: (text: string) => void;
  language?: string;
  className?: string;
}

export const SpeechInput: React.FC<SpeechInputProps> = ({ onSpeechResult, language = 'en-US', className }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = language;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onSpeechResult(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [language, onSpeechResult]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return (
    <button
      onClick={toggleListening}
      className={`p-2 rounded-full transition-all duration-300 ${
        isListening 
          ? 'bg-red-100 text-red-600 animate-pulse ring-2 ring-red-400 dark:bg-red-900/30 dark:text-red-400' 
          : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
      } ${className || ''}`}
      title={isListening ? "Stop Listening" : "Speak"}
      type="button"
    >
      {isListening ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
};
