import React, { useState, useEffect, useCallback } from 'react';
import ThreeBackground from './components/ThreeBackground';
import LandingPage from './components/LandingPage';
import CardStack from './components/Swiper/CardStack';
import { CyberButton, Panel, GlitchText } from './components/UI/CyberComponents';
import { Mod, Game } from './types';
import { fetchMods } from './services/nexusService';
import { Download, List, RefreshCw, LogOut } from 'lucide-react';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game>(Game.CYBERPUNK);
  
  const [mods, setMods] = useState<Mod[]>([]);
  const [approvedMods, setApprovedMods] = useState<Mod[]>([]);
  const [seenModIds, setSeenModIds] = useState<Set<number>>(new Set());
  
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'landing' | 'swiping' | 'list'>('landing');

  // Initialization: Load persistence
  useEffect(() => {
    const savedSeen = localStorage.getItem('seenModIds');
    if (savedSeen) {
      setSeenModIds(new Set(JSON.parse(savedSeen)));
    }
  }, []);

  // Save persistence on change
  useEffect(() => {
    localStorage.setItem('seenModIds', JSON.stringify(Array.from(seenModIds)));
  }, [seenModIds]);

  const loadMods = useCallback(async (key: string, game: Game) => {
    setIsLoading(true);
    try {
      // In a real app we might fetch different sort orders randomly for variety
      const newMods = await fetchMods(key, game, 'trending');
      
      // Filter out seen mods
      const filtered = newMods.filter(m => !seenModIds.has(m.mod_id));
      
      setMods(filtered);
    } catch (error) {
      alert("Failed to fetch mods. Check console.");
    } finally {
      setIsLoading(false);
    }
  }, [seenModIds]);

  const handleStart = (key: string, game: Game) => {
    setApiKey(key);
    setSelectedGame(game);
    setView('swiping');
    loadMods(key, game);
  };

  const handleApprove = (mod: Mod) => {
    setApprovedMods(prev => [...prev, mod]);
    setSeenModIds(prev => new Set(prev).add(mod.mod_id));
  };

  const handleReject = (mod: Mod) => {
    setSeenModIds(prev => new Set(prev).add(mod.mod_id));
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
          </div>

          <div className="pointer-events-auto flex gap-4">
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
             <button 
              onClick={() => {
                setApiKey(null);
                setView('landing');
              }}
              className="bg-black/50 border border-red-500 p-2 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="relative z-10 pt-20 px-4 h-screen flex flex-col">
        {view === 'landing' && (
          <LandingPage onStart={handleStart} />
        )}

        {view === 'swiping' && (
          <div className="flex-1 flex flex-col items-center justify-center">
             <CardStack 
               mods={mods} 
               onApprove={handleApprove} 
               onReject={handleReject} 
               isLoading={isLoading}
               onRefresh={() => apiKey && loadMods(apiKey, selectedGame)}
             />
             <div className="mt-8 text-center text-xs text-gray-500 font-mono">
               <p>CONTROLS: [ A / LEFT ] REJECT  ---  [ D / RIGHT ] APPROVE</p>
             </div>
          </div>
        )}

        {view === 'list' && (
          <div className="flex-1 max-w-4xl mx-auto w-full overflow-hidden flex flex-col pb-8">
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
                  approvedMods.map((mod, i) => (
                    <div key={i} className="flex gap-4 p-4 border border-gray-800 bg-gray-900/50 hover:border-cp-cyan transition-colors group">
                      <img src={mod.picture_url} alt="" className="w-24 h-24 object-cover border border-gray-700" />
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white group-hover:text-cp-cyan">{mod.name}</h3>
                        <p className="text-sm text-gray-400 font-mono mb-2">{mod.author}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{mod.summary}</p>
                      </div>
                      <a 
                        href={`https://www.nexusmods.com/${mod.domain_name}/mods/${mod.mod_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="self-center p-2 text-cp-yellow hover:text-white"
                      >
                        <Download size={24} />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>
        )}
      </main>

      {/* Decorative Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 mix-blend-overlay opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
    </div>
  );
};

export default App;
