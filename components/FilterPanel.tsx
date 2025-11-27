
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Filter, X, Calendar, Hash, Smile, Search, MapPin, ChevronDown, Check, Users, Maximize2, Paperclip } from 'lucide-react';
import { Mood } from '../types';
import { useTranslation } from '../services/translations';

export interface FilterState {
  startDate: string;
  endDate: string;
  text: string;
  selectedMoods: string[];
  selectedTags: string[];
  selectedEntities: string[];
  selectedCountries: string[];
  selectedCities: string[];
  media: string[]; // 'hasImage' | 'hasAudio' | 'hasLocation'
}

interface FilterPanelProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  availableTags: string[]; 
  availableEntities?: string[];
  availableCountries?: string[];
  availableCities?: string[];
  isOpen: boolean;
  onClose: () => void;
}

// --- Search Modal Component ---
const SearchModal = ({ 
    isOpen, 
    onClose, 
    title, 
    options, 
    selected, 
    onChange, 
    renderLabel 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    title: string, 
    options: string[], 
    selected: string[], 
    onChange: (item: string) => void,
    renderLabel: (item: string) => string
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setSearchTerm('');
        }
    }, [isOpen]);

    const filteredOptions = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return options.filter(opt => renderLabel(opt).toLowerCase().includes(term));
    }, [options, searchTerm, renderLabel]);

    if (!isOpen) return null;

    // Use Portal to render at document body level to escape Map z-index issues
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" style={{ isolation: 'isolate' }}>
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">{title}</h3>
                    <button onClick={onClose} className="p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                        <input 
                            ref={inputRef}
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('searchPlaceholder')}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    {filteredOptions.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">No matches found.</div>
                    ) : (
                        <div className="space-y-1">
                            {filteredOptions.map(option => (
                                <div 
                                    key={option}
                                    onClick={() => onChange(option)}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-indigo-900/10 cursor-pointer rounded-xl transition-colors group"
                                >
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                        selected.includes(option) 
                                        ? 'bg-indigo-600 border-indigo-600 text-white' 
                                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-indigo-400'
                                    }`}>
                                        {selected.includes(option) && <Check size={12} strokeWidth={3} />}
                                    </div>
                                    <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                                        {renderLabel(option)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-b-2xl flex justify-between items-center">
                    <span className="text-xs text-slate-500">{selected.length} selected</span>
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-500 transition-colors shadow-sm"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- Advanced MultiSelect Component ---
const MultiSelect = ({ 
  label, 
  icon: Icon, 
  options, 
  selected, 
  onChange, 
  renderLabel 
}: { 
  label: string, 
  icon: any, 
  options: string[], 
  selected: string[], 
  onChange: (item: string) => void,
  renderLabel: (item: string) => string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filterText, setFilterText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter options locally for dropdown
  const filteredOptions = useMemo(() => {
      const term = filterText.toLowerCase();
      return options.filter(opt => renderLabel(opt).toLowerCase().includes(term));
  }, [options, filterText, renderLabel]);

  // Show only first 8 items in dropdown to keep it clean
  const DISPLAY_LIMIT = 8;
  const displayOptions = filteredOptions.slice(0, DISPLAY_LIMIT);
  const hasMore = filteredOptions.length > DISPLAY_LIMIT;

  return (
    <div className="relative" ref={containerRef}>
      <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
        <Icon size={14} /> {label}
      </label>
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
      >
        <span className="truncate">
          {selected.length === 0 ? "Select..." : `${selected.length} selected`}
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Selected Chips (Preview) */}
      {selected.length > 0 && !isOpen && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.slice(0, 5).map(item => (
            <span key={item} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-500/30 text-[10px] font-medium max-w-[150px] truncate">
              {renderLabel(item)}
              <button 
                onClick={(e) => { e.stopPropagation(); onChange(item); }} 
                className="hover:text-indigo-900 dark:hover:text-indigo-100 p-0.5 rounded-full hover:bg-indigo-200/50 dark:hover:bg-indigo-500/30 ml-1"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          {selected.length > 5 && (
              <span className="text-[10px] text-slate-400 self-center">+{selected.length - 5} more</span>
          )}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl animate-fade-in overflow-hidden">
          
          {/* Internal Search Input */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
              <input 
                type="text" 
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                placeholder="Filter..." 
                className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
          </div>

          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {displayOptions.length > 0 ? (
                displayOptions.map(option => (
                <div 
                    key={option}
                    onClick={() => onChange(option)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm text-slate-700 dark:text-slate-300 border-b border-slate-50 dark:border-slate-800 last:border-0"
                >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    selected.includes(option) 
                        ? 'bg-indigo-600 border-indigo-600 text-white' 
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}>
                    {selected.includes(option) && <Check size={10} strokeWidth={3} />}
                    </div>
                    <span className="truncate">{renderLabel(option)}</span>
                </div>
                ))
            ) : (
                <div className="px-4 py-3 text-sm text-slate-500 text-center">No matching options</div>
            )}
          </div>

          {/* Show More / Advanced Search Button */}
          {(hasMore || options.length > DISPLAY_LIMIT) && (
              <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                  <button 
                    onClick={() => { setIsOpen(false); setShowModal(true); }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                      <Maximize2 size={12} />
                      {hasMore ? `Show all ${filteredOptions.length} results` : 'Open Full Search'}
                  </button>
              </div>
          )}
        </div>
      )}

      {/* Full Search Modal */}
      <SearchModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`Select ${label}`}
        options={options}
        selected={selected}
        onChange={onChange}
        renderLabel={renderLabel}
      />
    </div>
  );
};

export const FilterPanel: React.FC<FilterPanelProps> = ({ 
  filters, 
  setFilters, 
  availableTags, 
  availableEntities = [],
  availableCountries = [],
  availableCities = [],
  isOpen, 
  onClose 
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const toggleSelection = (key: keyof FilterState, item: string) => {
      setFilters(prev => {
          const currentList = prev[key] as string[];
          const newList = currentList.includes(item)
            ? currentList.filter(i => i !== item)
            : [...currentList, item];
          return { ...prev, [key]: newList };
      });
  };

  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      text: '',
      selectedMoods: [],
      selectedTags: [],
      selectedEntities: [],
      selectedCountries: [],
      selectedCities: [],
      media: []
    });
  };

  return (
    <div className="mb-6 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Filter size={20} /> {t('filterTitle')}
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Full Text Search */}
        <div className="space-y-2 lg:col-span-2">
           <label className="text-xs font-bold text-slate-500 uppercase">{t('searchPlaceholder')}</label>
           <div className="relative">
             <Search size={16} className="absolute left-3 top-3 text-slate-400" />
             <input 
                type="text" 
                value={filters.text}
                onChange={e => setFilters({...filters, text: e.target.value})}
                placeholder={t('searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-colors"
             />
           </div>
        </div>

        {/* Date Range */}
        <div className="space-y-2 lg:col-span-2">
          <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
             <Calendar size={14} /> {t('dateRange')}
          </label>
          <div className="flex gap-2">
            <input 
              type="date" 
              value={filters.startDate}
              onChange={e => setFilters({...filters, startDate: e.target.value})}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <input 
              type="date" 
              value={filters.endDate}
              onChange={e => setFilters({...filters, endDate: e.target.value})}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Location Filters */}
        <div className="space-y-2">
            <MultiSelect 
                label={t('country')}
                icon={MapPin}
                options={availableCountries}
                selected={filters.selectedCountries}
                onChange={(item) => toggleSelection('selectedCountries', item)}
                renderLabel={(c) => c}
            />
        </div>

        <div className="space-y-2">
            <MultiSelect 
                label={t('city')}
                icon={MapPin}
                options={availableCities}
                selected={filters.selectedCities}
                onChange={(item) => toggleSelection('selectedCities', item)}
                renderLabel={(c) => c}
            />
        </div>

        {/* Moods Dropdown */}
        <div className="col-span-1 md:col-span-2">
          <MultiSelect 
            label={t('moods')}
            icon={Smile}
            options={Object.values(Mood)}
            selected={filters.selectedMoods}
            onChange={(item) => toggleSelection('selectedMoods', item)}
            renderLabel={(mood) => t('mood_' + mood)}
          />
        </div>

        {/* Entities Dropdown */}
        <div className="col-span-1">
          <MultiSelect 
            label={t('entitiesFilter')}
            icon={Users}
            options={availableEntities}
            selected={filters.selectedEntities}
            onChange={(item) => toggleSelection('selectedEntities', item)}
            renderLabel={(entity) => entity}
          />
        </div>

        {/* Tags Dropdown */}
        <div className="col-span-1">
          <MultiSelect 
            label={t('tags')}
            icon={Hash}
            options={availableTags}
            selected={filters.selectedTags}
            onChange={(item) => toggleSelection('selectedTags', item)}
            renderLabel={(tag) => tag}
          />
        </div>

        {/* Media & Context Filter (New) */}
        <div className="col-span-1 md:col-span-2">
            <MultiSelect 
                label={t('mediaFilter')}
                icon={Paperclip}
                options={['hasImage', 'hasAudio', 'hasLocation']}
                selected={filters.media || []}
                onChange={(item) => toggleSelection('media', item)}
                renderLabel={(item) => t('media_' + item)}
            />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <button 
          onClick={resetFilters}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          {t('reset')}
        </button>
        <button 
          onClick={onClose}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors shadow-md"
        >
          {t('apply')}
        </button>
      </div>
    </div>
  );
};
