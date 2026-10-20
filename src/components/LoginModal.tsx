import React, { useState } from 'react';
import { User } from '../types';
import { ShieldCheck, UserCheck, KeyRound, Phone, Sparkles } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-6 py-6 text-white text-center relative">
          <div className="w-14 h-14 bg-white/20 rounded-2xl backdrop-blur-md flex items-center justify-center mx-auto mb-3 text-2xl shadow-inner">
            📐
          </div>
          <h2 className="text-xl font-black">ورود به سامانه عملیات و کیوسی نصب</h2>
          <p className="text-xs text-blue-100 mt-1">
            مجموعه تخصصی شید و پرده طلائیه
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Switch (For Testing / Review) */}
          <div className="bg-blue-50/80 border border-blue-200/60 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs mb-2.5">
              <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />
              ورود سریع تستی (یک کلیک بدون پسورد):
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
                        ? 'border-blue-600 bg-white ring-2 ring-blue-500/20 shadow-sm'
                        : 'border-slate-200 bg-white/80 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{u.avatar || '👤'}</span>
                      <div>
                        <div className="font-bold text-xs text-slate-800">{u.name}</div>
                        <div className="text-[10px] text-slate-500">موبایل: {u.phone}</div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isQc
                          ? 'bg-purple-100 text-purple-800'
                          : isLead
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
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
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-slate-400 text-xs">یا ورود با شماره و رمز</span>
            <div className="flex-grow border-t border-slate-200"></div>
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
                  className="w-full pl-3 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left font-mono"
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
                  className="w-full pl-3 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left font-mono"
                  dir="ltr"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 text-sm"
            >
              <UserCheck className="w-4 h-4" />
              ورود به سیستم
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
