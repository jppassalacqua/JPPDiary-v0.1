
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { CatalogEntry, CatalogItemType } from '../types';
import { useTranslation } from '../services/translations';
import { Book, User, MapPin, Flag, Lightbulb, Video, Sparkles, Search, ArrowRight, ExternalLink, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TagInput } from '../components/TagInput';

const CatalogView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<CatalogEntry>>({});
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchCatalog();
  }, [user]);

  const fetchCatalog = async () => {
    if (user) {
      setLoading(true);
      try {
          const data = await db.getCatalog(user.id);
          setCatalog(data);
      } catch (e) {
          console.error("Failed to load catalog", e);
      } finally {
          setLoading(false);
      }
    }
  };

  const filteredCatalog = useMemo(() => {
      return catalog.filter(item => {
          const matchesText = item.name.toLowerCase().includes(filterText.toLowerCase()) || 
                              item.description.toLowerCase().includes(filterText.toLowerCase());
          const matchesType = selectedType ? item.type === selectedType : true;
          return matchesText && matchesType;
      });
  }, [catalog, filterText, selectedType]);

  const groupedCatalog = useMemo(() => {
      const groups: Record<string, CatalogEntry[]> = {};
      filteredCatalog.forEach(item => {
          if (!groups[item.type]) groups[item.type] = [];
          groups[item.type].push(item);
      });
      return groups;
  }, [filteredCatalog]);

  const getIcon = (type: string) => {
      switch(type) {
          case 'Person': return <User size={20} />;
          case 'Location': return <MapPin size={20} />;
          case 'Event': return <Flag size={20} />;
          case 'Concept': return <Lightbulb size={20} />;
          case 'Book': return <Book size={20} />;
          case 'Movie': return <Video size={20} />;
          default: return <Sparkles size={20} />;
      }
  };

  const getBadgeColor = (type: string) => {
      switch(type) {
          case 'Person': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
          case 'Location': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
          case 'Event': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
          case 'Concept': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
          default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      }
  };

  const handleAddItem = () => {
      setEditingItem({
          name: '',
          type: 'Person',
          description: '',
          tags: []
      });
      setIsEditing(false); // Mode Create
      setShowEditModal(true);
  };

  const handleEditItem = (item: CatalogEntry) => {
      setEditingItem(item);
      setIsEditing(true); // Mode Edit
      setShowEditModal(true);
  };

  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Are you sure you want to delete this item?")) return;
      try {
          await db.deleteCatalogEntry(id);
          fetchCatalog();
      } catch (e) {
          console.error(e);
          alert("Failed to delete item.");
      }
  };

  const handleSave = async () => {
      if (!user || !editingItem.name || !editingItem.type) {
          alert("Name and Type are required.");
          return;
      }

      try {
          const itemToSave: CatalogEntry = {
              id: editingItem.id || crypto.randomUUID(),
              userId: user.id,
              sourceEntryId: editingItem.sourceEntryId || '', // If manual, might be empty or link to a dummy
              name: editingItem.name,
              type: editingItem.type as CatalogItemType,
              description: editingItem.description || '',
              tags: editingItem.tags || [],
              timestamp: Date.now()
          };

          await db.saveCatalogEntry(itemToSave);
          setShowEditModal(false);
          fetchCatalog();
      } catch (e) {
          console.error(e);
          alert("Failed to save item.");
      }
  };

  const handleCardDoubleClick = (item: CatalogEntry) => {
      navigate('/history', { state: { filterEntity: item.name } });
  };

  if (loading) return <div className="p-8 text-center text-slate-500">{t('loading')}</div>;

  return (
    <div className="space-y-8 animate-fade-in pb-12 relative">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('catalogTitle')}</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">{t('catalogViewDesc')}</p>
            </div>
            
            <div className="w-full md:w-auto flex flex-col md:flex-row gap-3 items-center">
                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder={t('search')}
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        className="w-full md:w-64 pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>
                <select 
                    value={selectedType || ''} 
                    onChange={e => setSelectedType(e.target.value || null)}
                    className="w-full md:w-auto px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors"
                >
                    <option value="">All Types</option>
                    <option value="Person">{t('cat_Person')}</option>
                    <option value="Location">{t('cat_Location')}</option>
                    <option value="Event">{t('cat_Event')}</option>
                    <option value="Concept">{t('cat_Concept')}</option>
                    <option value="Book">{t('cat_Book')}</option>
                    <option value="Movie">{t('cat_Movie')}</option>
                    <option value="Other">{t('cat_Other')}</option>
                </select>
                <button 
                    onClick={handleAddItem}
                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-900/20"
                >
                    <Plus size={18} /> Add
                </button>
            </div>
        </div>

        {filteredCatalog.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="inline-flex p-4 bg-white dark:bg-slate-800 rounded-full mb-4 shadow-sm">
                    <Book size={32} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No entities found</h3>
                <p className="text-slate-500 dark:text-slate-400">Try writing a new entry or running an interview.</p>
            </div>
        ) : (
            <div className="space-y-10">
                {Object.keys(groupedCatalog).map(type => (
                    <div key={type}>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                            <span className={`p-1.5 rounded-lg ${getBadgeColor(type)}`}>
                                {getIcon(type)}
                            </span>
                            {t('cat_' + type)} 
                            <span className="text-sm font-normal text-slate-400 ml-2">({groupedCatalog[type].length})</span>
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {groupedCatalog[type].map(item => (
                                <div 
                                    key={item.id} 
                                    className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full relative cursor-default"
                                    onDoubleClick={() => handleCardDoubleClick(item)}
                                >
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button onClick={() => handleEditItem(item)} className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-200"><Edit2 size={14} /></button>
                                        <button onClick={(e) => handleDeleteItem(item.id, e)} className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-red-600 hover:border-red-200"><Trash2 size={14} /></button>
                                    </div>

                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors pr-16">
                                            {item.name}
                                        </h3>
                                    </div>
                                    
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4 flex-1 line-clamp-3">
                                        {item.description}
                                    </p>
                                    
                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center mt-auto">
                                        <div className="flex gap-1 overflow-hidden">
                                            {item.tags?.slice(0, 2).map(tag => (
                                                <span key={tag} className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                        
                                        <button 
                                            onClick={() => handleCardDoubleClick(item)}
                                            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                        >
                                            {t('viewEntries')} <ArrowRight size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* Edit/Add Modal */}
        {showEditModal && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {isEditing ? 'Edit Entity' : 'Add Entity'}
                        </h2>
                        <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Name</label>
                            <input 
                                type="text" 
                                value={editingItem.name || ''} 
                                onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Type</label>
                            <select 
                                value={editingItem.type || 'Other'}
                                onChange={e => setEditingItem({...editingItem, type: e.target.value as CatalogItemType})}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2"
                            >
                                <option value="Person">{t('cat_Person')}</option>
                                <option value="Location">{t('cat_Location')}</option>
                                <option value="Event">{t('cat_Event')}</option>
                                <option value="Concept">{t('cat_Concept')}</option>
                                <option value="Book">{t('cat_Book')}</option>
                                <option value="Movie">{t('cat_Movie')}</option>
                                <option value="Other">{t('cat_Other')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Description</label>
                            <textarea 
                                value={editingItem.description || ''}
                                onChange={e => setEditingItem({...editingItem, description: e.target.value})}
                                rows={3}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Tags</label>
                            <TagInput 
                                tags={editingItem.tags || []} 
                                onChange={tags => setEditingItem({...editingItem, tags})} 
                            />
                        </div>
                    </div>

                    <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950 rounded-b-2xl">
                        <button 
                            onClick={() => setShowEditModal(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 flex items-center gap-2"
                        >
                            <Save size={18} /> Save
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CatalogView;
