import React from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Mod } from '../../types';
import { Panel, CyberButton } from '../UI/CyberComponents';
import { ThumbsUp, Download, User, Calendar } from 'lucide-react';

interface ModCardProps {
  mod: Mod;
  onSwipe: (direction: 'left' | 'right') => void;
  style?: any; // Framer motion styles
  drag?: boolean | "x" | "y";
}

const ModCard: React.FC<ModCardProps> = ({ mod, onSwipe, style, drag }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  
  // Overlay colors for feedback
  const approveOpacity = useTransform(x, [50, 150], [0, 0.5]);
  const rejectOpacity = useTransform(x, [-150, -50], [0.5, 0]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 100) {
      onSwipe('right');
    } else if (info.offset.x < -100) {
      onSwipe('left');
    }
  };

  return (
    <motion.div
      style={{ x, rotate, opacity, ...style }}
      drag={drag}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      className="absolute w-full max-w-md h-[70vh] cursor-grab active:cursor-grabbing"
    >
      <Panel className="h-full flex flex-col p-0 border-l-4 border-cp-yellow bg-black overflow-hidden relative">
        
        {/* Approve Overlay */}
        <motion.div 
          style={{ opacity: approveOpacity }} 
          className="absolute inset-0 bg-green-500/30 z-20 flex items-center justify-center pointer-events-none"
        >
          <div className="border-4 border-green-500 text-green-500 font-bold text-6xl px-8 py-4 -rotate-12 uppercase tracking-widest">
            Install
          </div>
        </motion.div>

        {/* Reject Overlay */}
        <motion.div 
          style={{ opacity: rejectOpacity }} 
          className="absolute inset-0 bg-red-500/30 z-20 flex items-center justify-center pointer-events-none"
        >
          <div className="border-4 border-red-500 text-red-500 font-bold text-6xl px-8 py-4 rotate-12 uppercase tracking-widest">
            Skip
          </div>
        </motion.div>

        {/* Image */}
        <div className="relative h-1/2 w-full overflow-hidden group">
          <img 
            src={mod.picture_url || 'https://via.placeholder.com/600x400?text=No+Image'} 
            alt={mod.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            draggable="false"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <h2 className="text-3xl font-bold text-white uppercase leading-none drop-shadow-md tracking-tighter line-clamp-2">
              {mod.name}
            </h2>
            <div className="flex items-center gap-2 text-cp-yellow text-sm font-mono mt-1">
              <User size={14} />
              <span>{mod.author}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex flex-col justify-between relative bg-cp-dark">
          {/* Scanline overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-0" />

          <div className="relative z-10 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
               <div className="flex items-center gap-2 text-gray-400 text-xs font-mono">
                 <Calendar size={12} />
                 <span>{new Date(mod.created_timestamp * 1000).toLocaleDateString()}</span>
               </div>
               <div className="flex items-center gap-2 text-cp-cyan text-sm font-bold">
                 <ThumbsUp size={14} />
                 <span>{mod.endorsement_count.toLocaleString()}</span>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto cp-scrollbar pr-2 mb-4">
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line font-mono">
                {mod.summary || "No summary provided."}
              </p>
            </div>

            <div className="flex gap-2 mt-auto">
               {/* Decorative footer bits */}
               <div className="h-1 flex-1 bg-gray-800 rounded-full overflow-hidden">
                 <div className="h-full w-2/3 bg-cp-yellow" />
               </div>
               <div className="text-[10px] text-gray-600 font-mono">V. {mod.version}</div>
            </div>
          </div>
        </div>
      </Panel>
    </motion.div>
  );
};

export default ModCard;
