import React, { useState } from 'react';
import { Game } from '../types';
import { CyberButton, GlitchText, Panel } from './UI/CyberComponents';
import { Cpu, ShieldCheck } from 'lucide-react';

interface LandingPageProps {
  onStart: (apiKey: string, game: Game) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const [key, setKey] = useState('');
  const [game, setGame] = useState<Game>(Game.CYBERPUNK);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(key, game);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <Panel className="w-full max-w-2xl p-10 bg-black/80 border-2 border-cp-yellow shadow-[0_0_50px_rgba(252,238,10,0.2)]">
        
        <div className="text-center mb-12 space-y-2">
          <div className="flex justify-center mb-4 text-cp-yellow animate-pulse">
            <Cpu size={64} />
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter transform -skew-x-6">
            Seamless <span className="text-cp-yellow">Mod</span> Swiper
          </h1>
          <p className="text-cp-cyan font-mono text-lg tracking-widest uppercase">
            Nexus Protocol V.2.0.77
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block pl-1">
              Target System (Game)
            </label>
            <div className="grid grid-cols-2 gap-4 font-mono text-sm">
               <button 
                 type="button"
                 onClick={() => setGame(Game.CYBERPUNK)}
                 className={`p-4 border ${game === Game.CYBERPUNK ? 'bg-cp-yellow text-black border-cp-yellow' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
               >
                 CP2077
               </button>
               <button 
                 type="button"
                 disabled
                 className="p-4 border border-gray-800 text-gray-700 cursor-not-allowed relative overflow-hidden"
               >
                 <span>WITCHER 3</span>
                 <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px]">LOCKED</div>
               </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block pl-1">
              Access Token (Nexus API)
            </label>
            <div className="relative group">
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="ENTER API KEY"
                className="w-full bg-cp-dark border-b-2 border-gray-700 p-4 text-white font-mono focus:outline-none focus:border-cp-cyan transition-colors placeholder-gray-800"
              />
              <div className="absolute right-4 top-4 text-gray-700 group-focus-within:text-cp-cyan transition-colors">
                <ShieldCheck size={20} />
              </div>
            </div>
            <p className="text-[10px] text-gray-500 font-mono pl-1">
              * Keys are processed in volatile memory only. No server storage.
            </p>
          </div>

          <div className="pt-4 flex justify-center">
            <CyberButton 
              label="Initialize Connection" 
              subLabel="Establish Uplink"
              type="submit"
              className="w-full md:w-auto min-w-[200px]"
            />
          </div>
        </form>
      </Panel>
    </div>
  );
};

export default LandingPage;
