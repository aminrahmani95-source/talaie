import React, { useState } from 'react';
import { User } from '../types';
import { UserCheck, KeyRound, Phone, Eye, EyeOff, X, Loader2 } from 'lucide-react';
import { toEnglishDigits } from '../utils/jalali';
import { SupabaseSyncService } from '../utils/supabase';

interface Props {
  users?: User[];
  currentUserId?: string;
  onSelectUser: (user: User) => void;
  onClose?: () => void;
  isOpen: boolean;
  isStandalone?: boolean;
}

export const LoginModal: React.FC<Props> = ({
  onSelectUser,
  onClose,
  isOpen,
  isStandalone = false,
}) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedPhone = toEnglishDigits(phone.trim().replace(/\s+/g, ''));
    const trimmedPassword = toEnglishDigits(password.trim());

    if (!trimmedPhone || !trimmedPassword) {
      setError('لطفاً شماره موبایل و رمز عبور را وارد کنید.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { user } = await SupabaseSyncService.signIn(trimmedPhone, trimmedPassword);
      onSelectUser(user);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'خطا در ورود به سامانه.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerClasses = isStandalone
    ? 'min-h-screen w-full flex items-center justify-center bg-[#0D0D0D] p-4 relative overflow-hidden'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      className={containerClasses}
    >
      {/* Decorative luxury gold ambient glow */}
      <div className="absolute top-1/4 -right-24 w-96 h-96 bg-[#C1A056]/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -left-24 w-96 h-96 bg-[#C1A056]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="bg-[#181818] text-white rounded-3xl max-w-lg w-full shadow-2xl border border-[#C1A056]/30 overflow-hidden my-6 relative transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Banner Header */}
        <div className="bg-gradient-to-b from-[#212121] to-[#181818] px-6 pt-8 pb-6 text-white text-center relative border-b border-[#C1A056]/20">
          {onClose && !isStandalone && (
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن پنجره ورود"
              className="absolute left-4 top-4 w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1A056]"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 rounded-2xl bg-[#121212] border-2 border-[#C1A056] flex items-center justify-center p-2.5 shadow-lg shadow-black/40">
              <img
                src="./talaei-lion-gold.png"
                alt="نشان گالری طلایی"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <h2 id="login-modal-title" className="text-xl sm:text-2xl font-black text-white tracking-tight">
            سامانه عملیات و QC گالری طلایی
          </h2>
          <p className="text-xs text-[#C1A056] mt-1 font-bold tracking-widest uppercase">
            TALAEI GALLERY | LUXURY CURTAIN & SMART SHADES
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="p-3.5 bg-rose-950/70 border border-rose-500/60 text-rose-200 text-xs rounded-2xl font-medium flex items-center gap-2 animate-in fade-in duration-150"
            >
              <span className="font-bold shrink-0">⚠️ خطا:</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-phone"
                className="block text-xs font-bold text-[#E8E4DC] mb-2"
              >
                شماره موبایل سازمانی:
              </label>
              <div className="relative">
                <input
                  id="login-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  disabled={isSubmitting}
                  placeholder="مثال: 09124339038"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-3 pr-11 py-3.5 text-sm rounded-xl border border-[#383838] focus:border-[#C1A056] focus:outline-none focus:ring-2 focus:ring-[#C1A056]/30 text-left font-mono bg-[#121212] text-white placeholder-zinc-500 transition"
                  dir="ltr"
                />
                <Phone className="w-4 h-4 text-[#C1A056] absolute right-3.5 top-4" aria-hidden="true" />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-bold text-[#E8E4DC] mb-2"
              >
                رمز عبور امن:
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  placeholder="رمز عبور خود را وارد کنید"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3.5 text-sm rounded-xl border border-[#383838] focus:border-[#C1A056] focus:outline-none focus:ring-2 focus:ring-[#C1A056]/30 text-left font-mono bg-[#121212] text-white placeholder-zinc-500 transition"
                  dir="ltr"
                />
                <KeyRound className="w-4 h-4 text-[#C1A056] absolute right-3.5 top-4" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute left-3 top-4 text-zinc-400 hover:text-white transition cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] py-3.5 mt-2 bg-gradient-to-r from-[#C1A056] to-[#A88738] hover:from-[#D4B369] hover:to-[#BFA051] text-[#121212] font-black rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#121212]" />
                  <span>در حال بررسی اعتبار...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 text-[#121212]" />
                  <span>ورود به سامانه</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-[#262626] text-center">
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              مرکز پشتیبانی فنی و مدیریت QC گالری طلایی | طراحی، پرده و شید هوشمند (talaei.ir)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
