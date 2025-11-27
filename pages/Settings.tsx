
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { db } from '../services/db';
import { jsonHelper } from '../services/jsonHelper';
import { zipHelper } from '../services/zipHelper';
import { geminiService } from '../services/geminiService';
import { useTranslation } from '../services/translations';
import { ThemeMode, CustomThemeColors } from '../types';
import { 
  Save, User, Sun, Moon, CheckCircle2, Globe, Database, UploadCloud, HardDrive,
  ToggleLeft, ToggleRight, Server, Palette, Monitor, Eye, FileJson, Loader2, Archive, Clock
} from 'lucide-react';
import { useConfig } from '../context/ConfigContext';

export const SettingsPage: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { theme, setTheme, customColors: savedCustomColors } = useTheme();
  const { aiConfig } = useConfig();
  const { t } = useTranslation();
  
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [language, setLanguage] = useState('');
  
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(theme);
  const [colors, setColors] = useState<CustomThemeColors>(savedCustomColors || {
      primary: '#6366f1', background: '#0f172a', surface: '#1e293b', text: '#f8fafc'
  });
  
  const [useServer, setUseServer] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [logRetentionDays, setLogRetentionDays] = useState(30);
  const [successMsg, setSuccessMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setBio(user.bio || '');
      setSystemPrompt(user.preferences.systemPrompt || "");
      setLanguage(user.preferences.language || "English");
      setUseServer(!!user.preferences.useServerStorage);
      setServerUrl(user.preferences.serverUrl || 'http://localhost:8000');
      setLogRetentionDays(user.preferences.logRetentionDays || 30);
      setSelectedTheme(user.preferences.theme);
      if (user.preferences.customColors) setColors(user.preferences.customColors);
    }
  }, [user]);

  const handleThemeChange = (mode: ThemeMode) => {
      setSelectedTheme(mode);
      setTheme(mode, mode === 'custom' ? colors : undefined);
  };

  const handleColorChange = (key: keyof CustomThemeColors, value: string) => {
      const newColors = { ...colors, [key]: value };
      setColors(newColors);
      if (selectedTheme === 'custom') setTheme('custom', newColors);
  };

  const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLang = e.target.value;
      setLanguage(newLang);
      const defaultPrompt = geminiService.DEFAULT_PROMPTS[newLang] || geminiService.DEFAULT_PROMPTS['English'];
      setSystemPrompt(defaultPrompt);
      if (bio && bio.trim()) {
          setIsTranslating(true);
          try {
              const translatedBio = await geminiService.translate(bio, newLang, aiConfig);
              setBio(translatedBio);
          } catch (e) { console.error("Translation failed", e); } finally { setIsTranslating(false); }
      }
  };

  const handleSave = async () => {
    if (!user) return;
    await updateProfile({
      displayName,
      bio,
      preferences: {
        ...user.preferences,
        theme: selectedTheme,
        customColors: colors,
        systemPrompt,
        language,
        useServerStorage: useServer,
        serverUrl: serverUrl,
        logRetentionDays: Number(logRetentionDays)
      }
    });
    setSuccessMsg(t('saveChanges'));
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleLocalExport = async () => {
    if (!user) return;
    try {
      const entries = await db.getEntries(user.id);
      const blob = new Blob([jsonHelper.exportEntries(entries)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `GeminiDiary_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setSuccessMsg('Export downloaded successfully.');
    } catch (e) { alert("Failed to create export file."); }
  };

  const handleZipExport = async () => {
      if (!user) return;
      setIsProcessing(true);
      try {
          const entries = await db.getEntries(user.id);
          await zipHelper.createZipArchive(entries, user.displayName);
          setSuccessMsg('ZIP Archive created successfully.');
      } catch (e) { alert("Failed to create ZIP archive."); } finally { setIsProcessing(false); }
  };

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        setIsProcessing(true);
        try {
          const parsedEntries = jsonHelper.parseJSONToEntries(text, user.id);
          for (const entry of parsedEntries) await db.saveEntry(entry);
          setSuccessMsg(`Successfully imported ${parsedEntries.length} entries.`);
        } catch (err) { alert("Failed to parse JSON file."); } finally { setIsProcessing(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
      }
    };
    reader.readAsText(file);
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-12">
      <div><h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('settings')}</h1><p className="text-slate-500 dark:text-slate-400 mt-1">Manage your account and preferences.</p></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><User size={18} className="text-indigo-500" /> {t('profile')}</h2>
          <div className="space-y-4">
            <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">{t('username')}</label><input type="text" value={user.username} disabled className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-500 dark:text-slate-400 cursor-not-allowed" /></div>
            <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">{t('displayName')}</label><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-900 dark:text-slate-100" /></div>
            <div>
              <div className="flex justify-between items-center mb-1.5"><label className="block text-xs font-semibold text-slate-500 uppercase">{t('bio')}</label>{isTranslating && <span className="text-xs text-indigo-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Translating...</span>}</div>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} disabled={isTranslating} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-900 dark:text-slate-100 resize-none" placeholder="Share a bit about yourself..." />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><Palette size={18} className="text-indigo-500" /> {t('appearance')}</h2>
          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-3">
               <button onClick={() => handleThemeChange('system')} className={`flex flex-col items-center p-3 rounded-xl border ${selectedTheme === 'system' ? 'bg-indigo-50 border-indigo-600 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-400 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200'}`}><Monitor size={24} /><span className="text-xs font-medium mt-1">{t('theme_system')}</span></button>
               <button onClick={() => handleThemeChange('light')} className={`flex flex-col items-center p-3 rounded-xl border ${selectedTheme === 'light' ? 'bg-indigo-50 border-indigo-600 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-400 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200'}`}><Sun size={24} /><span className="text-xs font-medium mt-1">{t('theme_light')}</span></button>
               <button onClick={() => handleThemeChange('dark')} className={`flex flex-col items-center p-3 rounded-xl border ${selectedTheme === 'dark' ? 'bg-indigo-50 border-indigo-600 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-400 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200'}`}><Moon size={24} /><span className="text-xs font-medium mt-1">{t('theme_dark')}</span></button>
               <button onClick={() => handleThemeChange('custom')} className={`flex flex-col items-center p-3 rounded-xl border ${selectedTheme === 'custom' ? 'bg-indigo-50 border-indigo-600 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-400 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200'}`}><Palette size={24} /><span className="text-xs font-medium mt-1">{t('theme_custom')}</span></button>
             </div>
             {selectedTheme === 'custom' && (
               <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Custom Palette</h4>
                  <div className="grid grid-cols-1 gap-3">
                      <div className="flex justify-between"><label className="text-sm">Primary</label><input type="color" value={colors.primary} onChange={e => handleColorChange('primary', e.target.value)} className="w-8 h-8 rounded" /></div>
                      <div className="flex justify-between"><label className="text-sm">Background</label><input type="color" value={colors.background} onChange={e => handleColorChange('background', e.target.value)} className="w-8 h-8 rounded" /></div>
                      <div className="flex justify-between"><label className="text-sm">Surface</label><input type="color" value={colors.surface} onChange={e => handleColorChange('surface', e.target.value)} className="w-8 h-8 rounded" /></div>
                      <div className="flex justify-between"><label className="text-sm">Text</label><input type="color" value={colors.text} onChange={e => handleColorChange('text', e.target.value)} className="w-8 h-8 rounded" /></div>
                  </div>
               </div>
             )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2"><Database size={18} className="text-blue-500" /> {t('dataStorage')}</h2>
        
        <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><Server size={24} className={useServer ? "text-indigo-500" : "text-slate-400"} /><div><p className="font-medium text-slate-900 dark:text-slate-100">{t('serverStorage')}</p><p className="text-xs text-slate-500">Store data on your backend</p></div></div>
                <button onClick={() => setUseServer(!useServer)} className={`text-2xl transition-colors ${useServer ? 'text-indigo-600' : 'text-slate-300'}`}>{useServer ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}</button>
            </div>
            {useServer && <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="http://localhost:8000" />}
        </div>

        {user.role === 'admin' && (
            <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-2">
                <div className="flex items-center gap-3 mb-2"><Clock size={20} className="text-orange-500" /><span className="font-medium">{t('logRetention')}</span></div>
                <input type="number" min="1" max="365" value={logRetentionDays} onChange={e => setLogRetentionDays(parseInt(e.target.value) || 30)} className="w-24 bg-white dark:bg-slate-950 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
        )}
        
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"><HardDrive size={16} /> {t('localBackup')}</h3>
            <div className="grid grid-cols-3 gap-3">
                    <button onClick={handleLocalExport} disabled={isProcessing} className="flex flex-col items-center justify-center gap-2 p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center"><FileJson size={24} className="text-slate-400" /><span className="text-sm font-medium">{t('exportCsv')}</span></button>
                    <button onClick={handleZipExport} disabled={isProcessing} className="flex flex-col items-center justify-center gap-2 p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center"><Archive size={24} className="text-indigo-500" /><span className="text-sm font-medium">{t('exportZip')}</span></button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="flex flex-col items-center justify-center gap-2 p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center"><UploadCloud size={24} className="text-slate-400" /><span className="text-sm font-medium">{t('importCsv')}</span></button>
                    <input type="file" ref={fileInputRef} onChange={handleLocalFileChange} accept=".json" className="hidden" />
            </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="text-xs text-slate-400">ID: <span className="font-mono">{user.id.substring(0, 8)}...</span></div>
        <div className="flex items-center gap-4">
              {successMsg && <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 animate-fade-in"><CheckCircle2 size={18} /><span className="text-sm font-medium">{successMsg}</span></div>}
              <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-50 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-indigo-900/20"><Save size={18} />{t('saveChanges')}</button>
        </div>
      </div>
    </div>
  );
};
