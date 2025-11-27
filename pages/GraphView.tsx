
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { DiaryEntry, Mood, EntryMode, CatalogItemType } from '../types';
import { useTranslation } from '../services/translations';
import { Network, ZoomIn, ZoomOut, RefreshCw, X, Tag, Calendar, Smile, Filter, Search, MessageCircle, FileText, Image as ImageIcon, MapPin, Sparkles, Layers, ArrowLeft, Users, Flag, Building, Box } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FilterPanel, FilterState } from '../components/FilterPanel';
import { searchService } from '../services/searchService';
import { appConfig } from '../config/appConfig';

interface Node {
  id: string;
  type: 'entry' | 'tag' | 'entity' | 'cluster';
  entityType?: CatalogItemType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  label: string;
  data?: any; // Entry, Entity, or Cluster Data
}

interface Link {
  source: string;
  target: string;
  sourceNode?: Node;
  targetNode?: Node;
}

type ClusterMode = 'date' | 'day' | 'mood' | 'tag' | 'entity' | 'entityType' | 'country' | 'city';

const CLUSTER_THRESHOLD = 50; // Auto-cluster if more than 50 entries

const GraphView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  // Clustering State
  const [clusterMode, setClusterMode] = useState<ClusterMode>('date');
  const [effectiveMode, setEffectiveMode] = useState<ClusterMode>('date'); // The actual mode being rendered
  const [drillDownValue, setDrillDownValue] = useState<string | null>(null);
  const [forceDetailed, setForceDetailed] = useState(false);

  // Filters
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
      const saved = localStorage.getItem(appConfig.storageKeys.GRAPH_SIDEBAR_WIDTH);
      return saved ? parseInt(saved, 10) : appConfig.ui.defaultGraphSidebarWidth;
  });
  const isResizing = useRef(false);

  // Physics params
  const repulsion = 800;
  const springLength = 120;
  const damping = 0.85;
  const centering = 0.02;

  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        setLoading(true);
        const data = await db.getEntries(user.id);
        setEntries(data);
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // Resizing Logic
  const startResizing = useCallback(() => {
      isResizing.current = true;
      document.addEventListener('mousemove', handleMouseMoveResizing);
      document.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMoveResizing);
      document.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
  }, []);

  const handleMouseMoveResizing = useCallback((e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX; 
      if (newWidth > appConfig.ui.minSidebarWidth && newWidth < appConfig.ui.maxSidebarWidth) {
          setSidebarWidth(newWidth);
      }
  }, []);

  useEffect(() => {
      localStorage.setItem(appConfig.storageKeys.GRAPH_SIDEBAR_WIDTH, sidebarWidth.toString());
  }, [sidebarWidth]);

  // --- derived Data ---
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    entries.forEach(e => e.analysis.manualTags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [entries]);

  const availableEntities = useMemo(() => {
      const entities = new Set<string>();
      entries.forEach(e => e.analysis.entities?.forEach(ent => entities.add(ent.name)));
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
    return searchService.filterEntries(entries, filters);
  }, [entries, filters]);

  // --- Graph Logic ---

  const getMoodColor = (mood: Mood) => {
    switch (mood) {
        case Mood.Joyful: return '#fbbf24';
        case Mood.Happy: return '#4ade80';
        case Mood.Neutral: return '#94a3b8';
        case Mood.Sad: return '#60a5fa';
        case Mood.Anxious: return '#fb923c';
        case Mood.Angry: return '#f87171';
        case Mood.Reflective: return '#c084fc';
        case Mood.Tired: return '#818cf8';
        default: return '#94a3b8';
    }
  };

  const getCategoryColor = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
      return '#' + "00000".substring(0, 6 - c.length) + c;
  };

  const initializeGraph = () => {
    const newNodes: Node[] = [];
    const newLinks: Link[] = [];
    const tagsMap = new Map<string, Node>();
    const entitiesMap = new Map<string, Node>();

    // 1. Determine Working Set (Drill Down)
    // IMPORTANT: If drillDownValue is set, we use it to determine context, 
    // but the `filteredEntries` is already filtered by `filters` state in `useMemo`.
    // The drillDownValue acts mainly as a "View Mode" switch here.
    let workingEntries = filteredEntries;
    
    // 2. Determine Clustered State & Effective Mode
    let isClustered = false;
    let computedMode = clusterMode;

    if (workingEntries.length > CLUSTER_THRESHOLD && !forceDetailed) {
        isClustered = true;
        // Smart Recursion: If we are drilling down and it's STILL too big, switch mode.
        if (drillDownValue) {
            // Logic table for next level
            if (clusterMode === 'date') computedMode = 'day'; // Month -> Day
            else if (clusterMode === 'day') computedMode = 'mood'; // Day -> Mood
            else if (clusterMode === 'entityType') computedMode = 'entity'; // EntityType -> Entity Name
            else computedMode = 'date'; // Tag/Entity -> Timeline (Month)
        }
    }
    
    setEffectiveMode(computedMode);

    if (isClustered) {
        // --- CLUSTERING LOGIC ---
        const clusters: Record<string, { entries: DiaryEntry[], label: string, color: string }> = {};
        
        const addToCluster = (key: string, label: string, entry: DiaryEntry, color?: string) => {
            if (!clusters[key]) {
                clusters[key] = { 
                    entries: [], 
                    label, 
                    color: color || getCategoryColor(key) 
                };
            }
            clusters[key].entries.push(entry);
        };

        // Grouping
        workingEntries.forEach(e => {
            if (computedMode === 'date') {
                const d = new Date(e.timestamp);
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                addToCluster(key, new Date(e.timestamp).toLocaleDateString(undefined, {month:'short', year:'numeric'}), e);
            } else if (computedMode === 'day') {
                const d = new Date(e.timestamp);
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                addToCluster(key, new Date(e.timestamp).toLocaleDateString(undefined, {month:'numeric', day:'numeric'}), e);
            } else if (computedMode === 'mood') {
                addToCluster(e.analysis.mood, e.analysis.mood, e, getMoodColor(e.analysis.mood));
            } else if (computedMode === 'country') {
                const c = e.country || 'Unknown';
                addToCluster(c, c, e);
            } else if (computedMode === 'city') {
                const c = e.city || 'Unknown';
                addToCluster(c, c, e);
            } else if (computedMode === 'tag') {
                if (!e.analysis.manualTags || e.analysis.manualTags.length === 0) {
                    addToCluster('Untagged', 'Untagged', e, '#cbd5e1');
                } else {
                    e.analysis.manualTags.forEach(tag => addToCluster(tag, tag, e));
                }
            } else if (computedMode === 'entity') {
                if (!e.analysis.entities || e.analysis.entities.length === 0) {
                    addToCluster('No Entities', 'No Entities', e, '#cbd5e1');
                } else {
                    e.analysis.entities.forEach(ent => addToCluster(ent.name, ent.name, e));
                }
            } else if (computedMode === 'entityType') {
                if (!e.analysis.entities || e.analysis.entities.length === 0) {
                    addToCluster('No Entities', 'No Entities', e, '#cbd5e1');
                } else {
                    e.analysis.entities.forEach(ent => addToCluster(ent.type, ent.type, e));
                }
            }
        });

        // Create Nodes
        const clusterKeys = Object.keys(clusters);
        if (computedMode === 'date' || computedMode === 'day') clusterKeys.sort(); // Sort chronologically

        clusterKeys.forEach((key, index) => {
            const data = clusters[key];
            const count = data.entries.length;
            
            // For date/day, color by dominant mood if not set
            let finalColor = data.color;
            if (computedMode === 'date' || computedMode === 'day') {
                const moodCounts: Record<string, number> = {};
                data.entries.forEach(e => { moodCounts[e.analysis.mood] = (moodCounts[e.analysis.mood] || 0) + 1; });
                const dominant = Object.keys(moodCounts).reduce((a, b) => moodCounts[a] > moodCounts[b] ? a : b, 'Neutral') as Mood;
                finalColor = getMoodColor(dominant);
            }

            newNodes.push({
                id: `cluster-${key}`,
                type: 'cluster',
                x: (Math.random() - 0.5) * 600,
                y: (Math.random() - 0.5) * 600,
                vx: 0, vy: 0,
                radius: Math.min(80, 25 + Math.sqrt(count) * 5),
                color: finalColor,
                label: data.label,
                data: {
                    key: key,
                    entries: data.entries,
                    count
                }
            });
        });

        // Create Links
        if (computedMode === 'date' || computedMode === 'day') {
            // Sequential
            for (let i = 0; i < clusterKeys.length - 1; i++) {
                newLinks.push({ source: `cluster-${clusterKeys[i]}`, target: `cluster-${clusterKeys[i+1]}` });
            }
        } else if (computedMode === 'mood' || computedMode === 'country' || computedMode === 'city') {
            // Transitions (Entry i -> Entry i+1)
            const sortedEntries = [...workingEntries].sort((a,b) => a.timestamp - b.timestamp);
            const transitions: Record<string, number> = {};
            
            const getValue = (e: DiaryEntry) => {
                if (computedMode === 'mood') return e.analysis.mood;
                if (computedMode === 'country') return e.country || 'Unknown';
                if (computedMode === 'city') return e.city || 'Unknown';
                return '';
            };

            for (let i = 0; i < sortedEntries.length - 1; i++) {
                const a = getValue(sortedEntries[i]);
                const b = getValue(sortedEntries[i+1]);
                if (a && b && a !== b) {
                    const key = `${a}|${b}`;
                    transitions[key] = (transitions[key] || 0) + 1;
                }
            }

            Object.entries(transitions).forEach(([key, count]) => {
                const [source, target] = key.split('|');
                if (clusters[source] && clusters[target]) {
                    newLinks.push({ source: `cluster-${source}`, target: `cluster-${target}` });
                }
            });
        } else if (computedMode === 'tag' || computedMode === 'entity' || computedMode === 'entityType') {
            // Co-occurrence
            const cooccurrences: Record<string, number> = {};
            
            workingEntries.forEach(e => {
                let items: string[] = [];
                if (computedMode === 'tag') items = (e.analysis.manualTags || []);
                else if (computedMode === 'entity') items = (e.analysis.entities?.map(x=>x.name) || []);
                else if (computedMode === 'entityType') items = (e.analysis.entities?.map(x=>x.type) || []);

                const uniqueItems = Array.from(new Set(items));
                
                for (let i = 0; i < uniqueItems.length; i++) {
                    for (let j = i + 1; j < uniqueItems.length; j++) {
                        const a = uniqueItems[i];
                        const b = uniqueItems[j];
                        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
                        cooccurrences[key] = (cooccurrences[key] || 0) + 1;
                    }
                }
            });

            Object.entries(cooccurrences).forEach(([key, count]) => {
                const [source, target] = key.split('|');
                if (clusters[source] && clusters[target]) {
                    newLinks.push({ source: `cluster-${source}`, target: `cluster-${target}` });
                }
            });
        }

    } else {
        // --- DETAILED LOGIC (Default or Drilled Down) ---
        workingEntries.forEach(entry => {
            newNodes.push({
                id: entry.id,
                type: 'entry',
                x: Math.random() * 800 - 400,
                y: Math.random() * 600 - 300,
                vx: 0, vy: 0,
                radius: 12,
                color: getMoodColor(entry.analysis.mood),
                label: new Date(entry.timestamp).toLocaleDateString(),
                data: entry
            });

            // Tags
            entry.analysis.manualTags?.forEach(tag => {
                const normalizedTag = tag.toLowerCase().trim();
                if (!tagsMap.has(normalizedTag)) {
                    const tagNode: Node = {
                        id: `tag-${normalizedTag}`,
                        type: 'tag',
                        x: Math.random() * 800 - 400,
                        y: Math.random() * 600 - 300,
                        vx: 0, vy: 0,
                        radius: 6,
                        color: '#94a3b8', 
                        label: tag,
                    };
                    tagsMap.set(normalizedTag, tagNode);
                    newNodes.push(tagNode);
                }
                newLinks.push({ source: entry.id, target: `tag-${normalizedTag}` });
            });

            // Entities
            entry.analysis.entities?.forEach(entity => {
                const normalizedEntity = entity.name.toLowerCase().trim();
                if (!entitiesMap.has(normalizedEntity)) {
                    const entityNode: Node = {
                        id: `ent-${normalizedEntity}`,
                        type: 'entity',
                        entityType: entity.type,
                        x: Math.random() * 800 - 400,
                        y: Math.random() * 600 - 300,
                        vx: 0, vy: 0,
                        radius: 8,
                        color: '#c084fc',
                        label: entity.name,
                    };
                    entitiesMap.set(normalizedEntity, entityNode);
                    newNodes.push(entityNode);
                }
                newLinks.push({ source: entry.id, target: `ent-${normalizedEntity}` });
            });
        });
    }

    setNodes(newNodes);
    setLinks(newLinks);
    
    // Reset view if container ready and not drilling down (avoids jumpiness)
    if (containerRef.current && !drillDownValue) { 
        setOffset({ x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2 });
    }
  };

  // Re-run graph init when data or mode changes
  useEffect(() => {
      initializeGraph();
      // Only clear selected node if it's no longer in the graph
      if (selectedNode && !nodes.find(n => n.id === selectedNode.id)) {
          setSelectedNode(null);
      }
  }, [filteredEntries, drillDownValue, forceDetailed, clusterMode]);

  // --- Simulation Loop ---
  useEffect(() => {
    if (nodes.length === 0) return;

    let animationFrameId: number;
    const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]));

    const runSimulation = () => {
        // 1. Repulsion (Optimized)
        const cutoffDistance = 300; 
        const cutoffSq = cutoffDistance * cutoffDistance;

        for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
                const b = nodes[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                
                if (Math.abs(dx) > cutoffDistance || Math.abs(dy) > cutoffDistance) continue;

                const distSq = dx * dx + dy * dy;
                if (distSq > cutoffSq || distSq === 0) continue;

                const dist = Math.sqrt(distSq) || 1;
                const force = repulsion / distSq;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                
                a.vx -= fx;
                a.vy -= fy;
                b.vx += fx;
                b.vy += fy;
            }
        }

        // 2. Attraction
        links.forEach(link => {
            const source = nodeMap.get(link.source);
            const target = nodeMap.get(link.target);
            if (!source || !target) return;

            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            const force = (dist - springLength) * 0.05;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            source.vx += fx;
            source.vy += fy;
            target.vx -= fx;
            target.vy -= fy;
        });

        // 3. Center Gravity & Update
        nodes.forEach(node => {
            const centerForce = node.type === 'cluster' ? centering * 2 : centering;
            
            node.vx -= node.x * centerForce * 0.1;
            node.vy -= node.y * centerForce * 0.1;
            
            node.vx *= damping;
            node.vy *= damping;
            
            node.x += node.vx;
            node.y += node.vy;
        });

        draw();
        animationFrameId = requestAnimationFrame(runSimulation);
    };

    runSimulation();
    return () => cancelAnimationFrame(animationFrameId);
  }, [nodes, links, zoom, offset]);


  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== containerRef.current.clientWidth || canvas.height !== containerRef.current.clientHeight) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Draw Links
    ctx.lineWidth = 1;
    const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]));
    
    links.forEach(link => {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (source && target) {
            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            ctx.strokeStyle = source.type === 'cluster' ? '#94a3b8' : '#cbd5e1'; 
            ctx.setLineDash(source.type === 'cluster' ? [5, 5] : []);
            ctx.stroke();
        }
    });
    ctx.setLineDash([]);

    // Draw Nodes
    nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        
        ctx.fillStyle = node.color;
        ctx.fill();
        
        if (node.type === 'cluster') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = node.color;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        } 
        else if (node === selectedNode) {
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 3;
            ctx.stroke();
        } else {
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        if (node.type === 'cluster') {
            ctx.font = 'bold 12px Inter';
            ctx.fillStyle = '#1e293b'; 
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.label, node.x, node.y + node.radius + 15);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Inter';
            ctx.fillText(node.data.count.toString(), node.x, node.y);
        }
        else if (node.type === 'entity') {
            ctx.font = 'bold 10px Inter';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let iconChar = 'E';
            if (node.entityType === 'Person') iconChar = 'P';
            if (node.entityType === 'Location') iconChar = 'L';
            ctx.fillText(iconChar, node.x, node.y);
        }

        if (node.type !== 'cluster' && (node.type === 'tag' || node.type === 'entity' || node === selectedNode || zoom > 1.5)) {
            ctx.font = '10px Inter';
            ctx.fillStyle = '#64748b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(node.label, node.x, node.y + node.radius + 12);
        }
    });

    ctx.restore();
  };

  // Interactions
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = (e.clientX - rect.left - offset.x) / zoom;
    const mouseY = (e.clientY - rect.top - offset.y) / zoom;

    for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const dx = n.x - mouseX;
        const dy = n.y - mouseY;
        if (Math.sqrt(dx * dx + dy * dy) < n.radius + 5) {
            setSelectedNode(n);
            return;
        }
    }

    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (isDragging) {
          const dx = e.clientX - dragStart.x;
          const dy = e.clientY - dragStart.y;
          setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
          setDragStart({ x: e.clientX, y: e.clientY });
      }
  };

  const handleMouseUp = () => {
      setIsDragging(false);
  };

  // Shared Logic for entering a cluster
  const enterCluster = (val: string) => {
      setDrillDownValue(val);
      setOffset({ x: containerRef.current?.clientWidth! / 2, y: containerRef.current?.clientHeight! / 2 });
      setZoom(1);

      // Auto-sync filter based on current cluster mode
      setFilters(prev => {
          const newFilters = { ...prev };
          // IMPORTANT: Reset other filters to prevent 0 results intersections when drilling down
          // We must clear other specific filters to avoid "blocking"
          
          if (clusterMode === 'tag') {
              newFilters.selectedTags = [val];
          } else if (clusterMode === 'entity') {
              newFilters.selectedEntities = [val];
          } else if (clusterMode === 'mood') {
              newFilters.selectedMoods = [val];
          } else if (clusterMode === 'country') {
              newFilters.selectedCountries = [val];
          } else if (clusterMode === 'city') {
              newFilters.selectedCities = [val];
          } else if (clusterMode === 'date') {
              // Handle Month Cluster (YYYY-MM)
              const [year, month] = val.split('-').map(Number);
              if (year && month) {
                  // Construct valid date range for the entire month
                  // Last day of month: new Date(year, month, 0).getDate()
                  const lastDay = new Date(year, month, 0).getDate();
                  const monthStr = String(month).padStart(2, '0');
                  
                  newFilters.startDate = `${year}-${monthStr}-01`;
                  newFilters.endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
              } else {
                  // Fallback
                  newFilters.startDate = ''; 
                  newFilters.endDate = '';
              }
          } else if (clusterMode === 'day') {
              // Handle Day Cluster (YYYY-MM-DD)
              newFilters.startDate = val;
              newFilters.endDate = val;
          }
          return newFilters;
      });
      setShowFilters(true);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      if (selectedNode && selectedNode.type === 'cluster') {
          enterCluster(selectedNode.data.key);
      }
  };

  const handleBack = () => {
      setDrillDownValue(null);
      // Clean up specific filters based on mode to restore view state without blocking
      setFilters(prev => {
          const next = { ...prev };
          // Explicitly clear filters related to potential drill-down modes
          if (clusterMode === 'tag') next.selectedTags = [];
          else if (clusterMode === 'entity') next.selectedEntities = [];
          else if (clusterMode === 'mood') next.selectedMoods = [];
          else if (clusterMode === 'country') next.selectedCountries = [];
          else if (clusterMode === 'city') next.selectedCities = [];
          else if (clusterMode === 'date' || clusterMode === 'day') {
              next.startDate = '';
              next.endDate = '';
          }
          return next;
      });
  };

  const resetView = () => {
      setDrillDownValue(null);
      setForceDetailed(false);
      setZoom(1);
      if (containerRef.current) {
          setOffset({ x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2 });
      }
      // Clean all filters
      setFilters({
        startDate: '', endDate: '', text: '', selectedMoods: [], selectedTags: [], 
        selectedEntities: [], selectedCountries: [], selectedCities: [], media: []
      });
  };

  if (loading) return <div className="p-8 text-center text-slate-500">{t('loading')}</div>;

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
                        onClick={() => {
                            const node = nodes.find(n => n.id === entry.id);
                            if (node) setSelectedNode(node);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-indigo-300 dark:hover:border-indigo-700 group ${selectedNode?.id === entry.id ? 'border-indigo-500 ring-1 ring-indigo-500' : ''}`}
                    >
                    <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {entry.mode === EntryMode.Chat ? <MessageCircle size={12} className="text-purple-400" /> : <FileText size={12} className="text-blue-400" />}
                        </div>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getMoodColor(entry.analysis.mood) }} title={entry.analysis.mood} />
                    </div>
                    
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 leading-relaxed">
                        {entry.analysis.summary}
                    </p>
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

        {/* Main Canvas Area */}
        <div className="flex-1 flex gap-4 min-h-[500px]">
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-r-none shadow-sm overflow-hidden relative">
                
                {/* Overlay Header */}
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
                    <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg backdrop-blur-sm pointer-events-auto">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                                <Network size={20} />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                    {drillDownValue ? `Focus: ${drillDownValue}` : t('graph')}
                                </h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {nodes.length} nodes 
                                    {effectiveMode !== clusterMode ? ` (Grouped by ${effectiveMode})` : (nodes.some(n=>n.type==='cluster') ? ' (Clustered)' : '')}
                                </p>
                            </div>
                        </div>

                        {/* Cluster Type Selector */}
                        {!drillDownValue && (
                            <div className="flex flex-wrap gap-1">
                                <button onClick={() => setClusterMode('date')} className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1 ${clusterMode === 'date' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`} title="By Date"><Calendar size={14} /> Date</button>
                                <button onClick={() => setClusterMode('mood')} className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1 ${clusterMode === 'mood' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`} title="By Mood"><Smile size={14} /> Mood</button>
                                <button onClick={() => setClusterMode('tag')} className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1 ${clusterMode === 'tag' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`} title="By Tag"><Tag size={14} /> Tag</button>
                                <button onClick={() => setClusterMode('entity')} className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1 ${clusterMode === 'entity' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`} title="By Entity"><Users size={14} /> Entity</button>
                                <button onClick={() => setClusterMode('entityType')} className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1 ${clusterMode === 'entityType' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`} title="By Entity Type"><Box size={14} /> Type</button>
                                <button onClick={() => setClusterMode('country')} className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1 ${clusterMode === 'country' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`} title="By Country"><Flag size={14} /> Co</button>
                                <button onClick={() => setClusterMode('city')} className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1 ${clusterMode === 'city' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`} title="By City"><Building size={14} /> City</button>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 pointer-events-auto">
                        <div className="bg-white/80 dark:bg-slate-800/80 p-2 rounded-lg backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-sm flex gap-1">
                            <button onClick={() => setZoom(z => Math.min(z * 1.2, 3))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded block"><ZoomIn size={18}/></button>
                            <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.2))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded block"><ZoomOut size={18}/></button>
                            <button onClick={resetView} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded block" title="Reset View"><RefreshCw size={18}/></button>
                        </div>
                        
                        {drillDownValue && (
                            <button onClick={handleBack} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-500 transition-colors flex items-center gap-2 text-xs font-bold">
                                <ArrowLeft size={14} /> Back to Clusters
                            </button>
                        )}
                        
                        {!drillDownValue && filteredEntries.length > CLUSTER_THRESHOLD && (
                            <button 
                                onClick={() => setForceDetailed(!forceDetailed)} 
                                className={`px-3 py-2 rounded-lg shadow-sm transition-colors text-xs font-bold flex items-center gap-2 ${forceDetailed ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                            >
                                <Layers size={14} /> {forceDetailed ? 'Cluster View' : 'Detailed View'}
                            </button>
                        )}
                    </div>
                </div>

                <div ref={containerRef} className="flex-1 w-full h-full bg-slate-50 dark:bg-slate-900 cursor-move">
                    <canvas 
                        ref={canvasRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onDoubleClick={handleDoubleClick}
                        className="w-full h-full block"
                    />
                </div>
            </div>

            {/* Detail Panel (Floating) */}
            {selectedNode && (
                <div className="absolute right-4 top-4 bottom-4 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col animate-fade-in-right z-20">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 capitalize">
                            {selectedNode.type === 'cluster' ? `${effectiveMode} Cluster` : `${selectedNode.type} Details`}
                        </h3>
                        <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={18}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {/* Entry Details */}
                        {selectedNode.type === 'entry' && (
                            <>
                                <div className="mb-4">
                                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1"><Calendar size={12} /> Date</span>
                                    <p className="text-slate-800 dark:text-slate-200">{new Date(selectedNode.data.timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                                <div className="mb-4">
                                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1"><Smile size={12} /> Mood</span>
                                    <span className="text-slate-800 dark:text-slate-200 font-medium">{t('mood_' + selectedNode.data.analysis.mood)}</span>
                                </div>
                                <div className="mb-4">
                                    <span className="text-xs font-bold text-slate-500 uppercase mb-1 block">Summary</span>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">"{selectedNode.data.analysis.summary}"</p>
                                    </div>
                                </div>
                                <button onClick={() => navigate('/history', { state: { entryId: selectedNode.id, date: selectedNode.data.timestamp } })} className="w-full py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors shadow-md">View Full Entry</button>
                            </>
                        )}

                        {/* Cluster Details */}
                        {selectedNode.type === 'cluster' && (
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mb-4 shadow-lg" style={{ backgroundColor: selectedNode.color }}>
                                    {selectedNode.data.count}
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{selectedNode.label}</h2>
                                <p className="text-slate-500 text-sm mb-6 capitalize">{effectiveMode}</p>
                                <button 
                                    onClick={() => {
                                        enterCluster(selectedNode.data.key);
                                        setSelectedNode(null);
                                    }}
                                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors shadow-md flex items-center justify-center gap-2"
                                >
                                    <ZoomIn size={16} /> Explore Group
                                </button>
                                <p className="text-xs text-slate-400 mt-2">Double-click circle to expand</p>
                            </div>
                        )}

                        {/* Tag/Entity Details */}
                        {(selectedNode.type === 'tag' || selectedNode.type === 'entity') && (
                            <div className="flex flex-col items-center text-center">
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-3 text-indigo-500">
                                    {selectedNode.type === 'tag' ? <Tag size={32} /> : <Sparkles size={32} />}
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                                    {selectedNode.type === 'tag' ? '#' : ''}{selectedNode.label}
                                </h2>
                                <button 
                                    onClick={() => {
                                        if (selectedNode.type === 'tag') setFilters(p => ({...p, selectedTags: [selectedNode.label]}));
                                        else setFilters(p => ({...p, selectedEntities: [selectedNode.label]}));
                                        setShowFilters(true);
                                        setSelectedNode(null);
                                    }}
                                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Filter size={16} /> Filter Graph
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default GraphView;
