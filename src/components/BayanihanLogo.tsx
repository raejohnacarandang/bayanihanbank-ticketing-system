import React, { useState } from 'react';

interface BayanihanLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  subtitleText?: string;
  className?: string;
  lightBackground?: boolean;
  logoUrl?: string;
}

export const BayanihanLogo: React.FC<BayanihanLogoProps> = ({
  size = 'md',
  showSubtitle = false,
  subtitleText = 'IT Service Desk',
  className = '',
  lightBackground = false,
  logoUrl = '/bayanihan-logo.png',
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  const badgeSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
    xl: 'w-16 h-16 text-2xl',
  }[size];

  const titleSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-2xl sm:text-3xl',
  }[size];

  const bankTextSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
    xl: 'text-xl sm:text-2xl',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Official Bayanihan Bank Stylized Logo Mark */}
      <div
        className={`${badgeSizes} rounded-xl bg-gradient-to-b from-emerald-900 via-emerald-950 to-slate-950 border border-emerald-600/40 shadow-md flex items-center justify-center shrink-0 relative overflow-hidden`}
      >
        {imageFailed ? (
          <>
        {/* Silhouette B Logo representation */}
        <svg
          viewBox="0 0 100 100"
          className="w-3/4 h-3/4"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Top B shape (White silhouette with salakot hat person) */}
          <path
            d="M20 15 H55 C70 15, 80 25, 80 38 C80 50, 70 55, 55 55 H20 Z"
            fill="#FFFFFF"
          />
          {/* Bottom B shape (Gold/Amber) */}
          <path
            d="M20 50 H58 C74 50, 85 60, 85 75 C85 88, 72 90, 55 90 H20 Z"
            fill="#F59E0B"
          />
          {/* Inner cutout detailing person with hat */}
          <circle cx="50" cy="30" r="7" fill="#043E30" />
          <path
            d="M36 28 Q50 20 64 28 L50 32 Z"
            fill="#043E30"
          />
          {/* Carrying beam bar */}
          <path
            d="M18 50 H88 V56 H18 Z"
            fill="#043E30"
          />
        </svg>
          </>
        ) : (
          <img
            src={logoUrl}
            alt="Bayanihan Bank"
            className="w-full h-full object-contain p-1"
            onError={() => setImageFailed(true)}
          />
        )}
      </div>

      {/* Brand Text */}
      <div className="flex flex-col justify-center">
        <div className="flex items-baseline gap-1.5 leading-none">
          <span
            className={`font-black tracking-tight ${titleSizes} ${
              lightBackground ? 'text-emerald-950' : 'text-white'
            }`}
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            BAYANIHAN
          </span>
          <span
            className={`font-black tracking-wider ${bankTextSizes} text-amber-500`}
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            BANK
          </span>
        </div>

        {showSubtitle && (
          <span
            className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${
              lightBackground ? 'text-emerald-700' : 'text-emerald-300'
            }`}
          >
            {subtitleText}
          </span>
        )}
      </div>
    </div>
  );
};
