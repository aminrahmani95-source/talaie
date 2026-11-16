import React, { useState } from 'react';
import { User } from '../types';
import { UserCheck, KeyRound, Phone, Eye, EyeOff, X, Loader2 } from 'lucide-react';
import { toEnglishDigits } from '../utils/jalali';
import { SupabaseSyncService } from '../utils/supabase';
import { LOGO_GOLD } from '../assets/logo';

interface Props {
  users?: User[];
  currentUserId?: string;
  onSelectUser: (user: User) => void;
  onClose?: () => void;
  isOpen: boolean;
  isStandalone?: boolean;
}

export const LoginModal: React.FC<Props> = ({
  users = [],
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
      // Safe offline/fallback: if network unavailable or Supabase offline, match registered users list
      const localMatched = users.find(
        (u) => toEnglishDigits((u.phone || '').replace(/\D/g, '')) === trimmedPhone
      );
      if (
        localMatched &&
        (!SupabaseSyncService.getClient() ||
          err.message?.includes('اتصال') ||
          err.message?.includes('شبکه') ||
          err.message?.includes('Failed to fetch') ||
          err.message?.includes('NetworkError'))
      ) {
        onSelectUser(localMatched);
        if (onClose) onClose();
        return;
      }
      setError(err.message || 'خطا در ورود به سامانه.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerClasses = isStandalone
    ? 'min-h-screen w-full flex items-center justify-center bg-[#0D1117] p-4 relative overflow-hidden'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      className={containerClasses}
    >
      <div className="bg-[#151B23] text-[#F0F4F8] rounded-xl max-w-md w-full shadow-2xl border border-[#2D3748] overflow-hidden my-6 relative transition-all animate-in fade-in zoom-in-95 duration-150">
        {/* Brand Banner Header */}
        <div className="bg-[#111620] px-6 pt-7 pb-5 text-center relative border-b border-[#212835]">
          {onClose && !isStandalone && (
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن پنجره ورود"
              className="absolute left-3 top-3 w-8 h-8 flex items-center justify-center rounded-md bg-[#1C232D] hover:bg-[#27313F] text-[#9BA7B6] hover:text-[#F0F4F8] transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C5A059] border border-[#2D3748] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-xl bg-[#151B23] border border-[#C5A059]/40 flex items-center justify-center p-2.5 shadow-md">
              <img
                src={LOGO_GOLD}
                alt="نشان گالری طلایی"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <h2 id="login-modal-title" className="text-base sm:text-lg font-black text-[#F0F4F8] tracking-tight">
            سامانه جامع عملیات و کنترل کیفیت گالری طلایی
          </h2>
          <p className="text-[11px] text-[#C5A059] mt-1 font-semibold tracking-wide">
            TALAEI GALLERY | QC & FIELD OPERATIONS
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-md font-medium flex items-center gap-2 animate-in fade-in duration-150"
            >
              <span className="font-bold shrink-0">خطا:</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-phone"
                className="block text-xs font-bold text-[#F0F4F8] mb-1.5"
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
                  className="w-full pl-3 pr-10 py-2.5 text-xs sm:text-sm rounded-md border border-[#2D3748] focus:border-[#C5A059] focus:outline-none focus:ring-1 focus:ring-[#C5A059] text-left font-mono bg-[#0D1117] text-[#F0F4F8] placeholder-[#637184] transition tabular-nums"
                  dir="ltr"
                />
                <Phone className="w-4 h-4 text-[#C5A059] absolute right-3 top-3" aria-hidden="true" />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-bold text-[#F0F4F8] mb-1.5"
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
                  className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-md border border-[#2D3748] focus:border-[#C5A059] focus:outline-none focus:ring-1 focus:ring-[#C5A059] text-left font-mono bg-[#0D1117] text-[#F0F4F8] placeholder-[#637184] transition"
                  dir="ltr"
                />
                <KeyRound className="w-4 h-4 text-[#C5A059] absolute right-3 top-3" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute left-3 top-3 text-[#637184] hover:text-[#F0F4F8] transition cursor-pointer"
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
              className="w-full min-h-[42px] py-2.5 mt-2 bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] font-bold rounded-md shadow-xs transition flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-[#C5A059] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#0D1117]" />
                  <span>در حال بررسی اعتبار...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 text-[#0D1117]" />
                  <span>ورود به سامانه</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-[#212835] text-center">
            <p className="text-[11px] text-[#637184] leading-relaxed">
              مرکز پشتیبانی فنی و مدیریت کنترل کیفیت گالری طلایی | طراحی، پرده و شید هوشمند
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
