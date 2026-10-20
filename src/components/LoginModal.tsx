import React, { useState } from 'react';
import { User } from '../types';
import { UserCheck, KeyRound, Phone, Sparkles } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#E8E4DC] overflow-hidden my-6">
        {/* Header with talaei.ir luxury palette */}
        <div className="bg-[#212121] px-6 py-6 text-white text-center relative border-b-2 border-[#C1A056]">
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-[#C1A056]/30 flex items-center justify-center p-2 shadow-inner">
              <img
                src="./talaei-lion-gold.png"
                alt="نشان گالری طلایی"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <h2 className="text-lg font-black text-white">سامانه عملیات و کیوسی نصب</h2>
          <p className="text-xs text-[#C1A056] mt-0.5 font-bold">
            گالری طلایی (TALAEI GALLERY)
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Switch (For Testing / Review) */}
          <div className="bg-[#FAF7F2] border border-[#E8E4DC] rounded-2xl p-4">
            <div className="flex items-center gap-1.5 text-[#212121] font-bold text-xs mb-2.5">
              <Sparkles className="w-4 h-4 text-[#C1A056] fill-[#C1A056]" />
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
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-right transition ${
                      isSelected
                        ? 'border-[#C1A056] bg-white ring-2 ring-[#C1A056]/30 shadow-xs'
                        : 'border-[#E8E4DC] bg-white/80 hover:bg-white hover:border-[#C1A056]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{u.avatar || '👤'}</span>
                      <div>
                        <div className="font-bold text-xs text-[#212121]">{u.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">موبایل: {u.phone}</div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        isQc
                          ? 'bg-[#212121] text-[#C1A056]'
                          : isLead
                          ? 'bg-[#C1A056]/20 text-[#A88738]'
                          : 'bg-[#194840]/15 text-[#194840]'
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
            <div className="flex-grow border-t border-[#E8E4DC]"></div>
            <span className="flex-shrink mx-3 text-slate-400 text-xs">یا ورود با شماره و رمز</span>
            <div className="flex-grow border-t border-[#E8E4DC]"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleManualLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                شماره موبایل:
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  placeholder="0912..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 text-sm rounded-xl border border-[#E8E4DC] focus:outline-none focus:ring-2 focus:ring-[#C1A056] text-left font-mono bg-[#FAF7F2]"
                  dir="ltr"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رمز عبور:
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="رمز عبور (پیش‌فرض ۱۲۳)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 text-sm rounded-xl border border-[#E8E4DC] focus:outline-none focus:ring-2 focus:ring-[#C1A056] text-left font-mono bg-[#FAF7F2]"
                  dir="ltr"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#212121] hover:bg-[#333333] text-[#C1A056] font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm border border-[#C1A056]/30"
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
