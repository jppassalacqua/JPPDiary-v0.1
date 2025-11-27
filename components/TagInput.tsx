
import React, { useState } from 'react';
import { X, Tag } from 'lucide-react';
import { useTranslation } from '../services/translations';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export const TagInput: React.FC<TagInputProps> = ({ tags, onChange, placeholder, readOnly = false }) => {
  const [input, setInput] = useState('');
  const { t } = useTranslation();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.trim();
      if (val && !tags.includes(val)) {
        onChange([...tags, val]);
        setInput('');
      }
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(t => t !== tagToRemove));
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 p-2 rounded-xl border transition-all ${readOnly ? 'bg-transparent border-transparent' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/20'}`}>
      {!readOnly && <Tag size={16} className="text-slate-400 ml-1" />}
      
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-500/30">
          #{tag}
          {!readOnly && (
            <button 
              onClick={() => removeTag(tag)}
              className="hover:text-red-500 transition-colors ml-1"
            >
              <X size={12} />
            </button>
          )}
        </span>
      ))}

      {!readOnly && (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm min-w-[120px] text-slate-800 dark:text-slate-200 placeholder-slate-400"
          placeholder={placeholder || t('addTagsPlaceholder')}
        />
      )}
    </div>
  );
};
