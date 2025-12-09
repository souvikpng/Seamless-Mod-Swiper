import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'success' | 'ghost';
  label: string;
  subLabel?: string;
}

export const CyberButton: React.FC<CyberButtonProps> = ({ 
  variant = 'primary', 
  label, 
  subLabel,
  className, 
  ...props 
}) => {
  const baseStyles = "relative px-8 py-3 font-bold uppercase tracking-widest transition-all duration-100 transform active:scale-95 cp-clip-btn group overflow-hidden border-2 border-transparent hover:border-cp-cyan/50";
  
  const variants = {
    primary: "bg-cp-yellow text-cp-black hover:bg-white hover:shadow-[0_0_15px_rgba(0,229,255,0.7)]",
    danger: "bg-cp-red text-white hover:bg-red-600 hover:shadow-[0_0_15px_rgba(255,0,60,0.7)]",
    success: "bg-cp-cyan text-cp-black hover:bg-cyan-300 hover:shadow-[0_0_15px_rgba(0,229,255,0.7)]",
    ghost: "bg-transparent border-cp-gray text-cp-gray hover:text-cp-yellow hover:border-cp-yellow"
  };

  return (
    <button 
      className={cn(baseStyles, variants[variant], className)}
      {...props}
    >
      <div className="relative z-10 flex flex-col items-center leading-none">
        <span className="text-lg">{label}</span>
        {subLabel && <span className="text-[10px] mt-1 opacity-70 font-mono">{subLabel}</span>}
      </div>
      {/* Glitch overlay */}
      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
      <div className="absolute bottom-0 right-0 w-2 h-2 bg-black/20 clip-path-[polygon(100%_0,0_100%,100%_100%)]" />
    </button>
  );
};

export const GlitchText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  return (
    <div className={cn("relative inline-block group", className)}>
      <span className="relative z-10">{text}</span>
      <span className="absolute top-0 left-0 -z-10 w-full h-full text-cp-red opacity-0 group-hover:opacity-100 group-hover:animate-glitch-1 translate-x-[2px]">
        {text}
      </span>
      <span className="absolute top-0 left-0 -z-10 w-full h-full text-cp-cyan opacity-0 group-hover:opacity-100 group-hover:animate-glitch-2 -translate-x-[2px]">
        {text}
      </span>
    </div>
  );
};

export const Panel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn("bg-cp-dark/90 border-l-2 border-cp-yellow p-4 cp-clip-box relative backdrop-blur-sm", className)}>
    {/* Decorative Elements */}
    <div className="absolute top-0 right-0 w-16 h-1 bg-cp-yellow opacity-50" />
    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cp-cyan" />
    <div className="absolute top-2 right-2 flex gap-1">
      <div className="w-1 h-1 bg-cp-red" />
      <div className="w-1 h-1 bg-cp-red" />
      <div className="w-1 h-1 bg-cp-red" />
    </div>
    {children}
  </div>
);
