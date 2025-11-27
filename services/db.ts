
import { User, DiaryEntry, CatalogEntry, LogEntry, LogLevel, SystemSettings } from '../types';
import { appConfig } from '../config/appConfig';

// --- Interface ---
interface DBProvider {
  getUsers(): Promise<User[]>;
  saveUser(user: User): Promise<void>;
  updateUser(user: User): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  findUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getEntries(userId: string): Promise<DiaryEntry[]>;
  saveEntry(entry: DiaryEntry): Promise<void>;
  deleteEntry(entryId: string): Promise<void>;
  // Catalog
  getCatalog(userId: string): Promise<CatalogEntry[]>;
  saveCatalogEntry(entry: CatalogEntry): Promise<void>;
  deleteCatalogEntry(itemId: string): Promise<void>;
  // Logs
  saveLog(entry: LogEntry): Promise<void>;
  getLogs(limit?: number): Promise<LogEntry[]>;
  cleanLogs(beforeTimestamp: number): Promise<number>;
  // Settings
  getSystemSettings(): Promise<Partial<SystemSettings>>;
  saveSystemSettings(settings: Partial<SystemSettings>): Promise<void>;
  // System
  getFullBackup(): Promise<{ users: User[], entries: DiaryEntry[], catalog: CatalogEntry[] }>;
  restoreFullBackup(data: { users: User[], entries: DiaryEntry[], catalog: CatalogEntry[] }): Promise<void>;
}

// --- Local Storage Implementation (Settings Mock) ---
const localDB: DBProvider = {
  // ... existing User/Entry/Catalog implementations ...
  getUsers: async () => {
    const raw = localStorage.getItem(appConfig.storageKeys.USERS);
    return raw ? JSON.parse(raw) : [];
  },
  saveUser: async (user) => {
    const users = await localDB.getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) users[idx] = user;
    else users.push(user);
    localStorage.setItem(appConfig.storageKeys.USERS, JSON.stringify(users));
  },
  updateUser: async (user) => { await localDB.saveUser(user); },
  deleteUser: async (userId) => {
    let users = await localDB.getUsers();
    users = users.filter(u => u.id !== userId);
    localStorage.setItem(appConfig.storageKeys.USERS, JSON.stringify(users));
    // ... cleanup entries ...
  },
  findUserByUsername: async (username) => {
    const users = await localDB.getUsers();
    return users.find(u => u.username === username);
  },
  getUserById: async (id) => {
    const users = await localDB.getUsers();
    return users.find(u => u.id === id);
  },
  getEntries: async (userId) => {
    const raw = localStorage.getItem(appConfig.storageKeys.ENTRIES);
    const all: DiaryEntry[] = raw ? JSON.parse(raw) : [];
    return all.filter(e => e.userId === userId).sort((a, b) => b.timestamp - a.timestamp);
  },
  saveEntry: async (entry) => {
    const raw = localStorage.getItem(appConfig.storageKeys.ENTRIES);
    const all: DiaryEntry[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(e => e.id === entry.id);
    if (idx >= 0) all[idx] = entry;
    else all.push(entry);
    localStorage.setItem(appConfig.storageKeys.ENTRIES, JSON.stringify(all));
  },
  deleteEntry: async (entryId) => {
    const raw = localStorage.getItem(appConfig.storageKeys.ENTRIES);
    const all: DiaryEntry[] = raw ? JSON.parse(raw) : [];
    const filtered = all.filter(e => e.id !== entryId);
    localStorage.setItem(appConfig.storageKeys.ENTRIES, JSON.stringify(filtered));
  },
  getCatalog: async (userId) => {
      const raw = localStorage.getItem(appConfig.storageKeys.CATALOG);
      const all: CatalogEntry[] = raw ? JSON.parse(raw) : [];
      return all.filter(c => c.userId === userId).sort((a,b) => a.name.localeCompare(b.name));
  },
  saveCatalogEntry: async (entry) => {
      const raw = localStorage.getItem(appConfig.storageKeys.CATALOG);
      const all: CatalogEntry[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex(c => c.id === entry.id);
      if (idx >= 0) all[idx] = entry;
      else all.push(entry);
      localStorage.setItem(appConfig.storageKeys.CATALOG, JSON.stringify(all));
  },
  deleteCatalogEntry: async (itemId) => {
      const raw = localStorage.getItem(appConfig.storageKeys.CATALOG);
      const all: CatalogEntry[] = raw ? JSON.parse(raw) : [];
      const filtered = all.filter(c => c.id !== itemId);
      localStorage.setItem(appConfig.storageKeys.CATALOG, JSON.stringify(filtered));
  },
  saveLog: async (entry) => {
      const logsRaw = localStorage.getItem(appConfig.storageKeys.LOGS);
      const logs: LogEntry[] = logsRaw ? JSON.parse(logsRaw) : [];
      logs.unshift(entry);
      if (logs.length > 1000) logs.length = 1000;
      localStorage.setItem(appConfig.storageKeys.LOGS, JSON.stringify(logs));
  },
  getLogs: async (limit = 1000) => {
      const logsRaw = localStorage.getItem(appConfig.storageKeys.LOGS);
      return logsRaw ? JSON.parse(logsRaw).slice(0, limit) : [];
  },
  cleanLogs: async (beforeTimestamp) => {
      const logsRaw = localStorage.getItem(appConfig.storageKeys.LOGS);
      if (!logsRaw) return 0;
      let logs: LogEntry[] = JSON.parse(logsRaw);
      const initialCount = logs.length;
      logs = logs.filter(l => l.timestamp >= beforeTimestamp);
      localStorage.setItem(appConfig.storageKeys.LOGS, JSON.stringify(logs));
      return initialCount - logs.length;
  },
  getSystemSettings: async () => {
      const raw = localStorage.getItem('gemini_diary_sys_settings');
      return raw ? JSON.parse(raw) : {};
  },
  saveSystemSettings: async (settings) => {
      const current = await localDB.getSystemSettings();
      localStorage.setItem('gemini_diary_sys_settings', JSON.stringify({ ...current, ...settings }));
  },
  getFullBackup: async () => {
      const users = await localDB.getUsers();
      const rawEntries = localStorage.getItem(appConfig.storageKeys.ENTRIES);
      const entries = rawEntries ? JSON.parse(rawEntries) : [];
      const rawCatalog = localStorage.getItem(appConfig.storageKeys.CATALOG);
      const catalog = rawCatalog ? JSON.parse(rawCatalog) : [];
      return { users, entries, catalog };
  },
  restoreFullBackup: async (data) => {
      if (data.users) localStorage.setItem(appConfig.storageKeys.USERS, JSON.stringify(data.users));
      if (data.entries) localStorage.setItem(appConfig.storageKeys.ENTRIES, JSON.stringify(data.entries));
      if (data.catalog) localStorage.setItem(appConfig.storageKeys.CATALOG, JSON.stringify(data.catalog));
  }
};

// --- Server Implementation ---
class ServerDB implements DBProvider {
  private url: string;

  constructor(url: string) {
    this.url = url.replace(/\/$/, '');
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); 
    try {
      const res = await fetch(`${this.url}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        ...options
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Server Error: ${res.statusText}`);
      return res.json();
    } catch (e) {
      clearTimeout(timeoutId);
      console.warn(`ServerDB Fetch Failed [${endpoint}]:`, e);
      throw e;
    }
  }

  // ... existing methods (getUsers, saveUser, entries, catalog, logs) ...
  async getUsers() { return this.fetch<User[]>('/users'); }
  async saveUser(user: User) { await this.fetch('/users', { method: 'POST', body: JSON.stringify(user) }); }
  async updateUser(user: User) { await this.saveUser(user); }
  async deleteUser(userId: string) { await this.fetch(`/users/${userId}`, { method: 'DELETE' }); }
  async findUserByUsername(username: string) {
    const users = await this.getUsers();
    return users.find(u => u.username === username);
  },
  async getUserById(id: string) {
    const users = await this.getUsers();
    return users.find(u => u.id === id);
  },
  async getEntries(userId: string) { return this.fetch<DiaryEntry[]>(`/entries?userId=${userId}`); }
  async saveEntry(entry: DiaryEntry) { await this.fetch('/entries', { method: 'POST', body: JSON.stringify(entry) }); }
  async deleteEntry(entryId: string) { await this.fetch(`/entries/${entryId}`, { method: 'DELETE' }); }
  async getCatalog(userId: string) { return this.fetch<CatalogEntry[]>(`/catalog?userId=${userId}`); }
  async saveCatalogEntry(entry: CatalogEntry) { await this.fetch('/catalog', { method: 'POST', body: JSON.stringify(entry) }); }
  async deleteCatalogEntry(itemId: string) { await this.fetch(`/catalog/${itemId}`, { method: 'DELETE' }); }
  async saveLog(entry: LogEntry) { this.fetch('/logs', { method: 'POST', body: JSON.stringify(entry) }).catch(() => {}); }
  async getLogs(limit = 1000) { return this.fetch<LogEntry[]>(`/admin/logs?limit=${limit}`); }
  async cleanLogs(beforeTimestamp: number) { const res = await this.fetch<{deleted: number}>(`/admin/logs?before=${beforeTimestamp}`, { method: 'DELETE' }); return res.deleted; }
  async getFullBackup() { return this.fetch<{ users: User[], entries: DiaryEntry[], catalog: CatalogEntry[] }>('/admin/export'); }
  async restoreFullBackup(data: any) { await this.fetch('/admin/import', { method: 'POST', body: JSON.stringify(data) }); }

  // NEW Settings Implementation
  async getSystemSettings() {
      return this.fetch<Partial<SystemSettings>>('/settings');
  }
  async saveSystemSettings(settings: Partial<SystemSettings>) {
      await this.fetch('/settings', { method: 'POST', body: JSON.stringify(settings) });
  }
}

// ... Main DB Service with Fallback and Interception ...
const getConfig = () => {
    const raw = localStorage.getItem(appConfig.storageKeys.CONFIG);
    return raw ? JSON.parse(raw) : { useServer: false, serverUrl: 'http://localhost:8000' };
};

export const setDbConfig = (useServer: boolean, serverUrl: string) => {
    localStorage.setItem(appConfig.storageKeys.CONFIG, JSON.stringify({ useServer, serverUrl }));
};

const withFallback = async <T>(operation: (provider: DBProvider) => Promise<T>): Promise<T> => {
    const config = getConfig();
    if (config.useServer && config.serverUrl) {
        try {
            const serverDB = new ServerDB(config.serverUrl);
            return await operation(serverDB);
        } catch (error) {
            // Error handling...
            return operation(localDB);
        }
    }
    return operation(localDB);
};

const logInternal = async (level: LogLevel, source: string, message: string, data?: any) => {
    const entry: LogEntry = { id: crypto.randomUUID(), timestamp: Date.now(), level, source, message, data };
    withFallback(p => p.saveLog(entry)).catch(e => console.warn('Logging failed', e));
};

// Exported DB object
export const db = {
    // ... Existing exports ...
    getUsers: () => withFallback(p => p.getUsers()),
    saveUser: async (user: User) => {
        try { await withFallback(p => p.saveUser(user)); logInternal('INFO', 'Database', `User saved: ${user.username}`, { userId: user.id }); }
        catch (e) { logInternal('ERROR', 'Database', `Failed to save user`, e); throw e; }
    },
    updateUser: async (user: User) => { await withFallback(p => p.updateUser(user)); },
    deleteUser: async (userId: string) => { await withFallback(p => p.deleteUser(userId)); logInternal('WARN', 'Database', `User deleted: ${userId}`); },
    findUserByUsername: (username: string) => withFallback(p => p.findUserByUsername(username)),
    getUserById: (id: string) => withFallback(p => p.getUserById(id)),
    getEntries: (userId: string) => withFallback(p => p.getEntries(userId)),
    saveEntry: async (entry: DiaryEntry) => {
        try { await withFallback(p => p.saveEntry(entry)); logInternal('INFO', 'Database', `Entry saved`, { id: entry.id }); }
        catch (e) { logInternal('ERROR', 'Database', `Failed to save entry`, e); throw e; }
    },
    deleteEntry: async (entryId: string) => {
        try { await withFallback(p => p.deleteEntry(entryId)); logInternal('INFO', 'Database', `Entry deleted`, { id: entryId }); }
        catch (e) { logInternal('ERROR', 'Database', `Failed to delete entry`, e); throw e; }
    },
    getCatalog: (userId: string) => withFallback(p => p.getCatalog(userId)),
    saveCatalogEntry: async (entry: CatalogEntry) => {
        try { await withFallback(p => p.saveCatalogEntry(entry)); logInternal('INFO', 'Database', `Catalog item saved`, { type: entry.type }); }
        catch (e) { logInternal('ERROR', 'Database', `Failed to save catalog item`, e); throw e; }
    },
    deleteCatalogEntry: async (itemId: string) => { await withFallback(p => p.deleteCatalogEntry(itemId)); },
    
    // Logs
    saveLog: (entry: LogEntry) => withFallback(p => p.saveLog(entry)),
    getLogs: (limit?: number) => withFallback(p => p.getLogs(limit)),
    cleanLogs: (before: number) => withFallback(p => p.cleanLogs(before)),

    // Settings
    getSystemSettings: () => withFallback(p => p.getSystemSettings()),
    saveSystemSettings: async (settings: Partial<SystemSettings>) => {
        try { 
            await withFallback(p => p.saveSystemSettings(settings)); 
            logInternal('WARN', 'System', 'System Settings Updated', settings); 
        } catch (e) { 
            logInternal('ERROR', 'System', 'Failed to update settings', e); 
            throw e; 
        }
    },

    // System
    getFullBackup: () => withFallback(p => p.getFullBackup()),
    restoreFullBackup: async (data: any) => { await withFallback(p => p.restoreFullBackup(data)); },
    
    // Config Utils
    saveDraft: (userId: string, content: string) => localStorage.setItem(appConfig.storageKeys.DRAFT_PREFIX + userId, content),
    getDraft: (userId: string) => localStorage.getItem(appConfig.storageKeys.DRAFT_PREFIX + userId) || '',
    clearDraft: (userId: string) => localStorage.removeItem(appConfig.storageKeys.DRAFT_PREFIX + userId),
    getConfig,
    setDbConfig
};
