
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { DiaryEntry, Mood, EntryMode } from '../types';
import { useTranslation } from '../services/translations';
import { Map as MapIcon, Filter, MousePointer2, X, List, Search, MessageCircle, FileText, Image as ImageIcon, Volume2, MapPin } from 'lucide-react';
import { FilterPanel, FilterState } from '../components/FilterPanel';
import { searchService } from '../services/searchService';
import { useNavigate } from 'react-router-dom';
import { appConfig } from '../config/appConfig';
// @ts-ignore
import { MarkerClusterer } from "@googlemaps/markerclusterer";

// Function to get environment variable safely
const getEnvVar = (key: string, processKey: string) => {
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        return import.meta.env[key] || '';
      }
    } catch (e) {}
    try {
      if (typeof process !== 'undefined' && process.env) {
        return process.env[processKey] || '';
      }
    } catch (e) {}
    return '';
};

const GOOGLE_MAPS_API_KEY = getEnvVar('VITE_GOOGLE_MAPS_API_KEY', 'REACT_APP_GOOGLE_MAPS_API_KEY');

const MapView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  // Google Refs
  const mapInstanceRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const googleMarkersMap = useRef<Map<string, any>>(new Map());
  const infoWindowRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const drawingManagerRef = useRef<any>(null);
  const currentRectangleRef = useRef<any>(null);

  // Leaflet Refs
  const leafletMapRef = useRef<any>(null);
  const leafletClusterGroupRef = useRef<any>(null); 
  const selectionRectRef = useRef<any>(null);
  const leafletMarkersMap = useRef<Map<string, any>>(new Map());

  // List Refs
  const entryRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<'google' | 'leaflet'>('leaflet');

  // Selection State
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<DiaryEntry[]>([]);
  const [selectionStart, setSelectionStart] = useState<{lat: number, lng: number} | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

  // Filtering
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    startDate: '',
    endDate: '',
    text: '',
    selectedMoods: [],
    selectedTags: [],
    selectedEntities: [],
    selectedCountries: [],
    selectedCities: [],
    media: []
  });

  // Resizing State
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
      const saved = localStorage.getItem(appConfig.storageKeys.MAP_SIDEBAR_WIDTH);
      return saved ? parseInt(saved, 10) : appConfig.ui.defaultMapSidebarWidth;
  });
  const isResizing = useRef(false);

  // 1. Determine Provider and Fetch Entries
  useEffect(() => {
      if (GOOGLE_MAPS_API_KEY) {
          setProvider('google');
      } else {
          setProvider('leaflet');
      }

      const fetchEntries = async () => {
        if (user) {
          setLoading(true);
          const data = await db.getEntries(user.id);
          const withLocation = data.filter(e => e.location && e.location.lat && e.location.lng);
          setEntries(withLocation);
          setLoading(false);
        }
      };
      fetchEntries();
  }, [user]);

  // 2. Initialize Map Logic
  useEffect(() => {
      if (loading) return;

      const cleanup = () => {
          if (leafletMapRef.current) {
              leafletMapRef.current.remove();
              leafletMapRef.current = null;
          }
          leafletClusterGroupRef.current = null;
          
          if (mapContainerRef.current) {
              mapContainerRef.current.innerHTML = "";
          }
          if (clustererRef.current) {
              clustererRef.current.clearMarkers();
              clustererRef.current = null;
          }
      };

      const initGoogleMap = () => {
          if (typeof google === 'undefined' || !google.maps) {
              const existingScript = document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"]`);
              if (!existingScript) {
                  const script = document.createElement('script');
                  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,drawing`;
                  script.async = true;
                  script.defer = true;
                  script.onload = () => initGoogleMap(); 
                  document.body.appendChild(script);
                  return;
              } else {
                  setTimeout(initGoogleMap, 100);
                  return;
              }
          }

          if (mapContainerRef.current && !mapInstanceRef.current) {
              mapInstanceRef.current = new google.maps.Map(mapContainerRef.current, {
                  center: { lat: 48.85, lng: 2.35 },
                  zoom: 4,
                  styles: [
                    { "featureType": "all", "elementType": "geometry.fill", "stylers": [{ "weight": "2.00" }] },
                    { "featureType": "water", "elementType": "all", "stylers": [{ "color": "#46bcec" }, { "visibility": "on" }] },
                    { "featureType": "water", "elementType": "geometry.fill", "stylers": [{ "color": "#c8d7d4" }] }
                  ]
              });

              infoWindowRef.current = new google.maps.InfoWindow();
              
              // Initialize Clusterer
              clustererRef.current = new MarkerClusterer({ map: mapInstanceRef.current, markers: [] });

              drawingManagerRef.current = new google.maps.drawing.DrawingManager({
                  drawingMode: null,
                  drawingControl: false,
                  rectangleOptions: {
                      fillColor: '#6366f1',
                      fillOpacity: 0.2,
                      strokeWeight: 1,
                      clickable: false,
                      editable: true,
                      zIndex: 1
                  }
              });
              drawingManagerRef.current.setMap(mapInstanceRef.current);

              google.maps.event.addListener(drawingManagerRef.current, 'overlaycomplete', (event: any) => {
                  if (event.type === 'rectangle') {
                      if (currentRectangleRef.current) {
                          currentRectangleRef.current.setMap(null);
                      }
                      currentRectangleRef.current = event.overlay;
                      
                      drawingManagerRef.current.setDrawingMode(null);
                      setIsSelecting(false);

                      filterByBounds(event.overlay.getBounds());
                  }
              });
          }
      };

      const initLeafletMap = () => {
          // @ts-ignore
          if (typeof window.L === 'undefined') {
              setTimeout(initLeafletMap, 100);
              return;
          }

          if (mapContainerRef.current && !leafletMapRef.current) {
              // @ts-ignore
              const L = window.L;
              const map = L.map(mapContainerRef.current).setView([48.85, 2.35], 4);
              
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                  attribution: '&copy; OpenStreetMap contributors'
              }).addTo(map);
              
              leafletMapRef.current = map;
              
              // Initialize MarkerClusterGroup if plugin is loaded
              if (L.markerClusterGroup) {
                  leafletClusterGroupRef.current = L.markerClusterGroup().addTo(map);
              } else {
                  console.warn("Leaflet.markercluster not loaded, falling back to LayerGroup");
                  leafletClusterGroupRef.current = L.layerGroup().addTo(map);
              }

              // Use a timeout but check if map is still valid before invalidating size
              setTimeout(() => {
                  if (leafletMapRef.current && leafletMapRef.current === map) {
                      map.invalidateSize();
                  }
              }, 200);
          }
      };

      if (provider === 'google') {
          initGoogleMap();
      } else {
          initLeafletMap();
      }

      return cleanup;
  }, [provider, loading]);

  // Trigger map resize when sidebar width changes
  useEffect(() => {
      const timer = setTimeout(() => {
          if (provider === 'leaflet' && leafletMapRef.current) {
              leafletMapRef.current.invalidateSize();
          } else if (provider === 'google' && mapInstanceRef.current) {
              google.maps.event.trigger(mapInstanceRef.current, "resize");
          }
      }, 100);
      return () => clearTimeout(timer);
  }, [sidebarWidth, provider]);

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
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX; 
      if (newWidth > appConfig.ui.minSidebarWidth && newWidth < appConfig.ui.maxSidebarWidth) {
          setSidebarWidth(newWidth);
      }
  }, []);

  useEffect(() => {
      localStorage.setItem(appConfig.storageKeys.MAP_SIDEBAR_WIDTH, sidebarWidth.toString());
  }, [sidebarWidth]);

  const filterByBounds = (bounds: any) => {
      let selected: DiaryEntry[] = [];
      
      if (provider === 'google') {
          selected = filteredEntries.filter(e => {
              if (!e.location) return false;
              const latLng = new google.maps.LatLng(e.location.lat, e.location.lng);
              return bounds.contains(latLng);
          });
      } else {
          selected = filteredEntries.filter(e => {
              if (!e.location) return false;
              // @ts-ignore
              const latLng = window.L.latLng(e.location.lat, e.location.lng);
              return bounds.contains(latLng);
          });
      }
      setSelectedEntries(selected);
  };

  // Leaflet Custom Drag Logic (Applied to Overlay)
  const handleMouseDown = (e: React.MouseEvent) => {
      if (provider !== 'leaflet' || !isSelecting || !leafletMapRef.current) return;
      // @ts-ignore
      const L = window.L;
      
      const latLng = leafletMapRef.current.mouseEventToLatLng(e.nativeEvent);
      setSelectionStart(latLng);
      
      if (selectionRectRef.current) selectionRectRef.current.remove();
      selectionRectRef.current = L.rectangle([latLng, latLng], {color: "#6366f1", weight: 1}).addTo(leafletMapRef.current);
  };

  const handleMouseMoveSelection = (e: React.MouseEvent) => {
      if (provider !== 'leaflet' || !isSelecting || !selectionStart || !selectionRectRef.current || !leafletMapRef.current) return;
      
      const currentLatLng = leafletMapRef.current.mouseEventToLatLng(e.nativeEvent);
      selectionRectRef.current.setBounds([selectionStart, currentLatLng]);
  };

  const handleMouseUp = () => {
      if (provider !== 'leaflet' || !isSelecting || !selectionStart || !selectionRectRef.current) return;
      
      const bounds = selectionRectRef.current.getBounds();
      filterByBounds(bounds);

      setSelectionStart(null);
      setIsSelecting(false);
  };

  const toggleSelectionMode = () => {
      const newMode = !isSelecting;
      setIsSelecting(newMode);
      
      if (newMode) {
          setSelectedEntries([]);
          if (provider === 'google' && currentRectangleRef.current) {
              currentRectangleRef.current.setMap(null);
          }
          if (provider === 'leaflet' && selectionRectRef.current) {
              selectionRectRef.current.remove();
          }
      }

      if (provider === 'google' && drawingManagerRef.current) {
          drawingManagerRef.current.setDrawingMode(newMode ? google.maps.drawing.OverlayType.RECTANGLE : null);
      }
  };

  const clearSelection = () => {
      setSelectedEntries([]);
      if (provider === 'google' && currentRectangleRef.current) {
          currentRectangleRef.current.setMap(null);
      }
      if (provider === 'leaflet' && selectionRectRef.current) {
          selectionRectRef.current.remove();
      }
  };

  const navigateToSelection = () => {
      if (selectedEntries.length === 0) return;
      navigate('/history', {
          state: {
              entryIds: selectedEntries.map(e => e.id)
          }
      });
  };

  const scrollToEntry = (id: string) => {
      const element = entryRefs.current.get(id);
      if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  };

  const handleMarkerClick = (entry: DiaryEntry) => {
      setActiveEntryId(entry.id);
      scrollToEntry(entry.id);
  };

  const handleListClick = (entry: DiaryEntry) => {
      if (!entry.location) return;
      setActiveEntryId(entry.id);

      if (provider === 'google' && mapInstanceRef.current) {
          const pos = { lat: entry.location.lat, lng: entry.location.lng };
          mapInstanceRef.current.panTo(pos);
          // Open InfoWindow
          const marker = googleMarkersMap.current.get(entry.id);
          if (marker && infoWindowRef.current) {
              infoWindowRef.current.setContent(`<div style="color:black"><b>${new Date(entry.timestamp).toLocaleDateString()}</b><br/>${entry.analysis.summary}</div>`);
              infoWindowRef.current.open(mapInstanceRef.current, marker);
          }
      } else if (provider === 'leaflet' && leafletMapRef.current) {
          leafletMapRef.current.flyTo([entry.location.lat, entry.location.lng], 12);
          const marker = leafletMarkersMap.current.get(entry.id);
          if (marker) {
              // If clustered, we might need to zoom to show the marker
              if (leafletClusterGroupRef.current && typeof leafletClusterGroupRef.current.zoomToShowLayer === 'function') {
                  leafletClusterGroupRef.current.zoomToShowLayer(marker, () => marker.openPopup());
              } else {
                  marker.openPopup();
              }
          }
      }
  };

  const handleListDoubleClick = (entry: DiaryEntry) => {
      navigate('/history', { 
          state: { 
              entryId: entry.id,
              date: entry.timestamp 
          } 
      });
  };

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    entries.forEach(e => {
        e.analysis.manualTags?.forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [entries]);

  const availableEntities = useMemo(() => {
    const entities = new Set<string>();
    entries.forEach(e => {
        e.analysis.entities?.forEach(ent => entities.add(ent.name));
    });
    return Array.from(entities).sort();
  }, [entries]);

  const availableCountries = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => { if (e.country) s.add(e.country); });
    return Array.from(s).sort();
  }, [entries]);

  const availableCities = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => { 
        if (e.city) {
            if (filters.selectedCountries.length === 0 || (e.country && filters.selectedCountries.includes(e.country))) {
                s.add(e.city);
            }
        } 
    });
    return Array.from(s).sort();
  }, [entries, filters.selectedCountries]);

  const filteredEntries = useMemo(() => {
    return searchService.filterEntries(entries, filters).sort((a, b) => a.timestamp - b.timestamp);
  }, [entries, filters]);

  const getMoodColor = (mood: Mood) => {
    switch (mood) {
        case Mood.Joyful: return 'bg-yellow-400';
        case Mood.Happy: return 'bg-green-400';
        case Mood.Neutral: return 'bg-slate-400';
        case Mood.Sad: return 'bg-blue-400';
        case Mood.Anxious: return 'bg-orange-400';
        case Mood.Angry: return 'bg-red-400';
        case Mood.Reflective: return 'bg-purple-400';
        case Mood.Tired: return 'bg-indigo-300';
        default: return 'bg-slate-400';
    }
  };

  const getMoodColorHex = (mood: Mood) => {
        switch (mood) {
            case Mood.Joyful: return '#fbbf24';
            case Mood.Happy: return '#4ade80';
            case Mood.Neutral: return '#94a3b8';
            case Mood.Sad: return '#60a5fa';
            case Mood.Anxious: return '#fb923c';
            case Mood.Angry: return '#f87171';
            case Mood.Reflective: return '#c084fc';
            case Mood.Tired: return '#818cf8';
            default: return '#6366f1';
        }
    };

  // Update Markers Effect
  useEffect(() => {
      if (!filteredEntries) return;

      if (provider === 'google' && mapInstanceRef.current && clustererRef.current) {
          clustererRef.current.clearMarkers();
          googleMarkersMap.current.clear();
          
          if (polylineRef.current) polylineRef.current.setMap(null);

          const bounds = new google.maps.LatLngBounds();
          const path: any[] = [];
          const newMarkers: any[] = [];

          filteredEntries.forEach(e => {
              if (!e.location) return;
              const pos = { lat: e.location.lat, lng: e.location.lng };
              path.push(pos);
              bounds.extend(pos);

              const marker = new google.maps.Marker({
                  position: pos,
                  title: e.analysis.summary,
              });
              
              marker.addListener("click", () => {
                  if (infoWindowRef.current) {
                      infoWindowRef.current.setContent(`<div style="color:black"><b>${new Date(e.timestamp).toLocaleDateString()}</b><br/>${e.analysis.summary}</div>`);
                      infoWindowRef.current.open(mapInstanceRef.current, marker);
                  }
                  handleMarkerClick(e);
              });
              
              newMarkers.push(marker);
              googleMarkersMap.current.set(e.id, marker);
          });

          // Add all markers to the clusterer
          clustererRef.current.addMarkers(newMarkers);

          if (path.length > 1) {
              polylineRef.current = new google.maps.Polyline({
                  path,
                  geodesic: true,
                  strokeColor: '#6366f1',
                  strokeOpacity: 0.8,
                  strokeWeight: 2
              });
              polylineRef.current.setMap(mapInstanceRef.current);
          }
          if (!bounds.isEmpty() && !currentRectangleRef.current) mapInstanceRef.current.fitBounds(bounds);

      } else if (provider === 'leaflet' && leafletMapRef.current && leafletClusterGroupRef.current) {
          leafletClusterGroupRef.current.clearLayers();
          leafletMarkersMap.current.clear();
          // @ts-ignore
          const L = window.L;
          const latlngs: any[] = [];
          const bounds = L.latLngBounds([]);

          filteredEntries.forEach(e => {
              if (!e.location) return;
              const pos = [e.location.lat, e.location.lng];
              latlngs.push(pos);
              bounds.extend(pos);

              const color = getMoodColorHex(e.analysis.mood);
              const markerHtml = `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`;
              const icon = L.divIcon({
                  className: 'custom-marker',
                  html: markerHtml,
                  iconSize: [14, 14],
                  iconAnchor: [7, 7],
                  popupAnchor: [0, -10]
              });

              const marker = L.marker(pos, { icon }).bindPopup(
                  `<div style="font-family:sans-serif;"><strong>${new Date(e.timestamp).toLocaleDateString()}</strong><br/>${e.analysis.summary}</div>`
              );
              
              marker.on('click', () => handleMarkerClick(e));
              
              leafletClusterGroupRef.current.addLayer(marker);
              leafletMarkersMap.current.set(e.id, marker);
          });

          // Draw Polyline on the map directly (not in cluster group usually)
          
          // Simple polyline handling: Remove old if exists
          if (leafletMapRef.current.polylineLayer) {
              leafletMapRef.current.removeLayer(leafletMapRef.current.polylineLayer);
          }
          if (latlngs.length > 1) {
              const line = L.polyline(latlngs, { color: '#6366f1' }).addTo(leafletMapRef.current);
              leafletMapRef.current.polylineLayer = line;
          }

          if (latlngs.length > 0 && !selectionRectRef.current) {
              leafletMapRef.current.fitBounds(bounds, { padding: [50, 50] });
          }
      }
  }, [filteredEntries, provider]);

  return (
    <div className="h-full flex flex-col md:flex-row-reverse gap-0 relative overflow-hidden">
      
      {/* Sidebar List (Right Side) */}
      <div 
        style={{ width: window.innerWidth >= 768 ? sidebarWidth : '100%' }}
        className="flex flex-col gap-3 shrink-0 h-full md:border-l border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 md:pl-2"
      >
        <div className="p-2">
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input 
                    type="text" 
                    placeholder={t('searchPlaceholder')}
                    value={filters.text}
                    onChange={e => setFilters({...filters, text: e.target.value})}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-9 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`absolute right-2 top-2 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${showFilters ? 'text-indigo-500' : 'text-slate-400'}`}
                >
                    <Filter size={16} />
                </button>
            </div>
        </div>

        <FilterPanel 
            filters={filters} 
            setFilters={setFilters} 
            availableTags={availableTags}
            availableEntities={availableEntities}
            availableCountries={availableCountries}
            availableCities={availableCities}
            isOpen={showFilters}
            onClose={() => setShowFilters(false)}
        />

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 pl-2 pb-2 custom-scrollbar">
          {filteredEntries.map(entry => (
            <div 
              key={entry.id}
              ref={el => { if(el) entryRefs.current.set(entry.id, el); }}
              onClick={() => handleListClick(entry)}
              onDoubleClick={() => handleListDoubleClick(entry)}
              className={`p-3 rounded-xl border cursor-pointer transition-all bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 group ${
                  activeEntryId === entry.id 
                  ? 'border-indigo-500 dark:border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                  : 'hover:border-indigo-300 dark:hover:border-indigo-700'
              }`}
            >
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {entry.mode === EntryMode.Chat ? <MessageCircle size={12} className="text-purple-400" /> : <FileText size={12} className="text-blue-400" />}
                </div>
                <div className={`w-2 h-2 rounded-full ${getMoodColor(entry.analysis.mood)}`} title={entry.analysis.mood} />
              </div>
              
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 leading-relaxed">
                  {entry.analysis.summary}
              </p>
              
              <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                  {(entry.images?.length || 0) > 0 && (
                      <div className="flex items-center gap-0.5 text-[10px] text-slate-400">
                          <ImageIcon size={10} /> {entry.images?.length}
                      </div>
                  )}
                  {entry.city && (
                      <div className="flex items-center gap-0.5 text-[10px] text-slate-400 truncate max-w-[80px]">
                          <MapPin size={10} /> {entry.city}
                      </div>
                  )}
              </div>
            </div>
          ))}
          {filteredEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center h-20 text-slate-500 text-sm">
                <p>{t('noEntries')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Resizer Handle */}
      <div
        onMouseDown={startResizing}
        className="hidden md:flex w-2 bg-transparent hover:bg-indigo-500/20 dark:hover:bg-indigo-400/20 cursor-col-resize items-center justify-center group transition-colors z-50 relative"
      >
          <div className="h-8 w-1 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-indigo-500 dark:group-hover:bg-indigo-400 transition-colors" />
      </div>

      {/* Main Map Area */}
      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-r-none overflow-hidden shadow-sm relative min-h-[600px]">
         {loading && <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">Loading Map...</div>}
         
         {/* Header / Tools Overlay */}
         <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2">
             <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg backdrop-blur-sm">
                 <div className="flex items-center gap-3 mb-2">
                     <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <MapIcon size={20} />
                     </div>
                     <div>
                        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">{t('map')}</h1>
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-slate-500 dark:text-slate-400">{filteredEntries.length} memories</p>
                            <span className={`text-[9px] px-1 py-0.5 rounded border ${provider === 'google' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                {provider === 'google' ? 'Google Maps' : 'OSM'}
                            </span>
                        </div>
                     </div>
                 </div>
                 
                 <button
                    onClick={toggleSelectionMode}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-xs font-medium ${
                        isSelecting
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                    <MousePointer2 size={14} /> {isSelecting ? t('cancelSelection') : t('selectArea')}
                </button>
             </div>
         </div>

         {/* The Map Container - Static, no props change */}
         <div ref={mapContainerRef} className="w-full h-full" />

         {/* Selection Overlay - Only active when selecting */}
         {isSelecting && provider === 'leaflet' && (
             <div 
                className="absolute inset-0 z-[500] cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMoveSelection}
                onMouseUp={handleMouseUp}
             />
         )}
         
         {/* Selection Popup */}
         {selectedEntries.length > 0 && (
             <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl p-4 flex items-center gap-4 animate-fade-in-up">
                 <div className="flex items-center gap-3">
                     <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-full text-indigo-600 dark:text-indigo-400">
                         <List size={20} />
                     </div>
                     <div>
                         <p className="font-bold text-slate-800 dark:text-white">{selectedEntries.length} Selected</p>
                         <p className="text-xs text-slate-500 dark:text-slate-400">Memories in this area</p>
                     </div>
                 </div>
                 <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-4">
                     <button 
                        onClick={navigateToSelection}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-500 transition-colors shadow-md"
                     >
                         View Details
                     </button>
                     <button 
                        onClick={clearSelection}
                        className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                     >
                         <X size={18} />
                     </button>
                 </div>
             </div>
         )}
      </div>
    </div>
  );
};

export default MapView;
