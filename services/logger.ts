


import { db } from './db';
import { appConfig } from '../config/appConfig';
import { LogEntry, LogLevel } from '../types';

export const logger = {
    log: async (level: LogLevel, source: string, message: string, data?: any) => {
        const entry: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            level,
            source,
            message,
            data
        };

        try {
            await db.saveLog(entry);
            // Console output for dev
            const style = level === 'ERROR' ? 'color: red' : level === 'WARN' ? 'color: orange' : 'color: blue';
            console.log(`%c[${level}] ${source}: ${message}`, style, data || '');
        } catch (e) {
            console.error("Logger failed to save:", e);
        }
    },

    info: (source: string, message: string, data?: any) => logger.log('INFO', source, message, data),
    warn: (source: string, message: string, data?: any) => logger.log('WARN', source, message, data),
    error: (source: string, message: string, data?: any) => logger.log('ERROR', source, message, data),

    // Log Rotation Logic
    initRotation: async (retentionDays?: number) => {
        try {
            const days = retentionDays || appConfig.logging.retentionDays || 30;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const timestamp = cutoffDate.getTime();

            const count = await db.cleanLogs(timestamp);
            if (count > 0) {
                console.log(`[System] Cleaned ${count} old log entries.`);
                // Log the cleanup event itself (fresh entry)
                await logger.info('System', `Log rotation executed. Removed ${count} entries older than ${days} days.`);
            }
        } catch (e) {
            console.error("Log rotation failed", e);
        }
    }
};