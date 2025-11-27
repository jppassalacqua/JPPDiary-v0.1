
import React, { useState, useMemo } from 'react';
import { useTranslation } from '../services/translations';
import { mapService } from '../services/mapService';
import { DiaryEntry } from '../types';
import { Loader2, Crosshair, Search } from 'lucide-react';

interface LocationDetails {
    address?: string;
    city?: string;
    country?: string;
}

interface EntryMetadataProps {
    entryDate: Date;
    setEntryDate: (date: Date) => void;
    location?: { lat: number; lng: number };
    setLocation: (loc?: { lat: number; lng: number }) => void;
    locationDetails: LocationDetails;
    setLocationDetails: React.Dispatch<React.SetStateAction<LocationDetails>>;
    existingEntries: DiaryEntry[];
}

export const EntryMetadata: React.FC<EntryMetadataProps> = ({
    entryDate,
    setEntryDate,
    location,
    setLocation,
    locationDetails,
    setLocationDetails,
    existingEntries
}) => {
    const { t } = useTranslation();
    const [addressInput, setAddressInput] = useState('');
    const [isGeocoding, setIsGeocoding] = useState(false);

    // Helpers
    const toLocalISOString = (date: Date) => {
        const pad = (num: number) => num.toString().padStart(2, '0');
        return (
            date.getFullYear() +
            '-' +
            pad(date.getMonth() + 1) +
            '-' +
            pad(date.getDate()) +
            'T' +
            pad(date.getHours()) +
            ':' +
            pad(date.getMinutes())
        );
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            setEntryDate(new Date(e.target.value));
        }
    };

    // Autocomplete Lists
    const availableCountries = useMemo(() => {
        const s = new Set<string>();
        existingEntries.forEach(e => { if (e.country) s.add(e.country); });
        return Array.from(s).sort();
    }, [existingEntries]);

    const availableCities = useMemo(() => {
        const s = new Set<string>();
        existingEntries.forEach(e => { 
            if (e.city) {
               if (!locationDetails.country || e.country === locationDetails.country) {
                   s.add(e.city);
               }
            } 
        });
        return Array.from(s).sort();
    }, [existingEntries, locationDetails.country]);

    // Location Logic
    const updateLocationState = async (lat: number, lng: number) => {
        setLocation({ lat, lng });
        const details = await mapService.reverseGeocode(lat, lng);
        setLocationDetails(prev => ({
            address: details.address || prev.address,
            city: details.city || prev.city,
            country: details.country || prev.country
        }));
    };

    const handleGeolocation = () => {
        setIsGeocoding(true);
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    await updateLocationState(latitude, longitude);
                    setIsGeocoding(false);
                },
                (err) => {
                    setIsGeocoding(false);
                    alert('Could not get location');
                }
            );
        } else {
            setIsGeocoding(false);
            alert("Geolocation not supported");
        }
    };

    const handleAddressSearch = async () => {
        if (!addressInput.trim()) return;
        setIsGeocoding(true);
        const pos = await mapService.geocodeAddress(addressInput);
        
        if (pos) {
            await updateLocationState(pos.lat, pos.lng);
            setAddressInput('');
        } else {
            alert(t('addressNotFound'));
        }
        setIsGeocoding(false);
    };

    const removeLocation = () => {
        setLocation(undefined);
        setLocationDetails({});
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Date Section */}
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('entryDate')}</label>
                <input 
                    type="datetime-local"
                    value={toLocalISOString(entryDate)}
                    onChange={handleDateChange}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            {/* Location Section */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t('locationTools')}</label>
                    {location && (
                        <button onClick={removeLocation} className="text-xs text-red-500 hover:underline">Clear</button>
                    )}
                </div>
                
                {/* Editable Fields */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                        <input 
                            type="text" 
                            list="countries"
                            placeholder={t('country')}
                            value={locationDetails.country || ''}
                            onChange={e => setLocationDetails({...locationDetails, country: e.target.value})}
                            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500"
                        />
                        <datalist id="countries">
                            {availableCountries.map(c => <option key={c} value={c} />)}
                        </datalist>
                    </div>
                    <div>
                        <input 
                            type="text" 
                            list="cities"
                            placeholder={t('city')}
                            value={locationDetails.city || ''}
                            onChange={e => setLocationDetails({...locationDetails, city: e.target.value})}
                            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500"
                        />
                        <datalist id="cities">
                            {availableCities.map(c => <option key={c} value={c} />)}
                        </datalist>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={handleGeolocation} disabled={isGeocoding} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors">
                        {isGeocoding ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />} {t('useGps')}
                    </button>
                    <div className="flex-1 relative">
                        <input 
                            type="text" 
                            value={addressInput} 
                            onChange={e => setAddressInput(e.target.value)}
                            placeholder="Address..."
                            className="w-full pl-2 pr-7 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-indigo-500"
                            onKeyDown={e => e.key === 'Enter' && handleAddressSearch()}
                        />
                        <button onClick={handleAddressSearch} disabled={isGeocoding} className="absolute right-1 top-1 p-1 text-slate-400 hover:text-indigo-500">
                            <Search size={14} />
                        </button>
                    </div>
                </div>
                
                {(locationDetails.address || location) && (
                    <div className="mt-2 text-[10px] text-slate-400 truncate">
                        {locationDetails.address || `${location?.lat}, ${location?.lng}`}
                    </div>
                )}
            </div>
        </div>
    );
};
