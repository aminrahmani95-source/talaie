import React, { useState } from 'react';
import { User } from '../types';
import { UserCheck, KeyRound, Phone, Sparkles, ShieldCheck, Wrench, User as UserIcon, X } from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';

interface Props {
  users: User[];
  currentUserId?: string;
  onSelectUser: (user: User) => void;
  onClose?: () => void;
  isOpen: boolean;
}

export const LoginModal: React.FC<Props> = ({ users, currentUserId, onSelectUser, onClose, isOpen }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedPhone = phone.trim();
    const user = users.find((u) => u.phone === trimmedPhone);

    if (!user) {
      setError('شماره تلفن وارد شده در سامانه تکنسین‌ها یافت نشد.');
      return;
    }

    if (user.password && user.password !== password.trim()) {
      setError('رمز عبور وارد شده نادرست است.');
      return;
    }

    onSelectUser(user);
    if (onClose) onClose();
  };

  const handleQuickSwitch = (u: User) => {
    onSelectUser(u);
    if (onClose) onClose();
  };

  const getRoleIcon = (role: User['role']) => {
    switch (role) {
      case 'QC_MANAGER':
        return <ShieldCheck className="w-4 h-4 text-[#C1A056]" />;
      case 'LEAD_TECHNICIAN':
        return <Wrench className="w-4 h-4 text-[#A88738] dark:text-[#E2C37E]" />;
      default:
        return <UserIcon className="w-4 h-4 text-[#194840] dark:text-[#4ade80]" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl max-w-md w-full shadow-2xl border border-[#E8E4DC] dark:border-[#2D2D2D] overflow-hidden my-6 transition-colors animate-in fade-in zoom-in-95 duration-200">
        {/* Header with talaei.ir luxury palette */}
        <div className="bg-[#212121] dark:bg-[#151515] px-6 py-6 text-white text-center relative border-b-2 border-[#C1A056]">
          {onClose && (
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
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-[#C1A056]/40 flex items-center justify-center p-2 shadow-inner">
              <img
                src="./talaei-lion-gold.png"
                alt="نشان گالری طلایی"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <h2 id="login-modal-title" className="text-lg font-black text-white">
            سامانه عملیات و کیوسی نصب
          </h2>
          <p className="text-xs text-[#C1A056] mt-0.5 font-bold tracking-wide">
            گالری طلایی (TALAEI GALLERY)
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Switch (For Testing / Review) */}
          <div className="bg-[#FAF7F2] dark:bg-[#212121] border border-[#E8E4DC] dark:border-[#2E2E2E] rounded-2xl p-4">
            <div className="flex items-center gap-1.5 text-[#212121] dark:text-[#E8E4DC] font-black text-xs mb-3">
              <Sparkles className="w-4 h-4 text-[#C1A056] fill-[#C1A056]" aria-hidden="true" />
              <span>ورود سریع تستی (یک کلیک بدون پسورد):</span>
            </div>
            <div className="space-y-2">
              {users.map((u) => {
                const isSelected = u.id === currentUserId;
                const isQc = u.role === 'QC_MANAGER';
                const isLead = u.role === 'LEAD_TECHNICIAN';

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickSwitch(u)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-right transition-all min-h-[48px] active:scale-[0.99] ${
                      isSelected
                        ? 'border-[#C1A056] bg-white dark:bg-[#282828] ring-2 ring-[#C1A056]/30 shadow-xs'
                        : 'border-[#E8E4DC] dark:border-[#2E2E2E] bg-white/90 dark:bg-[#262626] hover:bg-white dark:hover:bg-[#2A2A2A] hover:border-[#C1A056]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#383838] flex items-center justify-center shrink-0">
                        {getRoleIcon(u.role)}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-[#212121] dark:text-white leading-tight">
                          {u.name}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {toPersianDigits(u.phone)}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                        isQc
                          ? 'bg-[#212121] text-[#C1A056] border border-[#C1A056]/30 dark:bg-[#151515]'
                          : isLead
                          ? 'bg-[#C1A056]/20 text-[#8B6D20] dark:text-[#E2C37E]'
                          : 'bg-[#194840]/15 text-[#194840] dark:bg-[#194840]/30 dark:text-[#6ee7b7]'
                      }`}
                    >
                      {isQc ? 'مدیر کیوسی' : isLead ? 'سرپرست' : 'تکنسین'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#E8E4DC] dark:border-[#2E2E2E]"></div>
            <span className="flex-shrink mx-3 text-slate-400 dark:text-slate-500 text-xs font-medium">
              یا ورود با شماره و رمز
            </span>
            <div className="flex-grow border-t border-[#E8E4DC] dark:border-[#2E2E2E]"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleManualLogin} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-xs rounded-xl border border-red-200 dark:border-red-800 font-medium"
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-phone" className="block text-xs font-bold text-slate-700 dark:text-[#E8E4DC] mb-1.5">
                شماره موبایل تکنسین:
              </label>
              <div className="relative">
                <input
                  id="login-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  placeholder="0912..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 text-sm rounded-xl border border-[#E8E4DC] dark:border-[#383838] focus:outline-none focus:ring-2 focus:ring-[#C1A056] text-left font-mono bg-[#FAF7F2] dark:bg-[#222222] text-[#212121] dark:text-white"
                  dir="ltr"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" aria-hidden="true" />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-bold text-slate-700 dark:text-[#E8E4DC] mb-1.5">
                رمز عبور:
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="رمز عبور (پیش‌فرض ۱۲۳)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 text-sm rounded-xl border border-[#E8E4DC] dark:border-[#383838] focus:outline-none focus:ring-2 focus:ring-[#C1A056] text-left font-mono bg-[#FAF7F2] dark:bg-[#222222] text-[#212121] dark:text-white"
                  dir="ltr"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" aria-hidden="true" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[48px] py-3 bg-[#212121] hover:bg-[#333333] dark:bg-[#C1A056] dark:hover:bg-[#A88738] text-[#C1A056] dark:text-[#1A1A1A] font-black rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm border border-[#C1A056]/30 active:scale-[0.98]"
            >
              <UserCheck className="w-4 h-4" />
              ورود به سیستم گالری طلایی
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
