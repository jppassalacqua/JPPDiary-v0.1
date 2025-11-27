
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { DiaryEntry, EntryMode } from '../types';

/**
 * Service to handle exporting diary entries into a structured ZIP archive.
 * Structure: Year/Month/Day/YYYYMMDDHHMMSS.txt + attachments
 */
export const zipHelper = {
  createZipArchive: async (entries: DiaryEntry[], displayName: string) => {
    const zip = new JSZip();
    
    for (const entry of entries) {
        const date = new Date(entry.timestamp);
        
        // Format: YYYY, MM, DD
        const year = date.getFullYear().toString();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        // Format Time for Filename: HHMMSS
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');
        
        const datePrefix = `${year}${month}${day}`;
        const timeSuffix = `${hour}${minute}${second}`;
        const baseFilename = `${datePrefix}${timeSuffix}`;
        
        // Define Folder Path: Year/Month/Day/
        const folderPath = zip.folder(year)?.folder(month)?.folder(day);
        
        if (!folderPath) continue;

        // 1. Prepare Text Content
        let contentText = "";
        
        // Header info
        contentText += `Date: ${date.toLocaleString()}\n`;
        if (entry.location) {
            contentText += `Location: ${entry.location.lat}, ${entry.location.lng}`;
            if (entry.city) contentText += ` (${entry.city}, ${entry.country})`;
            contentText += `\n`;
        }
        if (entry.address) contentText += `Address: ${entry.address}\n`;
        
        contentText += `Mood: ${entry.analysis.mood} (Score: ${entry.analysis.sentimentScore.toFixed(2)})\n`;
        
        const allTags = [...(entry.analysis.manualTags || [])];
        if (allTags.length > 0) contentText += `Tags: ${allTags.join(', ')}\n`;
        
        contentText += `Summary: ${entry.analysis.summary}\n`;
        contentText += `--------------------------------------------------\n\n`;
        
        // Main Body
        if (entry.mode === EntryMode.Chat) {
            try {
                const history = JSON.parse(entry.content);
                if (Array.isArray(history)) {
                    contentText += history.map((m: any) => `[${m.role.toUpperCase()}]: ${m.text}`).join('\n\n');
                } else {
                    contentText += entry.content;
                }
            } catch (e) {
                contentText += entry.content;
            }
        } else {
            contentText += entry.content;
        }

        // Add Text File
        folderPath.file(`${baseFilename}.txt`, contentText);

        // 2. Handle Images
        const images = entry.images && entry.images.length > 0 ? entry.images : (entry.image ? [entry.image] : []);
        
        images.forEach((imgBase64, index) => {
            if (typeof imgBase64 === 'string' && imgBase64.startsWith('data:')) {
                const meta = imgBase64.split(',')[0]; // data:image/png;base64
                const data = imgBase64.split(',')[1];
                
                let ext = 'png';
                if (meta.includes('jpeg') || meta.includes('jpg')) ext = 'jpg';
                else if (meta.includes('gif')) ext = 'gif';
                else if (meta.includes('webp')) ext = 'webp';

                const filename = images.length > 1 
                    ? `${baseFilename}_img_${index + 1}.${ext}`
                    : `${baseFilename}.${ext}`;
                
                folderPath.file(filename, data, { base64: true });
            }
        });

        // 3. Handle Audio
        if (entry.audio && entry.audio.length > 0) {
            entry.audio.forEach((audioBase64, index) => {
                if (typeof audioBase64 === 'string' && audioBase64.startsWith('data:')) {
                    const meta = audioBase64.split(',')[0];
                    const data = audioBase64.split(',')[1];
                    
                    let ext = 'webm'; // Default for MediaRecorder
                    if (meta.includes('mp3')) ext = 'mp3';
                    else if (meta.includes('wav')) ext = 'wav';
                    else if (meta.includes('ogg')) ext = 'ogg';
                    else if (meta.includes('aac')) ext = 'aac';

                    const filename = `${baseFilename}_audio_${index + 1}.${ext}`;
                    
                    folderPath.file(filename, data, { base64: true });
                }
            });
        }
    }

    // Generate ZIP blob
    const content = await zip.generateAsync({ type: 'blob' });
    const sanitizedName = displayName.replace(/[^a-z0-9]/gi, '_');
    saveAs(content, `GeminiDiary_Archive_${sanitizedName}_${new Date().toISOString().split('T')[0]}.zip`);
  }
};
