import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  Sparkles,
  Copy,
  Check,
  FileCode,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Language, translations } from '../lib/i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  lang: Language;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
  lang,
}) => {
  const t = translations[lang];
  const { signIn, signUp, isConfigured, updateKeys } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Supabase manual config section (if needed)
  const [showDbSettings, setShowDbSettings] = useState(!isConfigured);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [dbSuccess, setDbSuccess] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isConfigured) {
      setErrorMessage(
        lang === 'ka'
          ? 'გთხოვთ ჯერ მიუთითოთ Supabase Project URL და Anon Key ქვემოთ.'
          : 'Please provide Supabase Project URL and Anon Key below first.'
      );
      setShowDbSettings(true);
      return;
    }

    if (!email.trim() || !password) {
      setErrorMessage(lang === 'ka' ? 'შეავსეთ ყველა ველი' : 'Please fill in all fields');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setErrorMessage(t.passwordMinLength);
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage(t.passwordsDoNotMatch);
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) {
          // Translate common Supabase error messages
          if (error.includes('Invalid login credentials')) {
            setErrorMessage(
              lang === 'ka'
                ? 'არასწორი ელ-ფოსტა ან პაროლი'
                : 'Invalid login credentials'
            );
          } else {
            setErrorMessage(error);
          }
        } else {
          setSuccessMessage(t.authSuccessSignIn);
          setTimeout(() => {
            onClose();
          }, 1000);
        }
      } else {
        const { error } = await signUp(email, password, displayName || email.split('@')[0]);
        if (error) {
          if (error.includes('User already registered')) {
            setErrorMessage(
              lang === 'ka'
                ? 'მომხმარებელი ამ ელ-ფოსტით უკვე რეგისტრირებულია'
                : 'User already registered'
            );
          } else {
            setErrorMessage(error);
          }
        } else {
          setSuccessMessage(t.authSuccessSignUp);
          setTimeout(() => {
            onClose();
          }, 1800);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDbSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseKey.trim()) return;
    const ok = updateKeys(supabaseUrl.trim(), supabaseKey.trim());
    if (ok) {
      setDbSuccess(true);
      setErrorMessage(null);
      setTimeout(() => setDbSuccess(false), 2500);
    } else {
      setErrorMessage(
        lang === 'ka' ? 'შეამოწმეთ შეყვანილი მისამართის სისწორე' : 'Invalid Supabase URL or Key'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col gap-4 text-white overflow-hidden">
        {/* Glow ambient background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 w-60 h-60 bg-blue-600/15 rounded-full blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-24 w-60 h-60 bg-indigo-600/15 rounded-full blur-3xl"
        />

        {/* Modal Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-slate-800/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {mode === 'signin' ? t.signIn : t.signUp}
              </h2>
              <p className="text-[11px] text-slate-400">Yumi.ge • Supabase Auth</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs: Sign In / Sign Up */}
        <div className="relative z-10 flex p-1 rounded-xl bg-slate-950/80 border border-slate-800/80 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.signIn}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.signUp}
          </button>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="relative z-10 flex items-start gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="relative z-10 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="relative z-10 space-y-3">
          {mode === 'signup' && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                {t.displayName}
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="გიორგი / George"
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-blue-400" />
              {t.email}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-400" />
              {t.password}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
                {t.confirmPassword}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{mode === 'signin' ? t.signIn : t.signUp}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Footer switch prompt */}
        <div className="relative z-10 pt-2 border-t border-slate-800 text-center text-xs text-slate-400">
          {mode === 'signin' ? (
            <span>
              {t.dontHaveAccount}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMessage(null);
                }}
                className="text-blue-400 font-semibold hover:underline cursor-pointer ml-1"
              >
                {t.signUp}
              </button>
            </span>
          ) : (
            <span>
              {t.alreadyHaveAccount}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMessage(null);
                }}
                className="text-blue-400 font-semibold hover:underline cursor-pointer ml-1"
              >
                {t.signIn}
              </button>
            </span>
          )}
        </div>

        {/* Optional Supabase Credential Input Accordion */}
        <div className="relative z-10 border-t border-slate-800/80 pt-2">
          <button
            type="button"
            onClick={() => setShowDbSettings(!showDbSettings)}
            className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-1"
          >
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              {t.supabaseSettings}
            </span>
            <span className="text-[10px] text-slate-500">
              {isConfigured ? '✓ Connected' : '! Not configured'}
            </span>
          </button>

          {showDbSettings && (
            <form onSubmit={handleSaveDbSettings} className="mt-2 space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <div className="space-y-0.5">
                <label className="text-[10px] font-mono text-slate-400">{t.supabaseUrlLabel}</label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyz.supabase.co"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-[10px] font-mono text-slate-400">{t.supabaseKeyLabel}</label>
                <input
                  type="password"
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                {dbSuccess && (
                  <span className="text-[11px] text-emerald-400 font-medium">✓ დამახსოვრდა!</span>
                )}
                <button
                  type="submit"
                  className="ml-auto px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  {t.saveCredentials}
                </button>
              </div>

              {/* Copy SQL Schema Helper */}
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                  <FileCode className="w-3 h-3 text-blue-400" />
                  public.profiles (SQL სქემა)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const sql = `-- Yumi.ge profiles schema
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  role text default 'user',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);`;
                    navigator.clipboard.writeText(sql);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      დაკოპირდა!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      SQL-ის კოპირება
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
