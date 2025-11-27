import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { DiaryEntry, Mood } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Maximize2, Minimize2 } from 'lucide-react';
import { useTranslation } from '../services/translations';
import { useNavigate } from 'react-router-dom';

type ViewMode = 'year' | 'month' | 'day';

const CalendarView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchEntries = async () => {
      if (user) {
        const data = await db.getEntries(user.id);
        setEntries(data);
      }
    };
    fetchEntries();
  }, [user]);

  // Helpers
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getEntriesForDate = (date: Date) => {
    return entries.filter(e => {
      const eDate = new Date(e.timestamp);
      return eDate.getDate() === date.getDate() &&
             eDate.getMonth() === date.getMonth() &&
             eDate.getFullYear() === date.getFullYear();
    });
  };

  const navigateTime = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'year') {
      newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(newDate);
    setCurrentDate(newDate);
    setViewMode('day');
  };

  const handleEntryClick = (entry: DiaryEntry) => {
      navigate('/history', { 
          state: { 
              entryId: entry.id,
              date: entry.timestamp 
          } 
      });
  };

  const getMoodColor = (mood: Mood) => {
    switch (mood) {
        case Mood.Joyful: return 'bg-yellow-400';
        case Mood.Happy: return 'bg-green-400';
        case Mood.Neutral: return 'bg-slate-400';
        case Mood.Sad: return 'bg-blue-400';
        case Mood.Anxious: return 'bg-orange-400';
        case Mood.Angry: return 'bg-red-400';
        case Mood.Reflective: return 'bg-purple-400';
        case Mood.Tired: return 'bg-indigo-300';
        default: return 'bg-slate-400';
    }
  };

  // --- Render Components ---

  const renderMonthGrid = (targetDate: Date, isMini: boolean = false) => {
    const daysInMonth = getDaysInMonth(targetDate);
    const firstDay = getFirstDayOfMonth(targetDate);
    const days = [];

    // Empty cells for padding
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className={`${isMini ? 'h-6' : 'h-24 md:h-32'} border border-transparent`}></div>);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(targetDate.getFullYear(), targetDate.getMonth(), d);
      const dayEntries = getEntriesForDate(date);
      const isToday = new Date().toDateString() === date.toDateString();
      const isSelected = selectedDate?.toDateString() === date.toDateString();

      if (isMini) {
          days.push(
              <div key={d} className="h-6 flex items-center justify-center text-[10px] relative">
                  <span className={`z-10 ${dayEntries.length > 0 ? 'text-white font-bold' : 'text-slate-500'}`}>{d}</span>
                  {dayEntries.length > 0 && (
                      <div className={`absolute inset-0 m-0.5 rounded-full ${getMoodColor(dayEntries[0].analysis.mood)} opacity-80`} />
                  )}
              </div>
          );
      } else {
        days.push(
            <div 
              key={d} 
              onClick={() => handleDateClick(d)}
              className={`relative border border-slate-100 dark:border-slate-800 p-2 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 flex flex-col items-start justify-start gap-1
                ${isToday ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}
                ${isSelected ? 'ring-2 ring-indigo-500 z-10' : ''}
              `}
            >
              <span className={`text-sm font-semibold rounded-full w-7 h-7 flex items-center justify-center ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                {d}
              </span>
              
              <div className="flex flex-wrap gap-1 mt-1 w-full">
                {dayEntries.map(entry => (
                   <div key={entry.id} className={`h-1.5 w-full rounded-full ${getMoodColor(entry.analysis.mood)} opacity-70`} title={entry.analysis.summary} />
                ))}
              </div>
              
              <div className="mt-auto w-full">
                 {dayEntries.slice(0, 2).map(e => (
                     <p key={e.id} className="text-[10px] text-slate-500 truncate hidden md:block">{e.analysis.mood}</p>
                 ))}
                 {dayEntries.length > 2 && <p className="text-[10px] text-slate-400 hidden md:block">+{dayEntries.length - 2} more</p>}
              </div>
            </div>
          );
      }
    }

    return (
        <div className={`grid grid-cols-7 ${isMini ? 'gap-0.5' : 'auto-rows-fr bg-white dark:bg-slate-900 rounded-b-xl border border-t-0 border-slate-200 dark:border-slate-800 flex-1'}`}>
            {/* Headers handled outside for big cal, inside could be better for mini but consistent is ok */}
            {days}
        </div>
    );
  };

  const renderYearView = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {monthNames.map((m, idx) => {
                const miniDate = new Date(currentDate.getFullYear(), idx, 1);
                return (
                    <div key={m} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setCurrentDate(miniDate); setViewMode('month'); }}>
                        <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">{m}</h4>
                        <div className="grid grid-cols-7 text-[10px] text-slate-400 mb-1 text-center">
                            {daysOfWeek.map(d => <div key={d}>{d[0]}</div>)}
                        </div>
                        {renderMonthGrid(miniDate, true)}
                    </div>
                )
            })}
        </div>
    )
  };

  const renderDayView = () => {
    const dayEntries = getEntriesForDate(currentDate);
    
    return (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-8 flex-1">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
                {currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                <span className="text-sm font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{dayEntries.length} entries</span>
            </h3>

            {dayEntries.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    <p>No entries for this day.</p>
                    <button 
                        onClick={() => navigate('/new', { state: { date: currentDate.getTime() } })} 
                        className="mt-4 text-indigo-600 font-medium hover:underline"
                    >
                        Write something?
                    </button>
                </div>
            ) : (
                <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                    {dayEntries.map((entry, idx) => (
                         <div key={entry.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            {/* Icon / Dot */}
                            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-slate-900 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${getMoodColor(entry.analysis.mood)} text-white`}>
                                <span className="text-xs font-bold">{idx + 1}</span>
                            </div>
                            
                            {/* Card */}
                            <div 
                                className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer" 
                                onClick={() => handleEntryClick(entry)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-mono text-xs text-slate-500">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit'})}</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-700 text-slate-500">{entry.mode}</span>
                                </div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">{entry.analysis.mood}</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">{entry.analysis.summary}</p>
                                <div className="mt-3 flex gap-2">
                                    {(entry.analysis.manualTags || []).slice(0,3).map(k => <span key={k} className="text-[10px] bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-slate-500">#{k}</span>)}
                                </div>
                            </div>
                         </div>
                    ))}
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
        {/* Header */}
        <div className="shrink-0 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-4">
                 <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <CalendarIcon size={24} />
                 </div>
                 <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {viewMode === 'year' 
                            ? currentDate.getFullYear() 
                            : currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric', day: viewMode === 'day' ? 'numeric' : undefined })
                        }
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{viewMode} View</p>
                 </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mr-2">
                    <button onClick={() => setViewMode('year')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'year' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-500'}`}>Year</button>
                    <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'month' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-500'}`}>Month</button>
                    <button onClick={() => setViewMode('day')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'day' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-500'}`}>Day</button>
                </div>
                
                <div className="flex gap-1">
                    <button onClick={() => navigateTime('prev')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ChevronLeft size={20}/></button>
                    <button onClick={() => { setCurrentDate(new Date()); setViewMode('month'); }} className="px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-indigo-600 dark:text-indigo-400">Today</button>
                    <button onClick={() => navigateTime('next')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ChevronRight size={20}/></button>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
            {viewMode === 'year' && renderYearView()}
            {viewMode === 'month' && (
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col h-full">
                    <div className="grid grid-cols-7 text-sm font-medium text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2 mb-2 text-center">
                        {daysOfWeek.map(d => <div key={d}>{d}</div>)}
                    </div>
                    {renderMonthGrid(currentDate)}
                </div>
            )}
            {viewMode === 'day' && renderDayView()}
        </div>
    </div>
  );
};

export default CalendarView;