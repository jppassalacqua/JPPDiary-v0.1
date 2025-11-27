


import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { logger } from '../services/logger';
import { LogEntry } from '../types';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Download, RefreshCw, Trash2, Filter, FileText } from 'lucide-react';
import { useTranslation } from '../services/translations';

const LogViewer: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterSource, setFilterSource] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') {
        navigate('/');
        return;
    }
    fetchLogs();
    
    // Check rotation on mount, using user preference if set
    logger.initRotation(user?.preferences?.logRetentionDays);
  }, [user]);

  const fetchLogs = async () => {
      setLoading(true);
      try {
          const data = await db.getLogs(500); // Get last 500
          setLogs(data);
      } catch (e) {
          console.error("Failed to fetch logs", e);
      } finally {
          setLoading(false);
      }
  };

  const filteredLogs = logs.filter(log => {
      const matchLevel = filterLevel === 'ALL' || log.level === filterLevel;
      const matchSource = !filterSource || log.source.toLowerCase().includes(filterSource.toLowerCase()) || log.message.toLowerCase().includes(filterSource.toLowerCase());
      return matchLevel && matchSource;
  });

  const exportLogs = () => {
      const json = JSON.stringify(filteredLogs, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SystemLogs_${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const cleanAllLogs = async () => {
      if (!confirm("Are you sure? This will delete ALL logs currently stored.")) return;
      try {
          // Pass a future timestamp to delete everything
          await db.cleanLogs(Date.now() + 10000); 
          fetchLogs();
      } catch (e) {
          alert("Failed to clean logs");
      }
  };

  const getLevelColor = (level: string) => {
      switch(level) {
          case 'ERROR': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
          case 'WARN': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
          default: return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-6xl mx-auto">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                    <FileText className="text-slate-500" /> {t('systemLogs')}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Monitor application events and errors.</p>
            </div>
            <div className="flex gap-2">
                <button onClick={fetchLogs} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
                    <RefreshCw size={20} />
                </button>
                <button onClick={exportLogs} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                    <Download size={18} /> Export
                </button>
                <button onClick={cleanAllLogs} className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-medium">
                    <Trash2 size={18} /> Clear
                </button>
            </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex gap-4 items-center shadow-sm">
            <Filter size={20} className="text-slate-400" />
            <select 
                value={filterLevel}
                onChange={e => setFilterLevel(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
                <option value="ALL">All Levels</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
            </select>
            <input 
                type="text"
                placeholder="Search source or message..."
                value={filterSource}
                onChange={e => setFilterSource(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
        </div>

        {/* Log Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Timestamp</th>
                            <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Level</th>
                            <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Source</th>
                            <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Message</th>
                            <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Data</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading logs...</td></tr>
                        ) : filteredLogs.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">No logs found matching filters.</td></tr>
                        ) : (
                            filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-3 font-mono text-xs text-slate-500">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${getLevelColor(log.level)}`}>
                                            {log.level}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-300">{log.source}</td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400 max-w-md truncate" title={log.message}>
                                        {log.message}
                                    </td>
                                    <td className="px-6 py-3">
                                        {log.data && (
                                            <details className="group relative">
                                                <summary className="cursor-pointer text-xs text-indigo-600 dark:text-indigo-400 hover:underline">View Data</summary>
                                                <div className="absolute right-0 top-full bg-slate-800 text-slate-200 p-4 rounded-lg shadow-xl z-20 text-xs mt-1 overflow-auto max-w-sm max-h-60 hidden group-open:block border border-slate-700">
                                                    <pre>{JSON.stringify(log.data, null, 2)}</pre>
                                                </div>
                                            </details>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default LogViewer;