
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { db } from '../services/db';
import { User, AiProvider } from '../types';
import { useNavigate } from 'react-router-dom';
import { Trash2, ExternalLink, ShieldAlert, User as UserIcon, Download, Upload, Database, Loader2, Cpu, Save } from 'lucide-react';
import { useTranslation } from '../services/translations';

const AdminPanel: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { aiConfig, updateAiConfig } = useConfig();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Config State
  const [provider, setProvider] = useState<AiProvider>(aiConfig.provider);
  const [apiKey, setApiKey] = useState(aiConfig.apiKey || '');
  const [localUrl, setLocalUrl] = useState(aiConfig.localUrl);
  const [localModel, setLocalModel] = useState(aiConfig.localModel);

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      navigate('/');
      return;
    }
    loadUsers();
  }, [currentUser]);

  const loadUsers = async () => {
    try {
        const list = await db.getUsers();
        setUsers(list.sort((a, b) => a.displayName.localeCompare(b.displayName)));
    } catch (e) { console.error("Failed to load users", e); }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (id === currentUser?.id) return alert("You cannot delete yourself.");
    if (confirm(`Delete user @${username}?`)) { await db.deleteUser(id); loadUsers(); }
  };

  const handleExportSystem = async () => {
      setProcessing(true);
      try {
          const backup = await db.getFullBackup();
          const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `GeminiDiary_FULL_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } catch (e) { alert("Export failed."); } finally { setProcessing(false); }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!confirm("WARNING: Overwrite ALL data?")) return;
      setProcessing(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              await db.restoreFullBackup(JSON.parse(event.target?.result as string));
              alert("Restored."); window.location.reload();
          } catch (e) { alert("Import failed."); } finally { setProcessing(false); }
      };
      reader.readAsText(file);
  };

  const saveAiConfig = async () => {
      setProcessing(true);
      try {
          await updateAiConfig({
              provider,
              apiKey,
              localUrl,
              localModel
          });
          alert("AI Configuration Saved Globally.");
      } catch (e) {
          alert("Failed to save configuration.");
      } finally {
          setProcessing(false);
      }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
          <ShieldAlert className="text-red-500" /> {t('adminPanel')}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage users and system configuration.</p>
      </div>

      {/* Global AI Config */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <Cpu size={18} className="text-indigo-500" /> Global AI Configuration
        </h2>
        <div className="space-y-6">
            <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Provider</label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="provider" value="gemini" checked={provider === 'gemini'} onChange={() => setProvider('gemini')} className="text-indigo-600" />
                        <span className="text-slate-700 dark:text-slate-200">Google Gemini (Cloud)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="provider" value="local" checked={provider === 'local'} onChange={() => setProvider('local')} className="text-indigo-600" />
                        <span className="text-slate-700 dark:text-slate-200">Local LLM (Ollama)</span>
                    </label>
                </div>
            </div>

            {provider === 'gemini' && (
                <div className="animate-fade-in">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Google API Key</label>
                    <input 
                        type="password" 
                        value={apiKey} 
                        onChange={e => setApiKey(e.target.value)} 
                        placeholder="AIza..."
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">Leave empty to use server environment variable.</p>
                </div>
            )}

            {provider === 'local' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 animate-fade-in">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Local Server URL</label>
                        <input
                            type="text"
                            value={localUrl}
                            onChange={(e) => setLocalUrl(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2 text-slate-900 dark:text-slate-100"
                            placeholder="http://localhost:11434/v1"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Model Name</label>
                        <input
                            type="text"
                            value={localModel}
                            onChange={(e) => setLocalModel(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2 text-slate-900 dark:text-slate-100"
                            placeholder="llama3"
                        />
                    </div>
                </div>
            )}

            <button onClick={saveAiConfig} disabled={processing} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-indigo-900/20 disabled:opacity-50">
                {processing ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Save Configuration
            </button>
        </div>
      </div>

      {/* System Maintenance */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Database size={20} className="text-indigo-500" /> System Data Maintenance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={handleExportSystem} disabled={processing} className="flex items-center justify-center gap-3 p-6 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50">
                  {processing ? <Loader2 className="animate-spin" /> : <Download size={24} className="text-emerald-500" />}
                  <div className="text-left"><p className="font-bold text-slate-800 dark:text-slate-200">Export Full System</p></div>
              </button>
              <button onClick={() => fileInputRef.current?.click()} disabled={processing} className="flex items-center justify-center gap-3 p-6 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50">
                  {processing ? <Loader2 className="animate-spin" /> : <Upload size={24} className="text-amber-500" />}
                  <div className="text-left"><p className="font-bold text-slate-800 dark:text-slate-200">Restore System</p></div>
              </button>
              <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept=".json" />
          </div>
      </div>

      {/* Users List */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Registered Users ({users.length})</h2>
            <button onClick={loadUsers} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Refresh List</button>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {users.map((u) => (
            <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${u.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-600'}`}>{u.displayName.charAt(0)}</div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{u.displayName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">@{u.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate(`/admin/user/${u.id}`)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm"><ExternalLink size={16} /> Dashboard</button>
                {u.id !== currentUser?.id && <button onClick={() => handleDeleteUser(u.id, u.username)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg"><Trash2 size={18} /></button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
