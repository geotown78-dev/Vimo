import React, { useEffect, useRef, useState } from 'react';
import { Language } from '../lib/i18n';
import { ChevronDown, Check } from 'lucide-react';

interface LanguageSelectorProps {
  currentLang: Language;
  onSelectLang: (lang: Language) => void;
}

export const GeorgiaFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 300 200" className={`${className} rounded-xs shadow-xs shrink-0`} aria-hidden="true">
    <rect width="300" height="200" fill="#ffffff" />
    {/* Large Central Red Cross */}
    <rect x="130" width="40" height="200" fill="#ff0000" />
    <rect y="80" width="300" height="40" fill="#ff0000" />
    {/* 4 Small Red Bolnisi Crosses */}
    {/* Top-Left */}
    <g transform="translate(65, 40)">
      <path
        d="M-4,-14 C-2,-7 -2,-7 0,-7 C2,-7 2,-7 4,-14 C7,-14 7,-14 7,-12 C7,-10 7,-10 2,-8 C4,-6 4,-6 11,-8 C11,-6 11,-5 10,-5 C8,-5 8,-5 2,-4 C7,-2 7,-2 14,-4 C14,-2 13,-1 13,-1 C11,-1 11,-1 4,0 C11,1 11,1 13,1 C13,1 14,2 14,4 C7,2 7,2 2,4 C8,5 8,5 10,5 C11,5 11,6 11,8 C4,6 4,6 2,8 C7,10 7,10 7,12 C7,14 7,14 4,14 C2,7 2,7 0,7 C-2,7 -2,7 -4,14 C-7,14 -7,14 -7,12 C-7,10 -7,10 -2,8 C-4,6 -4,6 -11,8 C-11,6 -11,5 -10,5 C-8,5 -8,5 -2,4 C-7,2 -7,2 -14,4 C-14,2 -13,1 -13,1 C-11,1 -11,1 -4,0 C-11,-1 -11,-1 -13,-1 C-13,-1 -14,-2 -14,-4 C-7,-2 -7,-2 -2,-4 C-8,-5 -8,-5 -10,-5 C-11,-5 -11,-6 -11,-8 C-4,-6 -4,-6 -2,-8 C-7,-10 -7,-10 -7,-12 C-7,-14 -7,-14 -4,-14 Z"
        fill="#ff0000"
      />
    </g>
    {/* Top-Right */}
    <g transform="translate(235, 40)">
      <path
        d="M-4,-14 C-2,-7 -2,-7 0,-7 C2,-7 2,-7 4,-14 C7,-14 7,-14 7,-12 C7,-10 7,-10 2,-8 C4,-6 4,-6 11,-8 C11,-6 11,-5 10,-5 C8,-5 8,-5 2,-4 C7,-2 7,-2 14,-4 C14,-2 13,-1 13,-1 C11,-1 11,-1 4,0 C11,1 11,1 13,1 C13,1 14,2 14,4 C7,2 7,2 2,4 C8,5 8,5 10,5 C11,5 11,6 11,8 C4,6 4,6 2,8 C7,10 7,10 7,12 C7,14 7,14 4,14 C2,7 2,7 0,7 C-2,7 -2,7 -4,14 C-7,14 -7,14 -7,12 C-7,10 -7,10 -2,8 C-4,6 -4,6 -11,8 C-11,6 -11,5 -10,5 C-8,5 -8,5 -2,4 C-7,2 -7,2 -14,4 C-14,2 -13,1 -13,1 C-11,1 -11,1 -4,0 C-11,-1 -11,-1 -13,-1 C-13,-1 -14,-2 -14,-4 C-7,-2 -7,-2 -2,-4 C-8,-5 -8,-5 -10,-5 C-11,-5 -11,-6 -11,-8 C-4,-6 -4,-6 -2,-8 C-7,-10 -7,-10 -7,-12 C-7,-14 -7,-14 -4,-14 Z"
        fill="#ff0000"
      />
    </g>
    {/* Bottom-Left */}
    <g transform="translate(65, 160)">
      <path
        d="M-4,-14 C-2,-7 -2,-7 0,-7 C2,-7 2,-7 4,-14 C7,-14 7,-14 7,-12 C7,-10 7,-10 2,-8 C4,-6 4,-6 11,-8 C11,-6 11,-5 10,-5 C8,-5 8,-5 2,-4 C7,-2 7,-2 14,-4 C14,-2 13,-1 13,-1 C11,-1 11,-1 4,0 C11,1 11,1 13,1 C13,1 14,2 14,4 C7,2 7,2 2,4 C8,5 8,5 10,5 C11,5 11,6 11,8 C4,6 4,6 2,8 C7,10 7,10 7,12 C7,14 7,14 4,14 C2,7 2,7 0,7 C-2,7 -2,7 -4,14 C-7,14 -7,14 -7,12 C-7,10 -7,10 -2,8 C-4,6 -4,6 -11,8 C-11,6 -11,5 -10,5 C-8,5 -8,5 -2,4 C-7,2 -7,2 -14,4 C-14,2 -13,1 -13,1 C-11,1 -11,1 -4,0 C-11,-1 -11,-1 -13,-1 C-13,-1 -14,-2 -14,-4 C-7,-2 -7,-2 -2,-4 C-8,-5 -8,-5 -10,-5 C-11,-5 -11,-6 -11,-8 C-4,-6 -4,-6 -2,-8 C-7,-10 -7,-10 -7,-12 C-7,-14 -7,-14 -4,-14 Z"
        fill="#ff0000"
      />
    </g>
    {/* Bottom-Right */}
    <g transform="translate(235, 160)">
      <path
        d="M-4,-14 C-2,-7 -2,-7 0,-7 C2,-7 2,-7 4,-14 C7,-14 7,-14 7,-12 C7,-10 7,-10 2,-8 C4,-6 4,-6 11,-8 C11,-6 11,-5 10,-5 C8,-5 8,-5 2,-4 C7,-2 7,-2 14,-4 C14,-2 13,-1 13,-1 C11,-1 11,-1 4,0 C11,1 11,1 13,1 C13,1 14,2 14,4 C7,2 7,2 2,4 C8,5 8,5 10,5 C11,5 11,6 11,8 C4,6 4,6 2,8 C7,10 7,10 7,12 C7,14 7,14 4,14 C2,7 2,7 0,7 C-2,7 -2,7 -4,14 C-7,14 -7,14 -7,12 C-7,10 -7,10 -2,8 C-4,6 -4,6 -11,8 C-11,6 -11,5 -10,5 C-8,5 -8,5 -2,4 C-7,2 -7,2 -14,4 C-14,2 -13,1 -13,1 C-11,1 -11,1 -4,0 C-11,-1 -11,-1 -13,-1 C-13,-1 -14,-2 -14,-4 C-7,-2 -7,-2 -2,-4 C-8,-5 -8,-5 -10,-5 C-11,-5 -11,-6 -11,-8 C-4,-6 -4,-6 -2,-8 C-7,-10 -7,-10 -7,-12 C-7,-14 -7,-14 -4,-14 Z"
        fill="#ff0000"
      />
    </g>
  </svg>
);

export const UKFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 60 30" className={`${className} rounded-xs shadow-xs shrink-0`} aria-hidden="true">
    <clipPath id="uk-s">
      <path d="M0,0 v30 h60 v-30 z" />
    </clipPath>
    <clipPath id="uk-t">
      <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
    </clipPath>
    <g clipPath="url(#uk-s)">
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-t)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </g>
  </svg>
);

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLang,
  onSelectLang,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languages: { code: Language; name: string; nativeName: string; flag: React.ReactNode }[] = [
    {
      code: 'ka',
      name: 'Georgian',
      nativeName: 'ქართული',
      flag: <GeorgiaFlag className="w-5 h-3.5" />,
    },
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      flag: <UKFlag className="w-5 h-3.5" />,
    },
  ];

  const activeLang = languages.find((l) => l.code === currentLang) || languages[0];

  return (
    <div ref={containerRef} className="relative z-50">
      {/* Selector Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Language selection"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0D1424]/80 hover:bg-[#141E34]/95 backdrop-blur-md border border-white/[0.12] text-xs font-medium text-white shadow-lg transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
      >
        {activeLang.flag}
        <span className="text-[12px] font-medium tracking-tight text-white/95">
          {activeLang.nativeName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-white/60 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Options */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-40 rounded-2xl bg-[#0D1424]/95 backdrop-blur-xl border border-white/[0.12] shadow-2xl py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {languages.map((lang) => {
            const isSelected = lang.code === currentLang;
            return (
              <button
                key={lang.code}
                role="option"
                aria-selected={isSelected}
                type="button"
                onClick={() => {
                  onSelectLang(lang.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-xs transition-colors cursor-pointer text-left ${
                  isSelected
                    ? 'bg-blue-600/20 text-white font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {lang.flag}
                  <span className="text-[12.5px]">{lang.nativeName}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
