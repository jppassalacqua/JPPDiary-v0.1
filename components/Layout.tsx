
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../services/translations';
import { appConfig } from '../config/appConfig';
import * as Icons from 'lucide-react'; 

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Sidebar Resizing State
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
      const saved = localStorage.getItem(appConfig.storageKeys.LAYOUT_SIDEBAR_WIDTH);
      return saved ? parseInt(saved, 10) : appConfig.ui.defaultSidebarWidth;
  });
  const isResizing = useRef(false);

  useEffect(() => {
    const handleFallbackWarning = (e: Event) => {
      const customEvent = e as CustomEvent;
      setStorageWarning(customEvent.detail?.message || "Server unreachable. Using local storage.");
      
      const timer = setTimeout(() => setStorageWarning(null), 5000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('gemini-diary-storage-warning', handleFallbackWarning);
    return () => window.removeEventListener('gemini-diary-storage-warning', handleFallbackWarning);
  }, []);

  // Resizing Logic
  const startResizing = useCallback(() => {
      isResizing.current = true;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem(appConfig.storageKeys.LAYOUT_SIDEBAR_WIDTH, sidebarWidth.toString());
  }, [sidebarWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isResizing.current) return;
      let newWidth = e.clientX;
      if (newWidth < appConfig.ui.minSidebarWidth) newWidth = appConfig.ui.minSidebarWidth;
      if (newWidth > 450) newWidth = 450;
      setSidebarWidth(newWidth);
  }, []);

  if (!user) return <>{children}</>;

  const NavItem = ({ to, iconName, label }: { to: string; iconName: string; label: string }) => {
    const isActive = location.pathname === to;
    // Dynamic Icon Resolution
    // @ts-ignore
    const IconComponent = Icons[iconName] || Icons.HelpCircle;

    return (
      <button
        onClick={() => {
          navigate(to);
          setIsMobileMenuOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${
          isActive
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-600/20 dark:text-indigo-300 dark:border-indigo-500/30'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
        }`}
      >
        <IconComponent size={20} />
        <span className="font-medium">{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 flex flex-col md:flex-row transition-colors duration-300">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <Icons.Sparkles size={24} />
          <span className="font-bold text-xl tracking-tight">Gemini Diary</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600 dark:text-slate-300">
            {isMobileMenuOpen ? <Icons.X size={24} /> : <Icons.Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky md:top-0 h-[calc(100vh-65px)] md:h-screen bg-white/95 dark:bg-slate-900/95 md:bg-white md:dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 backdrop-blur-xl z-40 flex flex-col transition-transform duration-300 ease-in-out md:transition-none ${
          isMobileMenuOpen ? 'translate-x-0 w-full' : '-translate-x-full md:translate-x-0'
        }`}
        style={{ 
            width: isMobileMenuOpen ? '100%' : (window.innerWidth >= 768 ? `${sidebarWidth}px` : '100%'),
            top: isMobileMenuOpen ? '65px' : '0'
        }}
      >
        {/* Sidebar Header */}
        <div className="shrink-0 p-6 hidden md:flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
          <Icons.Sparkles size={28} />
          <span className="font-bold text-2xl tracking-tight">Gemini Diary</span>
        </div>

        {/* Scrollable Menu Content */}
        <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
          
          {appConfig.menuItems.map((item, index) => {
              // Role check
              if (item.role && user.role !== item.role) return null;

              return (
                  <React.Fragment key={item.id}>
                      {item.sectionTitle && (
                          <div className={`px-4 py-2 mb-2 ${index > 0 ? 'mt-6' : ''}`}>
                              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">{item.sectionTitle}</p>
                          </div>
                      )}
                      {item.divider && <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />}
                      
                      <NavItem 
                        to={item.path} 
                        iconName={item.icon} 
                        label={t(item.labelKey)} 
                      />
                  </React.Fragment>
              );
          })}

          <div className="h-4"></div> {/* Spacer */}
        </div>

        {/* Footer User Info */}
        <div className="shrink-0 w-full p-4 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            {user.preferences.customColors?.background ? (
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold border border-slate-200 dark:border-slate-700 shrink-0"
                  style={{ backgroundColor: user.preferences.customColors.primary, color: '#fff' }}
                >
                    {user.displayName.charAt(0)}
                </div>
            ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500 flex items-center justify-center text-indigo-700 dark:text-white font-bold border border-indigo-200 dark:border-transparent shrink-0">
                    {user.displayName.charAt(0)}
                </div>
            )}
            
            <div className="flex-1 overflow-hidden min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{user.displayName}</p>
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                {user.role === 'admin' && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded">ADMIN</span>}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <button
              onClick={logout}
              className="flex items-center gap-3 px-4 py-2 w-full text-slate-500 hover:text-red-500 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm"
            >
              <Icons.LogOut size={16} />
              {t('signOut')}
            </button>
          </div>
        </div>

        {/* Desktop Resizer Handle */}
        <div 
            onMouseDown={startResizing}
            className="hidden md:block absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/30 transition-colors z-50"
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-[calc(100vh-65px)] md:h-screen w-full relative">
         <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/50 via-slate-50 to-slate-50 dark:from-indigo-900/20 dark:via-slate-950 dark:to-slate-950 pointer-events-none -z-10" />
        <div className="container mx-auto max-w-[98%] 2xl:max-w-[1800px] p-2 md:p-6 h-full flex flex-col">
          {children}
        </div>
      </main>

      {/* Warning Toast */}
      {storageWarning && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
          <div className="bg-amber-50 dark:bg-amber-900/90 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-md">
            <Icons.AlertTriangle size={20} className="shrink-0" />
            <div>
              <p className="font-semibold text-sm">Connection Issue</p>
              <p className="text-xs opacity-90">{storageWarning}</p>
            </div>
            <button 
              onClick={() => setStorageWarning(null)}
              className="ml-2 p-1 hover:bg-amber-100 dark:hover:bg-amber-800 rounded-full transition-colors"
            >
              <Icons.X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
