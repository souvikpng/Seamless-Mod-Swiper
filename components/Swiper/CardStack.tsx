import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Mod } from '../../types';
import ModCard from './ModCard';
import { CyberButton, GlitchText } from '../UI/CyberComponents';
import { Download, RefreshCw, XCircle, CheckCircle } from 'lucide-react';

interface CardStackProps {
  mods: Mod[];
  onApprove: (mod: Mod) => void;
  onReject: (mod: Mod) => void;
  isLoading: boolean;
  onRefresh: () => void;
}

const CardStack: React.FC<CardStackProps> = ({ mods, onApprove, onReject, isLoading, onRefresh }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLoading || currentIndex >= mods.length) return;
      
      if (e.key.toLowerCase() === 'a' || e.key === 'ArrowLeft') {
        handleSwipe('left');
      } else if (e.key.toLowerCase() === 'd' || e.key === 'ArrowRight') {
        handleSwipe('right');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, mods, isLoading]);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (currentIndex >= mods.length) return;

    const currentMod = mods[currentIndex];
    if (direction === 'left') {
      onReject(currentMod);
    } else {
      onApprove(currentMod);
    }
    
    // Add a slight delay to allow animation to start before unmounting or state change
    setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
    }, 200);

  }, [currentIndex, mods, onReject, onApprove]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-cp-yellow animate-pulse">
        <div className="w-16 h-16 border-4 border-t-cp-cyan border-r-cp-yellow border-b-cp-red border-l-transparent rounded-full animate-spin mb-4" />
        <GlitchText text="JACKING IN..." className="text-2xl font-mono tracking-widest" />
      </div>
    );
  }

  if (currentIndex >= mods.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-md mx-auto p-8 bg-cp-dark/80 border border-cp-gray backdrop-blur-md cp-clip-box">
        <div className="text-6xl mb-4">🏁</div>
        <h2 className="text-3xl font-bold text-white mb-2 font-sans uppercase">Queue Depleted</h2>
        <p className="text-cp-cyan font-mono mb-8">You have swiped through the current batch.</p>
        <CyberButton label="Fetch More Data" onClick={() => { setCurrentIndex(0); onRefresh(); }} />
      </div>
    );
  }

  // We render the top card and the one below it for visual stacking
  const visibleMods = mods.slice(currentIndex, currentIndex + 2).reverse();

  return (
    <div className="relative w-full max-w-md h-[70vh] mx-auto flex items-center justify-center perspective-[1000px]">
      <AnimatePresence>
        {visibleMods.map((mod, index) => {
          const isTop = index === visibleMods.length - 1;
          return (
            <ModCard
              key={mod.mod_id}
              mod={mod}
              onSwipe={handleSwipe}
              drag={isTop}
              style={{
                zIndex: isTop ? 50 : 10,
                scale: isTop ? 1 : 0.95,
                y: isTop ? 0 : 20,
              }}
            />
          );
        })}
      </AnimatePresence>
      
      {/* Visual Controls for Mouse Users */}
      <div className="absolute -bottom-24 flex gap-8">
         <button 
           onClick={() => handleSwipe('left')}
           className="w-16 h-16 rounded-full border-2 border-cp-red text-cp-red hover:bg-cp-red hover:text-white transition-all flex items-center justify-center"
         >
           <XCircle size={32} />
         </button>
         <button 
           onClick={() => handleSwipe('right')}
           className="w-16 h-16 rounded-full border-2 border-cp-cyan text-cp-cyan hover:bg-cp-cyan hover:text-black transition-all flex items-center justify-center"
         >
           <CheckCircle size={32} />
         </button>
      </div>
    </div>
  );
};

export default CardStack;
