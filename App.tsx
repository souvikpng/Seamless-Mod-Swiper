import React, { useState, useEffect, useCallback, useRef } from 'react';
import ThreeBackground from './components/ThreeBackground';
import LandingPage from './components/LandingPage';
import CardStack from './components/Swiper/CardStack';
import { CyberButton, Panel, GlitchText } from './components/UI/CyberComponents';
import { Mod, Game } from './types';
import { fetchModsBulk, RateLimitInfo, FetchProgress } from './services/nexusService';
import { 
  getCachedMods, 
  appendToCachedMods,
  filterUnseenMods, 
  getCacheAge,
  clearModCache,
  getUnseenCachedMods,
  getCachedModCount
} from './services/cacheService';
import { Download, List, LogOut, Zap, Trash2, Database, Settings, RotateCcw, Loader2, RefreshCw } from 'lucide-react';

// Configuration
const BULK_FETCH_COUNT = 300; // Mods to fetch per bulk operation
const LOW_QUEUE_THRESHOLD = 20; // Auto-refresh when queue drops below this
const AUTO_REFRESH_COOLDOWN = 60000; // Minimum time between auto-refreshes (ms)

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game>(Game.CYBERPUNK);
  
  const [mods, setMods] = useState<Mod[]>([]);
  const [approvedMods, setApprovedMods] = useState<Mod[]>([]);
  const [seenModIds, setSeenModIds] = useState<Set<number>>(new Set());
  
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<FetchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [view, setView] = useState<'landing' | 'swiping' | 'list'>('landing');
  const [showSettings, setShowSettings] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [queueRemaining, setQueueRemaining] = useState(0);
  const [cachedCount, setCachedCount] = useState(0);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [currentModIndex, setCurrentModIndex] = useState(0);
  
  const settingsRef = useRef<HTMLDivElement>(null);
  const lastAutoRefresh = useRef<number>(0);
  const isAutoRefreshing = useRef<boolean>(false);
  const seenModIdsRef = useRef<Set<number>>(seenModIds);

  // Initialization: Load persistence from localStorage
  useEffect(() => {
    const savedSeen = localStorage.getItem('seenModIds');
    if (savedSeen) {
      try {
        setSeenModIds(new Set(JSON.parse(savedSeen)));
      } catch (e) {
        console.error('Failed to parse seenModIds from localStorage:', e);
      }
    }
    
    const savedApproved = localStorage.getItem('approvedMods');
    if (savedApproved) {
      try {
        setApprovedMods(JSON.parse(savedApproved));
      } catch (e) {
        console.error('Failed to parse approvedMods from localStorage:', e);
      }
    }
  }, []);

  // Save seenModIds to localStorage on change and keep ref in sync
  useEffect(() => {
    seenModIdsRef.current = seenModIds;
    localStorage.setItem('seenModIds', JSON.stringify(Array.from(seenModIds)));
  }, [seenModIds]);

  // Save approvedMods to localStorage on change
  useEffect(() => {
    localStorage.setItem('approvedMods', JSON.stringify(approvedMods));
  }, [approvedMods]);

  // Close settings dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  // Update cache stats periodically
  useEffect(() => {
    const updateCacheStats = async () => {
      const count = await getCachedModCount(selectedGame);
      const age = await getCacheAge(selectedGame);
      setCachedCount(count);
      setCacheAge(age);
    };

    updateCacheStats();
    const interval = setInterval(updateCacheStats, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [selectedGame]);

  // Auto-refresh when queue runs low
  useEffect(() => {
    const checkAndAutoRefresh = async () => {
      if (
        !apiKey || 
        !view || 
        view !== 'swiping' ||
        isLoading || 
        isBulkLoading ||
        isAutoRefreshing.current ||
        queueRemaining >= LOW_QUEUE_THRESHOLD
      ) {
        return;
      }

      // Check cooldown
      const now = Date.now();
      if (now - lastAutoRefresh.current < AUTO_REFRESH_COOLDOWN) {
        return;
      }

      console.log(`Queue low (${queueRemaining}), auto-refreshing...`);
      isAutoRefreshing.current = true;
      lastAutoRefresh.current = now;

      try {
        // Try to load from cache first (use ref for current value)
        const unseenFromCache = await getUnseenCachedMods(selectedGame, seenModIdsRef.current);
        
        if (unseenFromCache.length >= LOW_QUEUE_THRESHOLD) {
          // We have enough in cache, just load more into the queue
          setMods(prev => {
            const currentIds = new Set(prev.map(m => m.mod_id));
            const newMods = unseenFromCache.filter(m => !currentIds.has(m.mod_id));
            return [...prev, ...newMods.slice(0, 50)]; // Add up to 50 more
          });
        } else {
          // Cache is running low, fetch more in background
          await loadModsBulk(apiKey, selectedGame, true);
        }
      } finally {
        isAutoRefreshing.current = false;
      }
    };

    checkAndAutoRefresh();
  }, [queueRemaining, apiKey, view, isLoading, isBulkLoading, selectedGame, seenModIds.size]);

  /**
   * Bulk load mods with progress indicator
   */
  const loadModsBulk = useCallback(async (
    key: string, 
    game: Game, 
    isBackground: boolean = false
  ) => {
    if (!isBackground) {
      setIsLoading(true);
    }
    setIsBulkLoading(true);
    setError(null);
    
    try {
      // First, check if we have unseen mods in cache (use ref for current value)
      const currentSeenIds = seenModIdsRef.current;
      const cachedMods = await getCachedMods(game);
      const unseenCached = filterUnseenMods(cachedMods, currentSeenIds);
      
      if (unseenCached.length >= BULK_FETCH_COUNT / 2 && !isBackground) {
        // Use cache if we have a good amount
        console.log(`Using ${unseenCached.length} unseen mods from cache`);
        setMods(unseenCached);
        setCurrentModIndex(0); // Reset to start for new batch
        setIsLoading(false);
        setIsBulkLoading(false);
        return;
      }

      // Fetch bulk mods with progress
      const alreadyCachedIds = new Set(cachedMods.map(m => m.mod_id));
      const excludeIds = new Set([...currentSeenIds, ...alreadyCachedIds]);

      const response = await fetchModsBulk(
        key, 
        game, 
        BULK_FETCH_COUNT,
        (progress) => setLoadProgress(progress),
        excludeIds
      );

      // Update rate limit
      if (response.rateLimit) {
        setRateLimit(response.rateLimit);
      }

      // Add new mods to cache
      if (response.mods.length > 0) {
        await appendToCachedMods(game, response.mods);
      }

      // Filter and set mods for display
      const unseenMods = filterUnseenMods(response.mods, currentSeenIds);
      
      if (!isBackground) {
        // Also include unseen from cache
        const allUnseen = [...unseenCached, ...unseenMods];
        const uniqueUnseen = Array.from(
          new Map(allUnseen.map(m => [m.mod_id, m])).values()
        );
        setMods(uniqueUnseen);
        setCurrentModIndex(0); // Reset to start for new batch
      } else {
        // Background refresh: append to existing queue
        setMods(prev => {
          const currentIds = new Set(prev.map(m => m.mod_id));
          const newMods = unseenMods.filter(m => !currentIds.has(m.mod_id));
          return [...prev, ...newMods];
        });
      }

      // Update cache stats
      const count = await getCachedModCount(game);
      const age = await getCacheAge(game);
      setCachedCount(count);
      setCacheAge(age);

      if (unseenMods.length === 0 && unseenCached.length === 0) {
        setError("No new mods found. You may have seen most available mods!");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch mods. Check console.";
      setError(message);
      console.error("Failed to fetch mods:", err);
    } finally {
      setIsLoading(false);
      setIsBulkLoading(false);
      setLoadProgress(null);
    }
  }, []);

  const handleStart = (key: string, game: Game) => {
    setApiKey(key);
    setSelectedGame(game);
    setView('swiping');
    loadModsBulk(key, game);
  };

  const handleApprove = (mod: Mod) => {
    setApprovedMods(prev => [...prev, mod]);
    setSeenModIds(prev => new Set(prev).add(mod.mod_id));
  };

  const handleReject = (mod: Mod) => {
    setSeenModIds(prev => new Set(prev).add(mod.mod_id));
  };

  const handleRemoveApproved = (modId: number) => {
    setApprovedMods(prev => prev.filter(m => m.mod_id !== modId));
  };

  const handleExport = () => {
    const content = approvedMods.map(m => 
      `${m.name}\nURL: https://www.nexusmods.com/${m.domain_name}/mods/${m.mod_id}\n-------------------`
    ).join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexus_mod_list.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetProgress = async () => {
    try {
      await clearModCache(selectedGame);
    } catch (err) {
      console.error('Failed to clear mod cache:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear cache');
    } finally {
      // Always perform cleanup even if cache clear fails
      setSeenModIds(new Set());
      setApprovedMods([]);
      setMods([]);
      setCurrentModIndex(0);
      localStorage.removeItem('seenModIds');
      localStorage.removeItem('approvedMods');
      setShowResetConfirm(false);
      setShowSettings(false);
      setCachedCount(0);
      setCacheAge(null);
      // Reload mods
      if (apiKey) {
        loadModsBulk(apiKey, selectedGame);
      }
    }
  };

  return (
    <div className="relative min-h-screen text-white font-sans overflow-hidden">
      <ThreeBackground />

      {/* Header / HUD */}
      {view !== 'landing' && (
        <header className="fixed top-0 left-0 w-full z-50 p-4 flex justify-between items-start pointer-events-none">
          <div className="pointer-events-auto">
             <div className="text-cp-yellow font-bold text-xl tracking-widest uppercase">
               SMS <span className="text-white text-xs align-top">v1.0</span>
             </div>
             <div className="text-[10px] text-cp-cyan font-mono">
               NET_STATUS: ONLINE
             </div>
             {rateLimit && (
               <div className="flex items-center gap-1 text-[10px] font-mono mt-1">
                 <Zap size={10} className={rateLimit.hourlyRemaining < 100 ? 'text-cp-red' : 'text-cp-yellow'} />
                 <span className={rateLimit.hourlyRemaining < 100 ? 'text-cp-red' : 'text-gray-400'}>
                   API: {rateLimit.hourlyRemaining}/{rateLimit.hourlyLimit} hr
                 </span>
               </div>
             )}
             {cachedCount > 0 && (
               <div className="flex items-center gap-1 text-[10px] font-mono mt-1">
                 <Database size={10} className="text-cp-cyan" />
                 <span className="text-gray-400">
                   Cache: {cachedCount} mods {cacheAge !== null && `(${cacheAge}min old)`}
                 </span>
               </div>
             )}
          </div>

          <div className="pointer-events-auto flex gap-2">
            {/* Refresh Button */}
            <button 
              type="button"
              onClick={() => apiKey && loadModsBulk(apiKey, selectedGame, false)}
              disabled={isBulkLoading}
              className={`bg-black/50 border p-2 transition-colors ${
                isBulkLoading 
                  ? 'border-cp-cyan text-cp-cyan' 
                  : 'border-gray-600 text-gray-400 hover:border-cp-cyan hover:text-cp-cyan'
              }`}
              title="Fetch more mods"
            >
              <RefreshCw size={20} className={isBulkLoading ? 'animate-spin' : ''} />
            </button>

            {/* Settings Button */}
            <div className="relative" ref={settingsRef}>
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`bg-black/50 border p-2 transition-colors ${showSettings ? 'border-cp-cyan text-cp-cyan' : 'border-gray-600 text-gray-400 hover:border-cp-cyan hover:text-cp-cyan'}`}
              >
                <Settings size={20} />
              </button>
              
              {/* Settings Dropdown */}
              {showSettings && (
                <div className="absolute right-0 top-12 bg-black/95 border border-cp-gray p-4 min-w-[200px] z-50">
                  <h3 className="text-cp-yellow font-bold text-sm mb-3 uppercase tracking-wider">Settings</h3>
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full flex items-center gap-2 p-2 text-left text-gray-300 hover:text-cp-red hover:bg-cp-red/10 transition-colors"
                  >
                    <RotateCcw size={16} />
                    <span className="text-sm">Reset Progress</span>
                  </button>
                  <p className="text-[10px] text-gray-600 mt-2 px-2">
                    Clears all seen mods and approved list
                  </p>
                </div>
              )}
            </div>

            {/* Approved List Button */}
            <button 
              onClick={() => setView(view === 'list' ? 'swiping' : 'list')}
              className="bg-black/50 border border-cp-yellow p-2 hover:bg-cp-yellow hover:text-black transition-colors"
            >
              <div className="relative">
                <List size={20} />
                {approvedMods.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-cp-red text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                    {approvedMods.length}
                  </span>
                )}
              </div>
            </button>

            {/* Logout Button */}
             <button 
              onClick={() => {
                setApiKey(null);
                setView('landing');
                setShowSettings(false);
              }}
              className="bg-black/50 border border-red-500 p-2 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="relative z-10 pt-16 px-4 h-screen flex flex-col">
        {view === 'landing' && (
          <div className="flex-1 flex items-center justify-center">
            <LandingPage onStart={handleStart} />
          </div>
        )}

        {view === 'swiping' && (
          <div className="flex-1 flex flex-col items-center justify-center">
             {/* Bulk Loading Progress */}
             {isBulkLoading && loadProgress && (
               <div className="mb-4 p-4 bg-black/80 border border-cp-cyan max-w-md w-full">
                 <div className="flex items-center gap-3 mb-2">
                   <Loader2 size={20} className="text-cp-cyan animate-spin" />
                   <span className="text-cp-cyan font-mono text-sm uppercase">
                     {loadProgress.phase === 'pool' && 'Scanning Nexus...'}
                     {loadProgress.phase === 'fetching' && 'Downloading Mods...'}
                     {loadProgress.phase === 'lists' && 'Fetching Curated Lists...'}
                     {loadProgress.phase === 'complete' && 'Complete!'}
                   </span>
                 </div>
<div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cp-cyan transition-all duration-300"
                      style={{ width: `${loadProgress.total > 0 ? Math.min((loadProgress.current / loadProgress.total) * 100, 100) : 0}%` }}
                    />
                  </div>
                 <p className="text-[10px] text-gray-500 font-mono mt-2">
                   {loadProgress.message}
                 </p>
               </div>
             )}

             {error && !isBulkLoading && (
               <div className="mb-4 p-3 bg-cp-red/20 border border-cp-red text-cp-red font-mono text-xs max-w-md text-center">
                 {error}
               </div>
             )}
             
<CardStack 
                mods={mods} 
                onApprove={handleApprove} 
                onReject={handleReject} 
                isLoading={isLoading && !isBulkLoading}
                onRefresh={(forceRefresh) => apiKey && loadModsBulk(apiKey, selectedGame, !forceRefresh)}
                onQueueChange={setQueueRemaining}
                currentIndex={currentModIndex}
                onIndexChange={setCurrentModIndex}
              />
             
             {/* Controls info - positioned at bottom with no overlap */}
             <div className="mt-4 text-center text-[10px] text-gray-600 font-mono">
               <span className="text-gray-500">[A] REJECT</span>
               <span className="mx-4 text-gray-700">|</span>
               <span className="text-gray-500">[D] APPROVE</span>
               {queueRemaining > 0 && (
                 <span className="ml-4 text-cp-cyan">({queueRemaining} in queue)</span>
               )}
               {isBulkLoading && (
                 <span className="ml-4 text-cp-yellow animate-pulse">(loading more...)</span>
               )}
             </div>
          </div>
        )}

        {view === 'list' && (
          <div className="flex-1 max-w-4xl mx-auto w-full overflow-hidden flex flex-col pb-4 -mt-4">
            <Panel className="flex-1 flex flex-col overflow-hidden bg-black/90">
              <div className="border-b border-gray-800 p-6 flex justify-between items-center">
                <GlitchText text="APPROVED_MODS_CACHE" className="text-2xl font-bold text-white" />
                <CyberButton 
                  label="Export List" 
                  variant="success" 
                  onClick={handleExport}
                  disabled={approvedMods.length === 0}
                />
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 cp-scrollbar">
                {approvedMods.length === 0 ? (
                  <div className="text-center text-gray-500 py-20 font-mono">
                    NO DATA FRAGMENTS FOUND. RETURN TO SCANNING.
                  </div>
                ) : (
                  approvedMods.map((mod) => (
                    <div key={mod.mod_id} className="flex gap-4 p-4 border border-gray-800 bg-gray-900/50 hover:border-cp-cyan transition-colors group">
                      <img src={mod.picture_url} alt="" className="w-24 h-24 object-cover border border-gray-700" />
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white group-hover:text-cp-cyan">{mod.name}</h3>
                        <p className="text-sm text-gray-400 font-mono mb-2">{mod.author}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{mod.summary}</p>
                      </div>
                      <div className="flex flex-col gap-2 self-center">
                        <a 
                          href={`https://www.nexusmods.com/${mod.domain_name}/mods/${mod.mod_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-cp-yellow hover:text-white transition-colors"
                          title="View on Nexus Mods"
                        >
                          <Download size={24} />
                        </a>
                        <button
                          onClick={() => handleRemoveApproved(mod.mod_id)}
                          className="p-2 text-gray-500 hover:text-cp-red transition-colors"
                          title="Remove from list"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>
        )}
      </main>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
          <div className="bg-gray-900 border border-cp-red p-6 max-w-sm mx-4">
            <h3 className="text-cp-red font-bold text-lg mb-4 uppercase tracking-wider">
              Confirm Reset
            </h3>
            <p className="text-gray-300 text-sm mb-6">
              This will clear all your progress including:
            </p>
            <ul className="text-gray-400 text-xs mb-6 space-y-1 ml-4">
              <li>- All seen mods ({seenModIds.size} mods)</li>
              <li>- Approved mods list ({approvedMods.length} mods)</li>
              <li>- Local mod cache ({cachedCount} mods)</li>
            </ul>
            <p className="text-cp-yellow text-xs mb-6">
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetProgress}
                className="flex-1 px-4 py-2 bg-cp-red border border-cp-red text-white hover:bg-cp-red/80 transition-colors"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decorative Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 mix-blend-overlay opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
    </div>
  );
};

export default App;
