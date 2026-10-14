import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, Server, Database } from 'lucide-react';
import { REQUIRED_ENV_VARS, isSupabaseConfigured } from '../lib/supabase';
import { MatchmakingState } from '../types/chat';
import { Language, translations } from '../lib/i18n';

interface SafetyAndSetupModalProps {
  mode: 'report' | 'setup' | null;
  onClose: () => void;
  wsConnected: boolean;
  sessionId: string | null;
  matchState: MatchmakingState;
  lang?: Language;
  onConfirmReportAndBlock: (reason: string) => void;
}

export const SafetyAndSetupModal: React.FC<SafetyAndSetupModalProps> = ({
  mode,
  onClose,
  wsConnected,
  sessionId,
  matchState,
  lang = 'ka',
  onConfirmReportAndBlock,
}) => {
  const t = translations[lang] || translations.ka;
  const [selectedReason, setSelectedReason] = useState(t.reasons[0]);

  if (!mode) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#0D1323] border border-white/10 shadow-2xl p-4 sm:p-6 text-white">
        {mode === 'report' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h2 className="text-base font-semibold text-white">
                  {t.reportTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              {t.reportDesc}
            </p>

            <div className="space-y-2 mb-5">
              {t.reasons.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                    selectedReason === reason
                      ? 'bg-rose-500/10 border-rose-500/40 text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-slate-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="accent-rose-500"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirmReportAndBlock(selectedReason);
                  onClose();
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer"
              >
                {t.blockAndReportBtn}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Server className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-semibold text-white">
                  {t.backendTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{t.realtimeServer}</span>
                  <span className="font-medium text-emerald-400">
                    {wsConnected ? t.connectedWs : t.reconnecting}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{t.matchStateLabel}</span>
                  <span className="font-medium text-white">{matchState}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{t.sessionIdLabel}</span>
                  <span className="font-mono text-[11px] text-slate-300">
                    {sessionId ? `${sessionId.slice(0, 8)}...` : t.initializing}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-medium text-white">
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t.supabaseEnv}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isSupabaseConfigured ? t.supabaseActiveDesc : t.supabaseNativeDesc}
                </p>

                <div className="space-y-1.5 pt-1">
                  {REQUIRED_ENV_VARS.map((envVar) => (
                    <div
                      key={envVar.name}
                      className="flex items-start justify-between gap-2 text-[11px] p-2 rounded-lg bg-black/30 border border-white/[0.04]"
                    >
                      <div>
                        <div className="font-mono text-blue-300">{envVar.name}</div>
                        <div className="text-slate-400 mt-0.5">{envVar.description}</div>
                      </div>
                      <span
                        className={`shrink-0 font-medium ${
                          envVar.configured ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {envVar.configured ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          t.optional
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/15 transition-colors cursor-pointer"
              >
                {t.done}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
