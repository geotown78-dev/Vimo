import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  CheckCircle2,
  Server,
  AlertTriangle,
  Lock,
  Camera,
  Radio,
  Wifi,
  HelpCircle,
} from 'lucide-react';
import { MatchmakingState } from '../types/chat';
import { Language, translations } from '../lib/i18n';

interface SafetyAndSetupModalProps {
  mode: 'report' | 'setup' | null;
  onClose: () => void;
  wsConnected: boolean;
  sessionId: string | null;
  matchState: MatchmakingState;
  hasPermissions: boolean;
  isInsecureContext: boolean;
  hasRemoteVideo: boolean;
  hasRemoteAudio: boolean;
  lang?: Language;
  onConfirmReportAndBlock: (reason: string) => void;
}

export const SafetyAndSetupModal: React.FC<SafetyAndSetupModalProps> = ({
  mode,
  onClose,
  wsConnected,
  sessionId,
  matchState,
  hasPermissions,
  isInsecureContext,
  hasRemoteVideo,
  hasRemoteAudio,
  lang = 'ka',
  onConfirmReportAndBlock,
}) => {
  const t = translations[lang] || translations.ka;
  const [selectedReason, setSelectedReason] = useState(t.reasons[0]);
  const [showTurnGuide, setShowTurnGuide] = useState(false);

  if (!mode) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl bg-[#0D1323] border border-white/10 shadow-2xl p-4 sm:p-6 text-white">
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
                  {lang === 'ka' ? 'კავშირისა და კამერის დიაგნოსტიკა' : 'Connection & Camera Diagnostics'}
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

            {/* Insecure HTTP Warning Banner */}
            {isInsecureContext && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>
                    {lang === 'ka'
                      ? 'ყურადღება: საიტი გახსნილია დაუცველ HTTP-ზე!'
                      : 'Warning: Opened over insecure HTTP!'}
                  </span>
                </div>
                <p className="text-[11px] text-rose-200/90 leading-relaxed">
                  {lang === 'ka'
                    ? 'ბრაუზერები (Chrome, Safari, iOS, Android) კატეგორიულად ბლოკავენ კამერას და მიკროფონს HTTP-ზე. იმისთვის რომ კამერა ჩაირთოს, საიტი აუცილებლად უნდა იყოს HTTPS-ზე.'
                    : 'Modern browsers block camera and microphone access on insecure HTTP. Please use HTTPS to enable video calls.'}
                </p>
              </div>
            )}

            {/* Live System Diagnostics Grid */}
            <div className="space-y-3 mb-5">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-2.5">
                <div className="text-xs font-medium text-slate-200 pb-1 border-b border-white/[0.06]">
                  {lang === 'ka' ? 'მოწყობილობისა და კავშირის სტატუსი' : 'System & Connection Status'}
                </div>

                {/* HTTPS check */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    HTTPS / SSL
                  </span>
                  <span
                    className={`font-semibold flex items-center gap-1 text-[11px] ${
                      !isInsecureContext ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {!isInsecureContext ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {lang === 'ka' ? 'დაცულია (HTTPS)' : 'Secure (HTTPS)'}
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {lang === 'ka' ? 'დაუცველია (HTTP)' : 'Insecure (HTTP)'}
                      </>
                    )}
                  </span>
                </div>

                {/* Camera Permission check */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-slate-500" />
                    {lang === 'ka' ? 'თქვენი კამერა' : 'Your Camera'}
                  </span>
                  <span
                    className={`font-semibold flex items-center gap-1 text-[11px] ${
                      hasPermissions ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {hasPermissions ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {lang === 'ka' ? 'აქტიურია' : 'Active'}
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {lang === 'ka' ? 'არ არის ნებართვა' : 'No Permission'}
                      </>
                    )}
                  </span>
                </div>

                {/* WebSocket Signaling */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-slate-500" />
                    {t.realtimeServer}
                  </span>
                  <span
                    className={`font-semibold text-[11px] flex items-center gap-1 ${
                      wsConnected ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {wsConnected ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t.connectedWs}
                      </>
                    ) : (
                      t.reconnecting
                    )}
                  </span>
                </div>

                {/* Matchmaking State */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{t.matchStateLabel}</span>
                  <span className="font-medium text-white text-[11px] bg-white/5 px-2 py-0.5 rounded">
                    {matchState}
                  </span>
                </div>

                {/* Stranger Video Received */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-slate-500" />
                    {lang === 'ka' ? 'უცნობის ვიდეო ნაკადი' : 'Stranger Video Stream'}
                  </span>
                  <span
                    className={`font-semibold text-[11px] ${
                      hasRemoteVideo
                        ? 'text-emerald-400'
                        : hasRemoteAudio
                        ? 'text-blue-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {hasRemoteVideo
                      ? lang === 'ka'
                        ? 'ვიდეო მიღებულია'
                        : 'Video Received'
                      : hasRemoteAudio
                      ? lang === 'ka'
                        ? 'მხოლოდ აუდიო'
                        : 'Audio Only'
                      : lang === 'ka'
                      ? 'მოლოდინი...'
                      : 'Waiting...'}
                  </span>
                </div>

                {/* Session ID */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.04]">
                  <span className="text-slate-400">{t.sessionIdLabel}</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {sessionId ? `${sessionId.slice(0, 10)}...` : t.initializing}
                  </span>
                </div>
              </div>

              {/* Coolify & WebRTC Guidance Box */}
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold text-blue-300">
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-blue-400 shrink-0" />
                    {lang === 'ka' ? 'რატომ არ ჩანს უცნობის კამერა?' : 'Why is stranger video not showing?'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTurnGuide((prev) => !prev)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 underline cursor-pointer"
                  >
                    {showTurnGuide
                      ? lang === 'ka'
                        ? 'დახურვა'
                        : 'Close'
                      : lang === 'ka'
                      ? 'როგორ გავასწოროთ?'
                      : 'How to fix?'}
                  </button>
                </div>

                <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                  <li>
                    <strong>HTTPS:</strong>{' '}
                    {lang === 'ka'
                      ? 'საიტი აუცილებლად უნდა იყოს HTTPS-ზე (Coolify-ში მიაბით დომენი SSL-ით).'
                      : 'Website must be on HTTPS (attach domain with SSL in Coolify).'}
                  </li>
                  <li>
                    <strong>TURN Relay სერვერი:</strong>{' '}
                    {lang === 'ka'
                      ? 'თუ ერთი მოწყობილობა მობილურ 4G-ზეა, ხოლო მეორე Wi-Fi-ზე, WebRTC-ს სჭირდება TURN სერვერი.'
                      : 'When devices are on different networks (4G vs Wi-Fi), a TURN server is required.'}
                  </li>
                </ul>

                {showTurnGuide && (
                  <div className="mt-2 pt-2 border-t border-blue-400/20 text-[11px] text-slate-300 space-y-3">
                    {/* Option 1: Own VPS Coturn */}
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                      <p className="font-semibold text-emerald-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        {lang === 'ka' ? 'ვარიანტი 1: საკუთარ VPS-ზე Coturn-ის დაყენება (რეკომენდებული)' : 'Option 1: Install Coturn on your VPS (Recommended)'}
                      </p>
                      <p className="text-[10px] text-slate-300">
                        {lang === 'ka' 
                          ? 'შენს VPS ტერმინალში გაუშვით ეს ბრძანებები (Ubuntu/Debian):' 
                          : 'Run these commands in your VPS SSH terminal:'}
                      </p>
                      <pre className="p-2 rounded bg-black/50 font-mono text-[10px] text-emerald-200 overflow-x-auto select-all leading-relaxed whitespace-pre-wrap">
                        sudo apt update && sudo apt install -y coturn{'\n'}
                        sudo turnadmin -a -u chatuser -r myrealm -p ჩემიპაროლი123{'\n'}
                        sudo ufw allow 3478/tcp && sudo ufw allow 3478/udp{'\n'}
                        sudo ufw allow 49152:65535/udp
                      </pre>
                      <p className="text-[10px] text-slate-300">
                        {lang === 'ka'
                          ? 'შემდეგ Coolify-ში Environment Variables-ში ჩაწერეთ:'
                          : 'Then add to Coolify Environment Variables:'}
                      </p>
                      <pre className="p-2 rounded bg-black/50 font-mono text-[10px] text-emerald-200 overflow-x-auto select-all">
                        TURN_URL=turn:შენი_VPS_IP:3478?transport=udp,turn:შენი_VPS_IP:3478?transport=tcp{'\n'}
                        TURN_USERNAME=chatuser{'\n'}
                        TURN_CREDENTIAL=ჩემიპაროლი123
                      </pre>
                    </div>

                    {/* Option 2: Metered Cloud */}
                    <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/10 space-y-1.5">
                      <p className="font-semibold text-white">
                        {lang === 'ka' ? 'ვარიანტი 2: უფასო Metered.ca ქლაუდი (50GB უფასოდ)' : 'Option 2: Free Metered.ca Cloud'}
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-[10px] text-slate-300">
                        <li>{lang === 'ka' ? 'დარეგისტრირდით metered.ca-ზე.' : 'Sign up at metered.ca'}</li>
                        <li>{lang === 'ka' ? 'დააკოპირეთ Turn Credentials და ჩაწერეთ Coolify-ში (TURN_URL, TURN_USERNAME, TURN_CREDENTIAL).' : 'Copy Turn Credentials to Coolify variables.'}</li>
                      </ol>
                    </div>
                  </div>
                )}
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
