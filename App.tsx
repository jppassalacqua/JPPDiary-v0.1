
import React from 'react';
import { Routes, Route, Navigate, HashRouter, MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ConfigProvider } from './context/ConfigContext';
import { SessionProvider } from './context/SessionContext';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewEntry from './pages/NewEntry';
import History from './pages/History';
import CalendarView from './pages/CalendarView';
import GraphView from './pages/GraphView';
import TagsView from './pages/TagsView';
import MapView from './pages/MapView';
import Interview from './pages/Interview';
import AskGemini from './pages/AskGemini';
import CatalogView from './pages/CatalogView';
import { SettingsPage } from './pages/Settings';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import LogViewer from './pages/LogViewer';
import { Loader2 } from 'lucide-react';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/" replace />;
    return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
    return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center transition-colors duration-300">
        <Loader2 className="animate-spin text-indigo-500" size={40} />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new" element={<NewEntry />} />
        <Route path="/interview" element={<Interview />} />
        <Route path="/ask" element={<AskGemini />} />
        <Route path="/history" element={<History />} />
        <Route path="/catalog" element={<CatalogView />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/graph" element={<GraphView />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/tags" element={<TagsView />} />
        <Route path="/settings" element={<SettingsPage />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={
            <AdminRoute>
                <AdminPanel />
            </AdminRoute>
        } />
        <Route path="/admin/logs" element={
            <AdminRoute>
                <LogViewer />
            </AdminRoute>
        } />
        <Route path="/admin/user/:userId" element={
            <AdminRoute>
                <Dashboard />
            </AdminRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

const App: React.FC = () => {
  // Detect if running in a Blob environment (e.g. AIStudio Preview)
  // In blob contexts, modifying window.location (which HashRouter does) throws security errors.
  const isBlob = window.location.protocol === 'blob:';
  const Router = isBlob ? MemoryRouter : HashRouter;

  return (
    <ConfigProvider>
      <AuthProvider>
        <SessionProvider>
          <ThemeProvider>
            <Router>
              <AppRoutes />
            </Router>
          </ThemeProvider>
        </SessionProvider>
      </AuthProvider>
    </ConfigProvider>
  );
};

export default App;
