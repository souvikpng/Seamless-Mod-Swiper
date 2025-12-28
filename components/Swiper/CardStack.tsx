import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Mod } from '../../types';
import ModCard from './ModCard';
import { CyberButton, GlitchText } from '../UI/CyberComponents';
import { XCircle, CheckCircle } from 'lucide-react';

interface CardStackProps {
  mods: Mod[];
  onApprove: (mod: Mod) => void;
  onReject: (mod: Mod) => void;
  isLoading: boolean;
  onRefresh: (forceRefresh?: boolean) => void;
  onQueueChange?: (remaining: number) => void;
}

const CardStack: React.FC<CardStackProps> = ({ mods, onApprove, onReject, isLoading, onRefresh, onQueueChange }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  
  // Ref to prevent double-swipes
  const swipeInProgress = useRef(false);

  // Reset index when mods change (new batch loaded)
  useEffect(() => {
    setCurrentIndex(0);
    setIsAnimating(false);
    setExitDirection(null);
    swipeInProgress.current = false;
  }, [mods]);

  // Report queue changes
  useEffect(() => {
    const remaining = Math.max(0, mods.length - currentIndex);
    onQueueChange?.(remaining);
  }, [currentIndex, mods.length, onQueueChange]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLoading || isAnimating || currentIndex >= mods.length) return;
      
      if (e.key.toLowerCase() === 'a' || e.key === 'ArrowLeft') {
        triggerSwipe('left');
      } else if (e.key.toLowerCase() === 'd' || e.key === 'ArrowRight') {
        triggerSwipe('right');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, mods, isLoading, isAnimating]);

  // Trigger a swipe animation (for keyboard/button use)
  const triggerSwipe = useCallback((direction: 'left' | 'right') => {
    if (isAnimating || currentIndex >= mods.length || swipeInProgress.current) return;
    
    swipeInProgress.current = true;
    setIsAnimating(true);
    setExitDirection(direction);
    
    // Complete the swipe after animation
    setTimeout(() => {
      completeSwipe(direction);
    }, 300);
  }, [currentIndex, mods.length, isAnimating]);

  // Complete the swipe (called after animation or from drag)
  const completeSwipe = useCallback((direction: 'left' | 'right') => {
    if (currentIndex >= mods.length) return;

    const currentMod = mods[currentIndex];
    if (direction === 'left') {
      onReject(currentMod);
    } else {
      onApprove(currentMod);
    }
    
    setCurrentIndex(prev => prev + 1);
    setIsAnimating(false);
    setExitDirection(null);
    swipeInProgress.current = false;
  }, [currentIndex, mods, onReject, onApprove]);

  // Handle swipe from drag gesture (animation already handled in ModCard)
  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (swipeInProgress.current) return;
    swipeInProgress.current = true;
    completeSwipe(direction);
  }, [completeSwipe]);

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
      <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto p-8 bg-cp-dark/80 border border-cp-gray backdrop-blur-md cp-clip-box">
        <div className="text-6xl mb-4">🏁</div>
        <h2 className="text-3xl font-bold text-white mb-2 font-sans uppercase">Queue Depleted</h2>
        <p className="text-cp-cyan font-mono mb-8">You have swiped through the current batch.</p>
        <CyberButton 
          label="Load More Mods" 
          onClick={() => { setCurrentIndex(0); onRefresh(true); }} 
        />
        <p className="text-[10px] text-gray-600 mt-4 font-mono">Fetches random mods from Nexus</p>
      </div>
    );
  }

  // We render the top card and the one below it for visual stacking
  const visibleMods = mods.slice(currentIndex, currentIndex + 2).reverse();

  return (
    <div className="relative w-full max-w-md mx-auto flex flex-col items-center">
      {/* Card container */}
      <div className="relative w-full h-[65vh] flex items-start justify-center perspective-[1000px]">
        <AnimatePresence mode="popLayout">
          {visibleMods.map((mod, index) => {
            const isTop = index === visibleMods.length - 1;
            const isCurrentCard = mods[currentIndex]?.mod_id === mod.mod_id;
            return (
              <ModCard
                key={mod.mod_id}
                mod={mod}
                onSwipe={handleSwipe}
                drag={isTop && !isAnimating}
                isExiting={isCurrentCard && isAnimating}
                exitDirection={isCurrentCard ? exitDirection : null}
                style={{
                  zIndex: isTop ? 50 : 10,
                  scale: isTop ? 1 : 0.95,
                  y: isTop ? 0 : 20,
                }}
              />
            );
          })}
        </AnimatePresence>
      </div>
      
      {/* Visual Controls - now below the card with proper spacing */}
      <div className="flex gap-8 mt-6">
         <button 
           onClick={() => triggerSwipe('left')}
           disabled={isAnimating}
           className="w-14 h-14 rounded-full border-2 border-cp-red text-cp-red hover:bg-cp-red hover:text-white transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
         >
           <XCircle size={28} />
         </button>
         <button 
           onClick={() => triggerSwipe('right')}
           disabled={isAnimating}
           className="w-14 h-14 rounded-full border-2 border-cp-cyan text-cp-cyan hover:bg-cp-cyan hover:text-black transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
         >
           <CheckCircle size={28} />
         </button>
      </div>
    </div>
  );
};

export default CardStack;
