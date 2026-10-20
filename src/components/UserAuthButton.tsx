import React, { useState, useRef, useEffect } from 'react';
import { User, LogIn, LogOut, Sparkles, ChevronDown, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Language, translations } from '../lib/i18n';
import { AuthModal } from './AuthModal';

interface UserAuthButtonProps {
  lang: Language;
}

export const UserAuthButton: React.FC<UserAuthButtonProps> = ({ lang }) => {
  const t = translations[lang];
  const { user, profile, signOut, loading } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'signin' | 'signup'>('signin');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openAuth = (mode: 'signin' | 'signup') => {
    setModalMode(mode);
    setIsModalOpen(true);
    setIsDropdownOpen(false);
  };

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-xl bg-slate-800/60 animate-pulse border border-slate-700/60" />
    );
  }

  // Logged In State: User Avatar & Dropdown Menu
  if (user && profile) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-white transition-all cursor-pointer shadow-sm"
        >
          {/* Avatar Disc */}
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-[11px] font-bold text-white shadow-sm">
            {profile.initials}
          </div>
          <span className="hidden sm:inline-block text-xs font-semibold text-slate-200 max-w-[100px] truncate">
            {profile.displayName}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="px-3 py-2 border-b border-slate-800/80">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-400">
                <ShieldCheck className="w-3 h-3 text-blue-400" />
                <span>{t.memberBadge}</span>
              </div>
              <div className="font-bold text-slate-200 truncate mt-0.5">
                {profile.displayName}
              </div>
              <div className="text-[11px] text-slate-400 truncate">{profile.email}</div>
            </div>

            <div className="py-1">
              <button
                type="button"
                onClick={async () => {
                  setIsDropdownOpen(false);
                  await signOut();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 transition-colors cursor-pointer text-left font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.signOut}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Logged Out State: Sign In and Sign Up buttons
  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => openAuth('signin')}
          className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          {t.signIn}
        </button>

        <button
          type="button"
          onClick={() => openAuth('signup')}
          className="inline-flex items-center gap-1.5 px-3 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>{t.signUp}</span>
        </button>
      </div>

      <AuthModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialMode={modalMode}
        lang={lang}
      />
    </>
  );
};
