
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { DiaryEntry, Mood, EntryMode, CatalogItemType } from '../types';
import { useTranslation } from '../services/translations';
import { Network, ZoomIn, ZoomOut, RefreshCw, X, Tag, Calendar, Smile, Filter, Search, MessageCircle, FileText, Image as ImageIcon, MapPin, Sparkles, Layers, ArrowLeft, Users, Flag, Building, Box, ChevronRight, Maximize } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
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

interface DrillStep {
    mode: ClusterMode;
    value: string;
    label: string;
}

const CLUSTER_THRESHOLD = 12; // Auto-cluster if more than 12 entries

const GraphView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [drillPath, setDrillPath] = useState<DrillStep[]>([]);
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
    selectedEntityTypes: [],
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
  const repulsion = 1500; // Increased repulsion
  const springLength = 150;
  const damping = 0.80;
  const centering = 0.05;
  const collisionPadding = 10; // Extra space between nodes

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

  // Handle applied filters from navigation
  useEffect(() => {
      const state = location.state as { appliedFilters?: FilterState } | null;
      if (state?.appliedFilters) {
          const newFilters = state.appliedFilters;
          setFilters(newFilters);
          setShowFilters(true);

          if (newFilters.selectedMoods.length > 0) setClusterMode('tag');
          else if (newFilters.selectedTags.length > 0) setClusterMode('mood');
          else if (newFilters.selectedEntities.length > 0) setClusterMode('date');
          else if (newFilters.selectedEntityTypes.length > 0) setClusterMode('entity');
          else if (newFilters.startDate || newFilters.endDate) setClusterMode('mood');
      }
  }, [location.state]);

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
      entries.forEach(e => e.analysis.entities?.forEach(ent => {
          // Filter entities based on Selected Entity Types if any are selected
          if (filters.selectedEntityTypes.length > 0) {
              if (!filters.selectedEntityTypes.includes(ent.type)) return;
          }
          entities.add(ent.name)
      }));
      return Array.from(entities).sort();
  }, [entries, filters.selectedEntityTypes]);

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

  // RECURSIVE LOGIC: Determine next best mode
  const getNextClusterMode = (currentMode: ClusterMode, path: DrillStep[]): ClusterMode => {
      const usedModes = new Set([clusterMode, ...path.map(p => p.mode)]);
      
      // 1. Hierarchy Rules
      if (currentMode === 'entityType') return 'entity'; // Entity Type -> Specific Entities
      if (currentMode === 'entity') return 'date'; // Specific Entity -> Timeline
      if (currentMode === 'date') return 'day'; // Date(Month) -> Day
      if (currentMode === 'day') return 'mood'; // Day -> Mood
      
      // 2. Generic Preference Chain
      const priorities: ClusterMode[] = ['date', 'mood', 'tag', 'entity', 'country'];
      
      for (const p of priorities) {
          if (!usedModes.has(p)) return p;
      }
      
      return 'mood'; // Fallback
  };

  const initializeGraph = () => {
    const newNodes: Node[] = [];
    const newLinks: Link[] = [];
    const tagsMap = new Map<string, Node>();
    const entitiesMap = new Map<string, Node>();

    let workingEntries = filteredEntries;
    
    // Determine Clustered State & Effective Mode
    let isClustered = false;
    let computedMode = clusterMode;

    // Use current depth logic
    if (drillPath.length > 0) {
        // If we have drilled down, we need to pick a new mode if count is still high
        const lastStep = drillPath[drillPath.length - 1];
        
        // If still too many entries, recurse
        if (workingEntries.length > CLUSTER_THRESHOLD && !forceDetailed) {
            computedMode = getNextClusterMode(lastStep.mode, drillPath);
            isClustered = true;
        } else {
            isClustered = false;
        }
    } else {
        // Root level check
        if (workingEntries.length > CLUSTER_THRESHOLD && !forceDetailed) {
            isClustered = true;
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
                    e.analysis.entities.forEach(ent => {
                        // Strict check: if Entity Types filter is active, only cluster valid types
                        if (filters.selectedEntityTypes.length > 0) {
                            if (!filters.selectedEntityTypes.includes(ent.type)) return;
                        }
                        addToCluster(ent.name, ent.name, e);
                    });
                }
            } else if (computedMode === 'entityType') {
                if (!e.analysis.entities || e.analysis.entities.length === 0) {
                    addToCluster('No Entities', 'No Entities', e, '#cbd5e1');
                } else {
                    e.analysis.entities.forEach(ent => {
                        // Strict check: if Entity Types filter is active, only cluster valid types
                        if (filters.selectedEntityTypes.length > 0) {
                            if (!filters.selectedEntityTypes.includes(ent.type)) return;
                        }
                        addToCluster(ent.type, ent.type, e);
                    });
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

            // Calculate Radius: Logarithmic scale to handle large numbers without getting too huge
            // Base 25 + up to 60 extra pixels based on count
            const radius = 25 + Math.min(60, Math.log(count + 1) * 12);

            newNodes.push({
                id: `cluster-${key}`,
                type: 'cluster',
                x: (Math.random() - 0.5) * 600,
                y: (Math.random() - 0.5) * 600,
                vx: 0, vy: 0,
                radius: radius,
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
            // Transitions
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
                if (clusters[source] && clusters[target]) newLinks.push({ source: `cluster-${source}`, target: `cluster-${target}` });
            });
        } else {
            // Co-occurrence (Tags/Entities)
            const cooccurrences: Record<string, number> = {};
            workingEntries.forEach(e => {
                let items: string[] = [];
                if (computedMode === 'tag') items = (e.analysis.manualTags || []);
                else if (computedMode === 'entity') {
                    // Only consider allowed entities for co-occurrence calculation
                    items = (e.analysis.entities?.filter(ent => {
                        if (filters.selectedEntityTypes.length > 0) return filters.selectedEntityTypes.includes(ent.type);
                        return true;
                    }).map(x=>x.name) || []);
                }
                else if (computedMode === 'entityType') {
                    // Only consider allowed types
                    items = (e.analysis.entities?.filter(ent => {
                        if (filters.selectedEntityTypes.length > 0) return filters.selectedEntityTypes.includes(ent.type);
                        return true;
                    }).map(x=>x.type) || []);
                }
                
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
                if (clusters[source] && clusters[target]) newLinks.push({ source: `cluster-${source}`, target: `cluster-${target}` });
            });
        }

    } else {
        // --- DETAILED LOGIC ---
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
                // Strict check: if Entity Types filter is active, only show relevant entity nodes
                if (filters.selectedEntityTypes.length > 0) {
                    if (!filters.selectedEntityTypes.includes(entity.type)) return;
                }

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
    
    // Only center view on initial load or path reset, not every render
    if (containerRef.current && nodes.length === 0) { 
        setOffset({ x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2 });
    }
  };

  useEffect(() => {
      initializeGraph();
      if (selectedNode && !nodes.find(n => n.id === selectedNode.id)) {
          setSelectedNode(null);
      }
  }, [filteredEntries, drillPath, forceDetailed, clusterMode]);

  const fitToScreen = () => {
      if (!containerRef.current || nodes.length === 0) return;
      
      const padding = 50;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      nodes.forEach(n => {
          if (n.x < minX) minX = n.x;
          if (n.x > maxX) maxX = n.x;
          if (n.y < minY) minY = n.y;
          if (n.y > maxY) maxY = n.y;
      });

      if (minX === Infinity) return;

      const graphWidth = maxX - minX;
      const graphHeight = maxY - minY;
      const graphCenterX = (minX + maxX) / 2;
      const graphCenterY = (minY + maxY) / 2;

      // Calculate scale to fit
      const scaleX = (width - padding * 2) / Math.max(graphWidth, 1);
      const scaleY = (height - padding * 2) / Math.max(graphHeight, 1);
      
      // Clamp zoom
      let newZoom = Math.min(scaleX, scaleY);
      newZoom = Math.min(Math.max(newZoom, 0.1), 3);

      // Center graph
      const newOffsetX = (width / 2) - (graphCenterX * newZoom);
      const newOffsetY = (height / 2) - (graphCenterY * newZoom);

      setZoom(newZoom);
      setOffset({ x: newOffsetX, y: newOffsetY });
  };

  // Auto-fit on graph change
  useEffect(() => {
      if (nodes.length > 0) {
          const timer = setTimeout(() => {
              fitToScreen();
          }, 600); // Allow physics to spread nodes before fitting
          return () => clearTimeout(timer);
      }
  }, [nodes]);

  // Interactions State
  const [isPanning, setIsPanning] = useState(false);
  const [dragNode, setDragNode] = useState<Node | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // --- Simulation Loop ---
  useEffect(() => {
    if (nodes.length === 0) return;

    let animationFrameId: number;
    const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]));

    const runSimulation = () => {
        // 1. Repulsion (Long range)
        const cutoffDistance = 500; 
        const cutoffSq = cutoffDistance * cutoffDistance;

        for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i];
            
            // Skip physics for dragged node
            if (dragNode && a.id === dragNode.id) continue;

            for (let j = i + 1; j < nodes.length; j++) {
                const b = nodes[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                if (Math.abs(dx) > cutoffDistance || Math.abs(dy) > cutoffDistance) continue;
                const distSq = dx * dx + dy * dy;
                if (distSq > cutoffSq || distSq === 0) continue;
                const dist = Math.sqrt(distSq) || 1;
                
                // Variable repulsion based on node types (clusters push harder)
                const nodeRepulsion = (a.type === 'cluster' || b.type === 'cluster') ? repulsion * 2 : repulsion;
                
                const force = nodeRepulsion / distSq;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                
                a.vx -= fx; a.vy -= fy; 
                
                // Only push b if it's not being dragged
                if (!dragNode || b.id !== dragNode.id) {
                    b.vx += fx; b.vy += fy;
                }
            }
        }

        // 2. Collision Resolution (Short range, Strict non-overlap)
        for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i];
            // Skip dragged node from position updates via collision, but it still exerts force on others
            
            for (let j = i + 1; j < nodes.length; j++) {
                const b = nodes[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const distSq = dx * dx + dy * dy;
                const minDist = a.radius + b.radius + collisionPadding;
                const minDistSq = minDist * minDist;

                if (distSq < minDistSq) {
                    const dist = Math.sqrt(distSq) || 0.1;
                    const overlap = minDist - dist;
                    // Push apart proportional to overlap
                    const dxNorm = dx / dist;
                    const dyNorm = dy / dist;
                    
                    const correctionForce = overlap * 0.2; // Strength of correction
                    
                    if (!dragNode || a.id !== dragNode.id) {
                        a.vx -= dxNorm * correctionForce;
                        a.vy -= dyNorm * correctionForce;
                    }
                    if (!dragNode || b.id !== dragNode.id) {
                        b.vx += dxNorm * correctionForce;
                        b.vy += dyNorm * correctionForce;
                    }
                }
            }
        }

        // 3. Links (Spring force)
        links.forEach(link => {
            const source = nodeMap.get(link.source);
            const target = nodeMap.get(link.target);
            if (!source || !target) return;
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            // Adjust spring length for clusters to give more space
            const currentSpring = (source.type === 'cluster' || target.type === 'cluster') ? springLength * 1.5 : springLength;

            const force = (dist - currentSpring) * 0.05;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            if (!dragNode || source.id !== dragNode.id) {
                source.vx += fx; source.vy += fy; 
            }
            if (!dragNode || target.id !== dragNode.id) {
                target.vx -= fx; target.vy -= fy;
            }
        });

        // 4. Centering and Movement Integration
        nodes.forEach(node => {
            if (dragNode && node.id === dragNode.id) {
                // Zero velocity for dragged node so it doesn't shoot off when released
                node.vx = 0;
                node.vy = 0;
                return;
            }

            const centerForce = node.type === 'cluster' ? centering * 1.5 : centering;
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
  }, [nodes, links, zoom, offset, dragNode]);


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

    // Links
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

    // Nodes
    nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
        
        // --- Cluster Node Styling ---
        if (node.type === 'cluster') {
            // Dashed outer ring
            ctx.strokeStyle = node.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // White inner border for contrast
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label
            ctx.font = 'bold 12px Inter';
            ctx.fillStyle = '#1e293b'; 
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Show label and count
            const displayLabel = `${node.label} (${node.data.count})`;
            ctx.fillText(displayLabel, node.x, node.y);
        } 
        // --- Selection Highlight ---
        else if (node === selectedNode) {
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 3;
            ctx.stroke();
        } 
        // --- Standard Node Border ---
        else {
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // --- Entity Node Styling ---
        if (node.type === 'entity') {
            ctx.font = 'bold 10px Inter';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let iconChar = 'E';
            if (node.entityType === 'Person') iconChar = 'P';
            if (node.entityType === 'Location') iconChar = 'L';
            ctx.fillText(iconChar, node.x, node.y);
        }

        // --- Labels for non-clusters (Tags, Entities, Entries on zoom) ---
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

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = (e.clientX - rect.left - offset.x) / zoom;
    const mouseY = (e.clientY - rect.top - offset.y) / zoom;

    // Check collision with nodes
    for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const dx = n.x - mouseX;
        const dy = n.y - mouseY;
        if (Math.sqrt(dx * dx + dy * dy) < n.radius + 5) {
            setSelectedNode(n);
            setDragNode(n); // Start dragging node
            setDragStart({ x: mouseX, y: mouseY }); // Store localized start position relative to node center if needed, but simple drag is fine
            return;
        }
    }
    
    // Clicked on background
    setSelectedNode(null);
    setIsPanning(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const mouseX = (e.clientX - rect.left - offset.x) / zoom;
      const mouseY = (e.clientY - rect.top - offset.y) / zoom;

      if (dragNode) {
          // Update dragged node position directly
          dragNode.x = mouseX;
          dragNode.y = mouseY;
          // Force velocity to zero to stop physics fight
          dragNode.vx = 0;
          dragNode.vy = 0;
          // Note: draw() is called by the loop, so we don't strictly need to force it here, 
          // but the loop handles visual updates.
      } else if (isPanning) {
          const dx = e.clientX - dragStart.x;
          const dy = e.clientY - dragStart.y;
          setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
          setDragStart({ x: e.clientX, y: e.clientY });
      } else {
          // Hover Cursor Logic
          let hovering = false;
          for (let i = nodes.length - 1; i >= 0; i--) {
              const n = nodes[i];
              const distSq = (n.x - mouseX) ** 2 + (n.y - mouseY) ** 2;
              if (distSq < (n.radius + 5) ** 2) {
                  hovering = true;
                  break;
              }
          }
          if (canvasRef.current) {
              canvasRef.current.style.cursor = hovering ? 'pointer' : 'grab';
          }
      }
  };

  const handleMouseUp = () => { 
      setIsPanning(false); 
      setDragNode(null); 
  };

  const enterCluster = (key: string, label: string) => {
      // 1. Determine which mode this cluster represents
      const modeUsed = effectiveMode;

      // 2. Add to Drill Path
      setDrillPath(prev => [...prev, { mode: modeUsed, value: key, label }]);
      
      // 3. Sync Filters
      setFilters(prev => {
          const newFilters = { ...prev };
          if (modeUsed === 'tag') {
              newFilters.selectedTags = [...prev.selectedTags, key];
          } else if (modeUsed === 'entity') {
              newFilters.selectedEntities = [...prev.selectedEntities, key];
          } else if (modeUsed === 'entityType') {
              newFilters.selectedEntityTypes = [...prev.selectedEntityTypes, key];
          } else if (modeUsed === 'mood') {
              newFilters.selectedMoods = [...prev.selectedMoods, key];
          } else if (modeUsed === 'country') {
              newFilters.selectedCountries = [...prev.selectedCountries, key];
          } else if (modeUsed === 'city') {
              newFilters.selectedCities = [...prev.selectedCities, key];
          } else if (modeUsed === 'date') {
              // YYYY-MM
              const [year, month] = key.split('-').map(Number);
              if (year && month) {
                  const lastDay = new Date(year, month, 0).getDate();
                  const monthStr = String(month).padStart(2, '0');
                  newFilters.startDate = `${year}-${monthStr}-01`;
                  newFilters.endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
              }
          } else if (modeUsed === 'day') {
              // YYYY-MM-DD
              newFilters.startDate = key;
              newFilters.endDate = key;
          }
          return newFilters;
      });

      // 4. View Reset
      if (containerRef.current) {
          setOffset({ x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2 });
      }
      setZoom(1);
      setShowFilters(true);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      if (selectedNode && selectedNode.type === 'cluster') {
          enterCluster(selectedNode.data.key, selectedNode.label);
      }
  };

  const handleBack = () => {
      if (drillPath.length === 0) return;

      const lastStep = drillPath[drillPath.length - 1];
      const newPath = drillPath.slice(0, -1);
      
      setDrillPath(newPath);

      // Revert Filters based on what we are popping
      setFilters(prev => {
          const next = { ...prev };
          if (lastStep.mode === 'tag') {
              next.selectedTags = prev.selectedTags.filter(t => t !== lastStep.value);
          } else if (lastStep.mode === 'entity') {
              next.selectedEntities = prev.selectedEntities.filter(e => e !== lastStep.value);
          } else if (lastStep.mode === 'entityType') {
              next.selectedEntityTypes = prev.selectedEntityTypes.filter(e => e !== lastStep.value);
          } else if (lastStep.mode === 'mood') {
              next.selectedMoods = prev.selectedMoods.filter(m => m !== lastStep.value);
          } else if (lastStep.mode === 'country') {
              next.selectedCountries = prev.selectedCountries.filter(c => c !== lastStep.value);
          } else if (lastStep.mode === 'city') {
              next.selectedCities = prev.selectedCities.filter(c => c !== lastStep.value);
          } else if (lastStep.mode === 'day') {
              // If we pop a day, we might need to restore the MONTH range from the previous 'date' step
              const previousDateStep = newPath.reverse().find(s => s.mode === 'date');
              if (previousDateStep) {
                  const [year, month] = previousDateStep.value.split('-').map(Number);
                  const lastDay = new Date(year, month, 0).getDate();
                  const monthStr = String(month).padStart(2, '0');
                  next.startDate = `${year}-${monthStr}-01`;
                  next.endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
              } else {
                  // No previous date constraint
                  next.startDate = '';
                  next.endDate = '';
              }
          } else if (lastStep.mode === 'date') {
              // Popping a month means clearing date range (unless there was a year filter, which we don't support yet)
              next.startDate = '';
              next.endDate = '';
          }
          return next;
      });
  };

  const resetView = () => {
      setDrillPath([]);
      setForceDetailed(false);
      setZoom(1);
      if (containerRef.current) {
          setOffset({ x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2 });
      }
      setFilters({
        startDate: '', endDate: '', text: '', selectedMoods: [], selectedTags: [], 
        selectedEntities: [], selectedEntityTypes: [], selectedCountries: [], selectedCities: [], media: []
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
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight cursor-pointer hover:text-indigo-500" onClick={resetView}>{t('graph')}</h1>
                                    {drillPath.map((step, idx) => (
                                        <React.Fragment key={idx}>
                                            <ChevronRight size={14} className="text-slate-400" />
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">{step.label}</span>
                                        </React.Fragment>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {nodes.length} nodes 
                                    {effectiveMode !== clusterMode ? ` (Auto: ${effectiveMode})` : (nodes.some(n=>n.type==='cluster') ? ' (Clustered)' : '')}
                                </p>
                            </div>
                        </div>

                        {/* Cluster Type Selector (Only at root) */}
                        {drillPath.length === 0 && (
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
                            <button onClick={fitToScreen} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded block text-indigo-600 dark:text-indigo-400" title="Fit to Screen"><Maximize size={18}/></button>
                            <button onClick={() => setZoom(z => Math.min(z * 1.2, 3))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded block"><ZoomIn size={18}/></button>
                            <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.2))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded block"><ZoomOut size={18}/></button>
                            <button onClick={resetView} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded block" title="Reset View"><RefreshCw size={18}/></button>
                        </div>
                        
                        {drillPath.length > 0 && (
                            <button onClick={handleBack} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-500 transition-colors flex items-center gap-2 text-xs font-bold">
                                <ArrowLeft size={14} /> Up to {drillPath.length === 1 ? 'Top' : drillPath[drillPath.length - 2].label}
                            </button>
                        )}
                        
                        {drillPath.length === 0 && filteredEntries.length > CLUSTER_THRESHOLD && (
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
            {selectedNode && selectedNode.type !== 'cluster' && (
                <div className="absolute right-4 top-4 bottom-4 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col animate-fade-in-right z-20">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 capitalize">
                            {selectedNode.type} Details
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
