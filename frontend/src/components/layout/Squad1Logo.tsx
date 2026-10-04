import React from 'react';
import shieldImg from '../../assets/squad1-shield.png';
import textImg from '../../assets/squad1-text.png';

interface Squad1LogoProps {
  collapsed?: boolean;
  className?: string;
}

export const Squad1Logo: React.FC<Squad1LogoProps> = ({ collapsed = false, className = '' }) => {
  return (
    <div
      className={`flex items-center select-none transition-all duration-300 ${
        collapsed ? 'justify-center w-full' : 'justify-start w-full'
      } ${className}`}
    >
      {/* Shield Emblem (The Logo) - No box, properly sized to fill space */}
      <img
        src={shieldImg}
        alt="Squad1 Shield Logo"
        className="h-11 w-auto object-contain shrink-0 transition-transform duration-200 hover:scale-105 drop-shadow-xs"
      />

      {/* Brand Text (SQUAD1 TALA KUNCHI) - No box, properly sized to fill space */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out flex items-center ${
          collapsed
            ? 'max-w-0 opacity-0 ml-0 pointer-events-none'
            : 'max-w-[220px] opacity-100 ml-3.5'
        }`}
      >
        <img
          src={textImg}
          alt="SQUAD1 Tala Kunchi"
          className="h-11 w-auto object-contain shrink-0"
        />
      </div>
    </div>
  );
};


