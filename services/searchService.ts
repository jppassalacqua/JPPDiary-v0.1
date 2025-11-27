
import { DiaryEntry } from '../types';
import { FilterState } from '../components/FilterPanel';

export const searchService = {
    /**
     * Filters entries based on comprehensive criteria including fuzzy text match,
     * date ranges, metadata tags, and media presence.
     */
    filterEntries: (entries: DiaryEntry[], filters: FilterState): DiaryEntry[] => {
        return entries.filter(entry => {
            // 1. Text Search (Smart Token Match)
            if (filters.text && filters.text.trim()) {
                const searchTerms = filters.text.toLowerCase().trim().split(/\s+/);
                const searchableText = [
                    entry.content,
                    entry.analysis.summary,
                    ...(entry.analysis.manualTags || []),
                    ...(entry.analysis.entities?.map(e => e.name) || []),
                    entry.city || '',
                    entry.country || ''
                ].join(' ').toLowerCase();

                // All tokens must be present (partial match allowed)
                const matchesText = searchTerms.every(term => searchableText.includes(term));
                if (!matchesText) return false;
            }

            // 2. Date Range
            const entryDate = new Date(entry.timestamp);
            if (filters.startDate) {
                const start = new Date(filters.startDate);
                if (entryDate < start) return false;
            }
            if (filters.endDate) {
                const end = new Date(filters.endDate);
                // Set end date to end of day
                end.setHours(23, 59, 59, 999);
                if (entryDate > end) return false;
            }

            // 3. Moods (OR logic)
            if (filters.selectedMoods.length > 0) {
                if (!filters.selectedMoods.includes(entry.analysis.mood)) return false;
            }

            // 4. Tags (OR logic - at least one must match if tags selected)
            if (filters.selectedTags.length > 0) {
                const entryTags = entry.analysis.manualTags || [];
                const hasTag = filters.selectedTags.some(tag => entryTags.includes(tag));
                if (!hasTag) return false;
            }

            // 5. Entities (OR logic)
            if (filters.selectedEntities.length > 0) {
                const entryEntities = entry.analysis.entities?.map(e => e.name) || [];
                const hasEntity = filters.selectedEntities.some(ent => entryEntities.includes(ent));
                if (!hasEntity) return false;
            }

            // 6. Location (OR logic)
            if (filters.selectedCountries.length > 0) {
                if (!entry.country || !filters.selectedCountries.includes(entry.country)) return false;
            }
            if (filters.selectedCities.length > 0) {
                if (!entry.city || !filters.selectedCities.includes(entry.city)) return false;
            }

            // 7. Media & Context (AND logic relative to specific filters selected)
            // If "Has Image" is selected, entry MUST have image.
            if (filters.media && filters.media.length > 0) {
                if (filters.media.includes('hasImage')) {
                    const hasImg = (entry.images && entry.images.length > 0) || !!entry.image;
                    if (!hasImg) return false;
                }
                if (filters.media.includes('hasAudio')) {
                    const hasAudio = entry.audio && entry.audio.length > 0;
                    if (!hasAudio) return false;
                }
                if (filters.media.includes('hasLocation')) {
                    const hasLoc = !!entry.location && !!entry.location.lat;
                    if (!hasLoc) return false;
                }
            }

            return true;
        });
    }
};
