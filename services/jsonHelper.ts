
import { DiaryEntry } from '../types';

export const jsonHelper = {
  exportEntries: (entries: DiaryEntry[]): string => {
    // Pretty print JSON with 2 spaces indentation
    return JSON.stringify(entries, null, 2);
  },

  parseJSONToEntries: (jsonString: string, userId: string): DiaryEntry[] => {
    try {
        const parsed = JSON.parse(jsonString);
        
        if (!Array.isArray(parsed)) {
            throw new Error("Invalid JSON format: Expected an array of entries.");
        }

        // basic validation and sanitization
        return parsed.map((item: any) => {
            // Ensure essential fields exist
            if (!item.id || !item.timestamp) {
                console.warn("Skipping invalid entry item", item);
                return null;
            }

            return {
                ...item,
                userId: userId, // Force ownership to current user
                // Ensure timestamp is a number (handle ISO strings if exported that way)
                timestamp: typeof item.timestamp === 'string' ? new Date(item.timestamp).getTime() : item.timestamp
            } as DiaryEntry;
        }).filter((e): e is DiaryEntry => e !== null);

    } catch (e) {
        console.error("Failed to parse JSON entries", e);
        throw new Error("Invalid JSON file.");
    }
  }
};
