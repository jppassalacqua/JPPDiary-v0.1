
import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../services/db';
import { AiConfig } from '../types';

interface ConfigContextType {
    aiConfig: AiConfig;
    updateAiConfig: (config: AiConfig) => Promise<void>;
    refreshConfig: () => Promise<void>;
    isLoading: boolean;
}

const defaultAiConfig: AiConfig = {
    provider: 'gemini',
    localUrl: 'http://localhost:11434/v1',
    localModel: 'llama3'
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [aiConfig, setAiConfig] = useState<AiConfig>(defaultAiConfig);
    const [isLoading, setIsLoading] = useState(true);

    const refreshConfig = async () => {
        try {
            const settings = await db.getSystemSettings();
            if (settings.aiConfig) {
                setAiConfig(settings.aiConfig);
            }
        } catch (e) {
            console.error("Failed to load system settings", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshConfig();
    }, []);

    const updateAiConfig = async (newConfig: AiConfig) => {
        await db.saveSystemSettings({ aiConfig: newConfig });
        setAiConfig(newConfig);
    };

    return (
        <ConfigContext.Provider value={{ aiConfig, updateAiConfig, refreshConfig, isLoading }}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => {
    const context = useContext(ConfigContext);
    if (!context) throw new Error("useConfig must be used within ConfigProvider");
    return context;
};
