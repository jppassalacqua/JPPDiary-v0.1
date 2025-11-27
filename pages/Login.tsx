import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ArrowRight, Lock, User, Eye, EyeOff, Server } from 'lucide-react';
import { db } from '../services/db';
import { useTranslation } from '../services/translations';

const Login: React.FC = () => {
  const { login, register } = useAuth();
  const { t } = useTranslation();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Storage Config
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [config, setConfig] = useState(db.getConfig());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!username.trim()) {
      setError(t('username') + ' is required');
      setIsSubmitting(false);
      return;
    }
    
    if (!password.trim()) {
      setError(t('password') + ' is required');
      setIsSubmitting(false);
      return;
    }

    if (isRegistering) {
      if (!displayName.trim()) {
        setError(t('displayName') + ' is required');
        setIsSubmitting(false);
        return;
      }
      const success = await register(username, password, displayName);
      if (!success) setError('Username already taken or registration failed.');
    } else {
      const result = await login(username, password);
      if (!result.success) setError(result.message || 'Login failed');
    }
    setIsSubmitting(false);
  };

  const handleConfigSave = () => {
      db.setDbConfig(config.useServer, config.serverUrl);
      setShowServerConfig(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-300">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-100 dark:bg-indigo-900/20 rounded-full blur-[120px] -z-10" />

      {/* Server Config Modal/Panel */}
      {showServerConfig && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center gap-2">
                      <Server size={20} /> {t('serverConfig')}
                  </h3>
                  <div className="space-y-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                              type="checkbox" 
                              checked={config.useServer}
                              onChange={e => setConfig({...config, useServer: e.target.checked})}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-slate-700 dark:text-slate-300">{t('useRemote')}</span>
                      </label>
                      
                      <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Server URL</label>
                          <input 
                              type="text" 
                              value={config.serverUrl}
                              onChange={e => setConfig({...config, serverUrl: e.target.value})}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200"
                              disabled={!config.useServer}
                          />
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                          <button onClick={handleConfigSave} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-500">{t('apply')}</button>
                          <button onClick={() => setShowServerConfig(false)} className="flex-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2 rounded-lg">{t('cancel')}</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="w-full max-w-md p-8 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8 relative">
          <button 
            onClick={() => setShowServerConfig(true)}
            className="absolute right-0 top-0 text-slate-400 hover:text-indigo-500 transition-colors"
            title="Configure Connection"
          >
              <Server size={18} />
          </button>
          
          <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl mb-4">
            <Sparkles className="text-indigo-600 dark:text-indigo-400" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Gemini Diary</h1>
          <p className="text-slate-500 dark:text-slate-400 text-center">Your AI-powered companion for reflection and emotional growth.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('username')}</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-3.5 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                placeholder="e.g., star_gazer"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('password')}</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-3.5 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-12 py-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                placeholder="Enter password"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {isRegistering && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('displayName')}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                placeholder="What should we call you?"
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 group mt-2"
          >
            <span>{isSubmitting ? 'Processing...' : (isRegistering ? t('createAccount') : t('signIn'))}</span>
            {!isSubmitting && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium transition-colors"
            >
              {isRegistering ? t('signIn') : t('register')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
