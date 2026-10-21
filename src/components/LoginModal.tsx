import React, { useState } from 'react';
import { User } from '../types';
import { UserCheck, KeyRound, Phone, ShieldCheck, Eye, EyeOff, Lock, X } from 'lucide-react';

interface Props {
  users: User[];
  currentUserId?: string;
  onSelectUser: (user: User) => void;
  onClose?: () => void;
  isOpen: boolean;
  isStandalone?: boolean;
}

export const LoginModal: React.FC<Props> = ({
  users,
  onSelectUser,
  onClose,
  isOpen,
  isStandalone = false,
}) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedPhone = phone.trim().replace(/\s+/g, '');
    const trimmedPassword = password.trim();

    if (!trimmedPhone || !trimmedPassword) {
      setError('لطفاً شماره موبایل و رمز عبور را وارد کنید.');
      return;
    }

    // Match phone number
    const user = users.find(
      (u) => u.phone.replace(/\s+/g, '') === trimmedPhone || u.phone === trimmedPhone
    );

    if (!user) {
      setError('شماره موبایل وارد شده در فهرست کاربران مجاز گالری طلایی یافت نشد.');
      return;
    }

    if (user.password && user.password !== trimmedPassword) {
      setError('رمز عبور وارد شده نادرست است.');
      return;
    }

    if (user.active === false) {
      setError('حساب کاربری شما غیرفعال شده است. با مدیر QC تماس بگیرید.');
      return;
    }

    onSelectUser(user);
    if (onClose) onClose();
  };

  const containerClasses = isStandalone
    ? 'min-h-screen w-full flex items-center justify-center bg-[#151515] p-4 relative overflow-hidden'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      className={containerClasses}
    >
      {/* Decorative luxury background glow */}
      {isStandalone && (
        <>
          <div className="absolute top-1/4 -right-20 w-96 h-96 bg-[#C1A056]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-[#C1A056]/5 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      <div className="bg-[#1F1F1F] text-white rounded-3xl max-w-md w-full shadow-2xl border border-[#C1A056]/30 overflow-hidden my-6 relative transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header with talaei.ir luxury palette */}
        <div className="bg-[#181818] px-6 py-8 text-white text-center relative border-b border-[#C1A056]/30">
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

          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-3xl bg-black/40 border border-[#C1A056]/50 flex items-center justify-center p-3 shadow-inner">
              <img
                src="./talaei-lion-gold.png"
                alt="نشان گالری طلایی"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <h2 id="login-modal-title" className="text-xl font-black text-white tracking-tight">
            سامانه فنی، عملیات و QC
          </h2>
          <p className="text-xs text-[#C1A056] mt-1.5 font-bold tracking-widest uppercase">
            گالری طلایی | TALAEI GALLERY
          </p>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#A1A1AA]">
            <Lock className="w-3.5 h-3.5 text-[#C1A056]" />
            <span>ورود امن پرسنل و تکنسین‌های مجاز</span>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="p-3.5 bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs rounded-xl font-medium flex items-start gap-2 animate-in fade-in duration-150"
            >
              <span className="font-bold shrink-0">خطا:</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-phone"
                className="block text-xs font-bold text-[#E8E4DC] mb-2"
              >
                شماره موبایل کاربری:
              </label>
              <div className="relative">
                <input
                  id="login-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  placeholder="09......"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-3 pr-11 py-3 text-sm rounded-xl border border-[#383838] focus:border-[#C1A056] focus:outline-none focus:ring-2 focus:ring-[#C1A056]/30 text-left font-mono bg-[#141414] text-white placeholder-zinc-500 transition"
                  dir="ltr"
                />
                <Phone className="w-4 h-4 text-zinc-400 absolute right-3.5 top-3.5" aria-hidden="true" />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-bold text-[#E8E4DC] mb-2"
              >
                رمز عبور:
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="رمز عبور خود را وارد کنید"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 text-sm rounded-xl border border-[#383838] focus:border-[#C1A056] focus:outline-none focus:ring-2 focus:ring-[#C1A056]/30 text-left font-mono bg-[#141414] text-white placeholder-zinc-500 transition"
                  dir="ltr"
                />
                <KeyRound className="w-4 h-4 text-zinc-400 absolute right-3.5 top-3.5" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute left-3 top-3.5 text-zinc-400 hover:text-white transition"
                  tabIndex={-1}
                  aria-label={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[48px] py-3.5 mt-2 bg-gradient-to-r from-[#C1A056] to-[#A88738] hover:from-[#D4B369] hover:to-[#BFA051] text-[#121212] font-black rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm border border-[#C1A056]/40 active:scale-[0.98] cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-[#121212]" />
              <span>ورود به سامانه</span>
            </button>
          </form>

          <div className="pt-2 border-t border-[#2D2D2D] text-center">
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              جهت دریافت شماره و رمز عبور اختصاصی یا تغییر دسترسی، با مدیریت QC گالری طلایی تماس بگیرید.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
