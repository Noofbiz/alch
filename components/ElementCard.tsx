import React from 'react';

interface ElementCardProps {
  name: string;
  emoji: string;
  onClick?: () => void;
  className?: string;
  isLoading?: boolean;
}

export const ElementCard: React.FC<ElementCardProps> = ({ 
  name, 
  emoji, 
  onClick, 
  className = "",
  isLoading = false 
}) => {
  return (
    <div 
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg 
        bg-white/10 hover:bg-white/20 border border-white/10 
        backdrop-blur-sm cursor-pointer transition-all select-none
        shadow-sm hover:shadow-md text-white
        ${isLoading ? 'animate-pulse opacity-70' : ''}
        ${className}
      `}
    >
      {isLoading ? (
         <div className="w-6 h-6 rounded-full border-2 border-t-transparent border-white animate-spin" />
      ) : (
        <span className="text-2xl">{emoji}</span>
      )}
      <span className="font-medium text-sm sm:text-base truncate max-w-[120px]">{isLoading ? 'Mixing...' : name}</span>
    </div>
  );
};
