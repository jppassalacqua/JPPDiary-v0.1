import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { db } from '../services/db';
import { DiaryEntry } from '../types';
import { searchService } from '../services/searchService';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Activity, Calendar, TrendingUp, Filter } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '../services/translations';
import { FilterPanel, FilterState } from '../components/FilterPanel';

const Dashboard: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userId: paramUserId } = useParams<{ userId: string }>();
  
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [viewingUser, setViewingUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    startDate: '',
    endDate: '',
    text: '',
    selectedMoods: [],
    selectedTags: [],
    selectedEntities: [],
    selectedEntityTypes: [],
    selectedCountries: [],
    selectedCities: [],
    media: []
  });

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            let targetUserId = currentUser?.id;
            let targetDisplayName = currentUser?.displayName;

            if (paramUserId && currentUser?.role === 'admin') {
                const foundUser = await db.getUserById(paramUserId);
                if (foundUser) {
                    targetUserId = foundUser.id;
                    targetDisplayName = foundUser.displayName;
                }
            }

            if (targetUserId) {
                const data = await db.getEntries(targetUserId);
                setEntries(data);
                setViewingUser(targetDisplayName || "User");
            }
        } catch (e) {
            console.error("Failed to load dashboard data", e);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, [currentUser, paramUserId]);

  // Derived unique tags for filter
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    entries.forEach(e => e.analysis.manualTags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [entries]);

  const availableEntities = useMemo(() => {
      const entities = new Set<string>();
      entries.forEach(e => e.analysis.entities?.forEach(ent => {
          // Filter entities based on Selected Entity Types if any are selected
          if (filters.selectedEntityTypes.length > 0) {
              if (!filters.selectedEntityTypes.includes(ent.type)) return;
          }
          entities.add(ent.name);
      }));
      return Array.from(entities).sort();
  }, [entries, filters.selectedEntityTypes]);

  // Derived locations for filter
  const availableCountries = useMemo(() => {
      const s = new Set<string>();
      entries.forEach(e => { if (e.country) s.add(e.country); });
      return Array.from(s).sort();
  }, [entries]);

  const availableCities = useMemo(() => {
      const s = new Set<string>();
      entries.forEach(e => { 
          if (e.city) {
              // Optionally filter by selected country if present
              if (filters.selectedCountries.length === 0 || (e.country && filters.selectedCountries.includes(e.country))) {
                  s.add(e.city);
              }
          } 
      });
      return Array.from(s).sort();
  }, [entries, filters.selectedCountries]);

  // Filter Logic via Service
  const filteredEntries = useMemo(() => {
    return searchService.filterEntries(entries, filters);
  }, [entries, filters]);


  if (loading) return <div className="p-8 text-center text-slate-500">{t('loading')}</div>;

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center space-y-4">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-full text-indigo-600 dark:text-indigo-400">
          <Activity size={48} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
            {t('welcomeGeneric')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
            {paramUserId && paramUserId !== currentUser?.id ? "No entries found." : t('noEntries')}
        </p>
        {(!paramUserId || paramUserId === currentUser?.id) && (
            <button 
            onClick={() => navigate('/new')} 
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-50 text-white rounded-full font-medium transition-colors shadow-md"
            >
            {t('createFirst')}
            </button>
        )}
      </div>
    );
  }

  // Stats Logic (based on filtered data)
  const totalEntries = filteredEntries.length;
  const avgSentiment = totalEntries > 0 
    ? filteredEntries.reduce((acc, curr) => acc + curr.analysis.sentimentScore, 0) / totalEntries
    : 0;
  const latestEntry = filteredEntries[0]; // Entries sorted descending by db service

  // Chart Data Preparation
  const sentimentData = filteredEntries
    .slice() // copy
    .reverse() // chronological for chart
    .map(e => ({
      date: new Date(e.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: e.analysis.sentimentScore
    }));

  const moodCounts = filteredEntries.reduce((acc, curr) => {
    const mood = curr.analysis.mood;
    acc[mood] = (acc[mood] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const moodData = Object.keys(moodCounts).map(key => ({
    name: t('mood_' + key), // Translate mood name for the chart
    key: key, // Store raw key for filtering
    count: moodCounts[key]
  }));

  const COLORS = ['#818cf8', '#a78bfa', '#34d399', '#f472b6', '#fbbf24', '#60a5fa'];
  
  const tooltipStyle = theme === 'dark' 
    ? { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#f1f5f9' }
    : { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b' };

  const handleMoodDoubleClick = (data: any) => {
      if (data && data.key) {
          navigate('/history', { state: { filterMood: data.key } });
      }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {t(paramUserId ? 'welcomeGeneric' : 'dashboard')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
                {viewingUser ? `Viewing ${viewingUser}` : t('welcomeUser', { name: currentUser?.displayName || '' })}
            </p>
        </div>
        <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                showFilters 
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' 
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
            }`}
        >
            <Filter size={18} /> {t('filterTitle')}
        </button>
      </div>

      <FilterPanel 
        filters={filters} 
        setFilters={setFilters} 
        availableTags={availableTags}
        availableEntities={availableEntities}
        availableCountries={availableCountries}
        availableCities={availableCities}
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm dark:shadow-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t('totalEntries')}</p>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{totalEntries}</h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Calendar size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm dark:shadow-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t('avgSentiment')}</p>
              <h3 className={`text-3xl font-bold mt-2 ${avgSentiment >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {avgSentiment.toFixed(2)}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Range: -1.0 to 1.0</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm dark:shadow-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t('latestMood')}</p>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {latestEntry ? t('mood_' + latestEntry.analysis.mood) : '-'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 truncate w-40">
                {latestEntry ? latestEntry.analysis.summary : ''}
              </p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400">
              <Activity size={20} />
            </div>
          </div>
        </div>
      </div>

      {totalEntries > 0 ? (
          /* Charts Grid */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sentiment Over Time */}
            <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-6 rounded-2xl h-[400px] shadow-sm dark:shadow-none">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200 mb-6">{t('sentimentTimeline')}</h3>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={sentimentData}>
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={12} 
                    domain={[-1, 1]} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#6366f1" 
                    strokeWidth={3} 
                    dot={{ fill: '#6366f1', strokeWidth: 0 }} 
                    activeDot={{ r: 6, fill: '#818cf8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Mood Distribution */}
            <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-6 rounded-2xl h-[400px] shadow-sm dark:shadow-none">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200">{t('moodDist')}</h3>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Double click to filter</span>
              </div>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={moodData}>
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    cursor={{fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}}
                    contentStyle={tooltipStyle}
                  />
                  <Bar 
                    dataKey="count" 
                    radius={[6, 6, 0, 0]} 
                    onDoubleClick={handleMoodDoubleClick}
                    style={{ cursor: 'pointer' }}
                  >
                    {moodData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
      ) : (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              <p className="text-slate-500">{t('noEntries')}</p>
          </div>
      )}
    </div>
  );
};

export default Dashboard;